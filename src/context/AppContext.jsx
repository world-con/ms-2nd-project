import React, { createContext, useContext, useState, useRef, useEffect } from 'react'
import axios from 'axios';

const AppContext = createContext()
const WHISPER_BACKEND_URL = import.meta.env.VITE_WHISPER_BACKEND_URL || "https://ieum-stt.livelymushroom-0e97085f.australiaeast.azurecontainerapps.io";
const WHISPER_WS_URL = import.meta.env.VITE_WHISPER_WS_URL || "wss://ieum-stt.livelymushroom-0e97085f.australiaeast.azurecontainerapps.io/ws";

export const useAppContext = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider')
  }
  return context
}

export const AppProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentMeeting, setCurrentMeeting] = useState(null)
  const [meetings, setMeetings] = useState([])

  // 회의 상태 전역 관리
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [flowState, setFlowState] = useState("idle") // 'idle' | 'registration' | 'recording' | 'saving' | 'completed'
  const [backendStatus, setBackendStatus] = useState("disconnected")
  const [transcript, setTranscript] = useState("")
  const [realtimeSegments, setRealtimeSegments] = useState([])
  const [registeredSpeakers, setRegisteredSpeakers] = useState([]) // [NEW] 등록 완료된 화자 목록
  const [pendingRegistrations, setPendingRegistrations] = useState([]) // [NEW] 서버 연결 전 임시 보관함
  const [aiSummary, setAiSummary] = useState("")

  const [aiMessages, setAiMessages] = useState([
    { type: "ai", text: "회의 중 궁금한 점이 있으면 물어보세요!", time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) },
  ]);

  // 로직용 Ref
  const mediaRecorderRef = useRef(null);
  const socketRef = useRef(null);
  const chunkIndexRef = useRef(0);
  const chunkTimerRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const isRecordingRef = useRef(false); // [v8.2] onstop 제어용
  const isPausedRef = useRef(false);    // [v8.2] onstop 제어용

  // 1. 백엔드 예열 & 소켓 연결 (로그인 시 또는 앱 시작 시)
  useEffect(() => {
    let reconnectTimer;
    const warmupAndConnect = async () => {
      try {
        setBackendStatus("loading");
        await axios.get(`${WHISPER_BACKEND_URL}/status`, { timeout: 10000 });
        connectSocket();
      } catch (e) {
        console.log("📡 Backend startup check failed, retrying socket...");
        connectSocket();
      }
    };

    const connectSocket = () => {
      if (socketRef.current?.readyState === WebSocket.OPEN) return;
      const socket = new WebSocket(WHISPER_WS_URL);
      socket.onopen = () => setBackendStatus("connected");
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "status") setBackendStatus(data.value);
        if (data.type === "new_segments") {
          // [핵심] 백엔드에서 온 화자 분리 데이터를 실시간으로 누적
          setRealtimeSegments((prev) => [...prev, ...data.segments]);
        }
      };

      socket.onclose = () => {
        setBackendStatus("disconnected");
        reconnectTimer = setTimeout(connectSocket, 5000);
      };
      socketRef.current = socket;
    };

    warmupAndConnect();
    return () => {
      clearTimeout(reconnectTimer);
    };
  }, []);

  // [NEW] 서버 연결 시 예약된 화자 등록 자동 전송
  useEffect(() => {
    if (backendStatus === "connected" && pendingRegistrations.length > 0) {
      const flushRegistrations = async () => {
        console.log("🚀 Flushing pending registrations...");
        for (const reg of pendingRegistrations) {
          try {
            await handleRegisterSpeaker(reg.name, reg.email, reg.blob);
            // 성공 시 pending에서 제거는 마지막에 일괄 처리하거나 개별 처리
          } catch (e) {
            console.error("Flush failed for", reg.name, e);
          }
        }
        setPendingRegistrations([]); // 전송 시도 후 큐 초기화
      };
      flushRegistrations();
    }
  }, [backendStatus, pendingRegistrations.length]);

  // 2. 타이머 로직 (기본 녹음 시간 & 30초 단위 데이터 요청)
  useEffect(() => {
    if (isRecording && !isPaused) {
      // (1) 전체 녹음 시간 타이머
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // (2) [v8] 30초마다 데이터(requestData) 요청 타이머
      // 이전에 'stale closure' 문제가 있던 setInterval을 여기로 옮겼습니다.
      chunkTimerRef.current = setInterval(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          // [v8.2] requestData() 대신 stop() 호출 -> onstop에서 새 독립 파일 생성
          mediaRecorderRef.current.stop();
        }
      }, 30000);
    } else {
      clearInterval(recordingTimerRef.current);
      clearInterval(chunkTimerRef.current);
    }
    return () => {
      clearInterval(recordingTimerRef.current);
      clearInterval(chunkTimerRef.current);
    };
  }, [isRecording, isPaused]);


  // 3. 청크 업로드 로직
  const uploadChunk = async (blob) => {
    const currentIndex = chunkIndexRef.current;
    chunkIndexRef.current += 1;
    const formData = new FormData();
    formData.append("chunkIndex", currentIndex);
    formData.append("file", blob, `chunk_${currentIndex}.webm`);
    try {
      await axios.post(`${WHISPER_BACKEND_URL}/chunk`, formData);
    } catch (e) { console.error("Chunk upload fail", e); }
  };

  // 4. 액션 핸들러
  const handleStartMeetingFlow = () => {
    // [NEW] 바로 녹음 안 하고 등록 단계로 진입
    setFlowState("registration");
  };

  const handleRegisterSpeaker = async (name, email, audioBlob) => {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email || "");
    formData.append("consent", "true");
    formData.append("file", audioBlob, "registration.webm");

    // 서버가 아직 연결 전이라면 큐에 담기만 함
    if (backendStatus !== "connected") {
      setPendingRegistrations(prev => [...prev, { name, email, blob: audioBlob }]);
      return { status: "queued" };
    }

    try {
      const resp = await axios.post(`${WHISPER_BACKEND_URL}/register_speaker`, formData);
      setRegisteredSpeakers((prev) => [...prev, name]);
      return resp.data;
    } catch (e) {
      console.error("Speaker registration fail", e);
      throw e;
    }
  };

  const handleStartRecording = () => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) uploadChunk(e.data);
      };

      // [v8.2] Stop-Restart 핵심: 멈췄을 때 녹음 상태라면 즉시 다시 시작
      mediaRecorder.onstop = () => {
        if (isRecordingRef.current && !isPausedRef.current) {
          mediaRecorder.start();
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      isRecordingRef.current = true; // Ref로 즉시 상태 관리 (onstop 대응)
      setFlowState("recording");
      setRecordingTime(0);

    }).catch(err => {
      alert("마이크 권한이 필요합니다.");
      setFlowState("idle");
    });
  };

  const handlePauseResume = () => {
    if (!mediaRecorderRef.current) return;

    if (mediaRecorderRef.current.state === "recording") {
      // 일시정지 직전 현재까지 녹음된 데이터를 강제로 전송 (Stop-Restart 전략에 맞춤)
      mediaRecorderRef.current.stop();
      setIsPaused(true);
      isPausedRef.current = true;
    } else if (mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      isPausedRef.current = false;
    }
  };


  const handleStopRecordingFlow = async () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    setFlowState("saving");
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    clearInterval(chunkTimerRef.current);
    try {
      const resp = await axios.post(`${WHISPER_BACKEND_URL}/end`);
      setTranscript(`회의 저장 완료 (세그먼트: ${resp.data.segments || 0})`);
      setFlowState("completed");
    } catch (e) { setFlowState("completed"); }
  };

  const handleResetMeeting = async () => {
    try {
      await axios.post(`${WHISPER_BACKEND_URL}/reset`);
      setFlowState("idle");
      setRecordingTime(0);
      setTranscript("");
      setRealtimeSegments([]); // 실시간 데이터도 초기화
    } catch (e) { setFlowState("idle"); }

  };

  const startMeeting = (meetingData) => {
    setCurrentMeeting(meetingData);
    setFlowState("idle");
    setRecordingTime(0);
    setTranscript("");
    setAiSummary("");
  };

  const value = {
    isLoggedIn, setIsLoggedIn,
    currentMeeting, setCurrentMeeting,
    meetings, setMeetings,
    isRecording, setIsRecording,
    isPaused, setIsPaused,
    recordingTime, setRecordingTime,
    flowState, setFlowState,
    backendStatus, setBackendStatus,
    transcript, setTranscript,
    aiSummary, setAiSummary,
    aiMessages, setAiMessages,
    handleStartRecording,
    handlePauseResume,
    handleStopRecordingFlow,
    handleResetMeeting,
    startMeeting,
    realtimeSegments, setRealtimeSegments,
    handleStartMeetingFlow,
    handleRegisterSpeaker,
    registeredSpeakers, setRegisteredSpeakers,
    pendingRegistrations, // 노출
  }


  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
