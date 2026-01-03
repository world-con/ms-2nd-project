import React, { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";

import {
  Box,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Circle,
  Flex,
  Input,
  Spinner,
  Badge,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { useNavigate } from "react-router-dom";
import { FiMic, FiSquare, FiPause, FiPlay, FiSend } from "react-icons/fi";
import Card from "../components/Card";
import { useAppContext } from "../context/AppContext";
// Azure SDK 및 키 설정 제거됨 (Whisper 백엔드 사용)
const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_WHISPER_BACKEND_URL || "http://localhost:8000";


const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.8; }
`;

function Meeting() {
  const navigate = useNavigate();
  const {
    currentMeeting,
    isRecording,
    isPaused,
    recordingTime,
    flowState,
    backendStatus,
    aiMessages, setAiMessages,
    handleStartRecording,
    handlePauseResume,
    handleStopRecordingFlow,
    handleResetMeeting,
    realtimeSegments,
  } = useAppContext();

  // 실시간 전사 자동 스크롤용 Ref
  const segmentsEndRef = useRef(null);
  useEffect(() => {
    segmentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [realtimeSegments]);



  // STT 데이터 표시용
  const [localTranscript, setLocalTranscript] = useState("");
  // recognizerRef 제거됨


  // 로컬 aiMessages, aiInput 제거 (useAppContext에서 제공됨)
  const [aiInput, setAiInput] = useState(""); // 입력을 위한 로컬 상태는 유지하거나 Context와 연결
  const [isChatLoading, setIsChatLoading] = useState(false);


  // --- [1] 백엔드 기반 녹음 제어 (비워둠 - AppContext에서 처리) ---
  useEffect(() => {
    // Whisper 백엔드용 데이터는 AppContext의 uploadChunk/handleStartRecording에서 처리됩니다.
  }, [isRecording]);


  // 타이머는 이제 AppContext에서 관리하므로 이 페이지의 useEffect는 제거 가능합니다.


  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // [v8] 엔진 상태에 따른 가이드 메시지 생성 함수
  const getBackendGuideHeader = () => {
    if (backendStatus === "loading") {
      return (
        <Alert status="info" variant="subtle" borderRadius="8px" mb={2} py={2}>
          <AlertIcon />
          <Box flex="1">
            <AlertTitle fontSize="sm">엔진 가동 중</AlertTitle>
            <AlertDescription fontSize="xs" display="block">
              {isRecording
                ? "현재 녹음 데이터는 안전하게 보관되고 있습니다. 엔진 준비 즉시 전사됩니다."
                : "녹음을 먼저 진행해도 됩니다. 엔진이 준비되면 순차적으로 처리됩니다."}
            </AlertDescription>
          </Box>
        </Alert>
      );
    }
    if (backendStatus === "connected" || backendStatus === "ready") {
      return (
        <Alert status="success" variant="subtle" borderRadius="8px" mb={2} py={2}>
          <AlertIcon />
          <Box flex="1">
            <AlertTitle fontSize="sm">엔진 준비 완료</AlertTitle>
            <AlertDescription fontSize="xs">
              {isRecording ? "엔진 로딩 성공. 전사를 시작합니다!" : "준비되었습니다. 녹음 버튼을 눌러주세요."}
            </AlertDescription>
          </Box>
        </Alert>
      );
    }
    return null;
  };


  // handlePauseResume는 AppContext에서 가져온 것을 사용합니다.


  const handleStopRecording = async () => {
    handleStopRecordingFlow(); // Whisper 백엔드 종료 요청
  };

  const handleShutdown = async () => {
    if (window.confirm("회의 시스템을 종료하시겠습니까? (백엔드 서버 종료)")) {
      try {
        await fetch(`${API_URL}/shutdown`, { method: "POST" });
        alert("시스템 종료 요청이 전달되었습니다.");
        navigate("/home");
      } catch (e) {
        navigate("/home");
      }
    }
  };


  const handleAiSend = async () => {
    if (!aiInput.trim()) return;
    const userMessage = {
      type: "user",
      text: aiInput,
      time: new Date().toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setAiMessages((prev) => [...prev, userMessage]);
    const currentInput = aiInput;
    setAiInput("");
    setIsChatLoading(true);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: currentInput,
          category: "all"
        }),
      });

      if (!response.ok) throw new Error("서버 응답 에러");

      const data = await response.json();

      const aiResponse = {
        type: "ai",
        text: data.response || data.answer,
        time: new Date().toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setAiMessages((prev) => [...prev, aiResponse]);
    } catch (error) {
      console.error("Chat Error:", error);
      const errorMessage = {
        type: "ai",
        text: "죄송합니다. 서버 연결에 실패했습니다. 백엔드 상태를 확인해주세요.",
        time: new Date().toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setAiMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // --- [NEW] 화자 등록 화면 전용 컴포넌트 ---
  const SpeakerRegistrationView = () => {
    const [speakers, setSpeakers] = useState([
      { id: 1, name: "", email: "", isRecording: false, progress: 0, isDone: false },
      { id: 2, name: "", email: "", isRecording: false, progress: 0, isDone: false },
      { id: 3, name: "", email: "", isRecording: false, progress: 0, isDone: false },
      { id: 4, name: "", email: "", isRecording: false, progress: 0, isDone: false },
      { id: 5, name: "", email: "", isRecording: false, progress: 0, isDone: false },
      { id: 6, name: "", email: "", isRecording: false, progress: 0, isDone: false },
    ]);
    const [activeId, setActiveId] = useState(null);
    const [isAgreed, setIsAgreed] = useState(false); // [NEW] 개인정보 동의 상태
    const speakerMediaRef = useRef(null);

    const startRegRecording = (id) => {
      const spk = speakers.find(s => s.id === id);
      if (!spk.name.trim()) return alert("이름을 입력해주세요.");

      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        const chunks = [];
        mr.ondataavailable = e => chunks.push(e.data);
        mr.onstop = async () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          try {
            const result = await handleRegisterSpeaker(spk.name, spk.email, blob);
            if (result.status === "queued") {
              setSpeakers(prev => prev.map(s => s.id === id ? { ...s, isDone: true, isQueued: true, isRecording: false, progress: 100 } : s));
            } else {
              setSpeakers(prev => prev.map(s => s.id === id ? { ...s, isDone: true, isRecording: false, progress: 100 } : s));
            }
          } catch (e) {
            alert("등록 실패. 다시 시도해 주세요.");
            setSpeakers(prev => prev.map(s => s.id === id ? { ...s, isRecording: false, progress: 0 } : s));
          }
        };

        mr.start();
        speakerMediaRef.current = mr;
        setActiveId(id);
        setSpeakers(prev => prev.map(s => s.id === id ? { ...s, isRecording: true, progress: 0 } : s));

        // 20초 후 자동 중단
        let p = 0;
        const interval = setInterval(() => {
          p += 5;
          setSpeakers(prev => prev.map(s => s.id === id ? { ...s, progress: p } : s));
          if (p >= 100) {
            clearInterval(interval);
            mr.stop();
            stream.getTracks().forEach(t => t.stop());
            setActiveId(null);
          }
        }, 1000);
      });
    };

    const hasAnyRegistered = speakers.some(s => s.isDone);

    return (
      <Box maxW="600px" mx="auto" py={10}>
        <Card>
          <VStack spacing={6}>
            <Heading size="md" color="purple.600">👥 회의 참가자 목소리 등록</Heading>
            <Text fontSize="sm" color="gray.500" textAlign="center">
              정확한 화자 분리를 위해 참가자의 목소리를 20초간 등록합니다.<br />
              <b>[녹음시작]</b> 버튼을 누른 후 아래 가이드 문구를 편하게 읽어주세요.
            </Text>

            {/* [NEW] 음성 등록 가이드 스크립트 */}
            <Box w="full" p={4} bg="gray.100" borderRadius="lg" borderLeft="4px solid" borderColor="purple.500">
              <VStack align="start" spacing={2}>
                <Badge colorScheme="purple">독출 가이드 (Sample Script)</Badge>
                <Text fontSize="sm" fontWeight="bold" color="gray.700" lineHeight="tall">
                  "본인 [이름]은 이음 서비스 이용을 위한 음성 개인정보 제공에 동의합니다. <br />
                  본 녹음이 서비스 내에서 법적 효력을 가지는 것에 동의하며, <br />
                  고의적으로 서비스를 악용하거나 부정하게 사용할 시 발생하는 모든 책임은 본인에게 있음을 확인합니다. <br />
                  정확한 성문 분석을 위해 평소 대화 톤으로 이 문장을 끝까지 읽어주시기 바랍니다."
                </Text>
              </VStack>
            </Box>

            {/* 개인정보 활용 동의 구역 */}
            <Box w="full" p={4} bg="purple.50" borderRadius="lg" border="1px dashed" borderColor="purple.300">
              <VStack align="start" spacing={1}>
                <Text fontSize="xs" fontWeight="bold" color="purple.700">[개인정보(음성 지문) 활용 동의]</Text>
                <Text fontSize="xs" color="purple.600">
                  수집 목적: 실시간 화자 식별 및 이름 표시<br />
                  보유 기간: 서비스 이용 종료 시 즉시 파기
                </Text>
                <HStack mt={1}>
                  <input
                    type="checkbox"
                    id="consent-check"
                    checked={isAgreed}
                    onChange={(e) => setIsAgreed(e.target.checked)}
                  />
                  <Text as="label" htmlFor="consent-check" fontSize="xs" fontWeight="bold" color="purple.800" cursor="pointer">
                    안내 사항을 숙지하였으며, 음성 데이터 활용에 동의합니다. (필수)
                  </Text>
                </HStack>
              </VStack>
            </Box>

            <VStack w="full" spacing={3}>
              {speakers.map((s) => (
                <HStack key={s.id} w="full" p={3} borderWidth="1px" borderRadius="lg" bg={s.isDone ? "green.50" : "white"}>
                  <Circle size="30px" bg={s.isDone ? "green.500" : "gray.200"} color="white" fontSize="xs">
                    {s.id}
                  </Circle>
                  <Input
                    placeholder="이름"
                    size="sm"
                    value={s.name}
                    onChange={(e) => setSpeakers(prev => prev.map(item => item.id === s.id ? { ...item, name: e.target.value } : item))}
                    isDisabled={s.isDone || s.isRecording}
                    w="120px"
                  />
                  <Input
                    placeholder="이메일"
                    size="sm"
                    value={s.email}
                    onChange={(e) => setSpeakers(prev => prev.map(item => item.id === s.id ? { ...item, email: e.target.value } : item))}
                    isDisabled={s.isDone || s.isRecording}
                  />
                  <Button
                    size="sm"
                    colorScheme={s.isDone ? "green" : "purple"}
                    onClick={() => {
                      if (!isAgreed) return alert("먼저 개인정보 활용 동의에 체크해주세요.");
                      startRegRecording(s.id);
                    }}
                    isLoading={s.isRecording}
                    isDisabled={s.isDone || (activeId !== null && activeId !== s.id)}
                    w="100px"
                  >
                    {s.isDone ? (s.isQueued ? "전송대기" : "등록완료") : "녹음시작"}
                  </Button>
                </HStack>
              ))}
            </VStack>

            <Button
              size="lg"
              colorScheme="purple"
              w="full"
              isDisabled={!hasAnyRegistered || backendStatus !== "connected"}
              onClick={handleStartRecording}
            >
              {backendStatus === "connected" ? "회의 시작하기" : "엔진 로딩 대기 중..."}
            </Button>
            {!hasAnyRegistered && <Text fontSize="xs" color="red.400">최소 1명 이상의 화자를 등록해야 합니다.</Text>}
            {hasAnyRegistered && backendStatus !== "connected" && (
              <Text fontSize="xs" color="orange.500">엔진이 준비되면 녹음된 목소리가 자동으로 등록됩니다.</Text>
            )}
          </VStack>
        </Card>
      </Box>
    );
  };

  if (flowState === "registration") {
    return <SpeakerRegistrationView />;
  }

  if (flowState === "saving") {
    return (
      <Box textAlign="center" py={20}>
        <VStack spacing={6}>
          <Circle
            size="100px"
            bg="red.500"
            animation={`${pulse} 1.5s ease-in-out infinite`}
          >
            <FiMic size={40} color="white" />
          </Circle>
          <Heading size="lg" color="red.500">
            회의록 생성 중...
          </Heading>
          <Text color="gray.600">
            AI 엔진이 회의 내용을 분석하고 정제하고 있습니다. 잠시만 기다려주세요.
          </Text>
        </VStack>
      </Box>
    );
  }


  return (
    <Flex gap={6} py={8} px={4}>
      {/* 왼쪽: 메인 녹음 화면 */}
      <Box flex="1" maxW="700px">
        <Card textAlign="center">
          <VStack spacing={8}>
            {/* 녹음 중 애니메이션 */}
            <Circle
              size="150px"
              bg={isRecording ? "red.500" : "gray.400"}
              animation={isRecording && !isPaused ? `${pulse} 2s ease-in-out infinite` : ""}
            >
              <FiMic size={60} color="white" />
            </Circle>

            {/* 타이머 */}
            <VStack spacing={2}>
              <Heading size="2xl" color={isRecording ? "red.500" : "gray.600"}>
                {formatTime(recordingTime)}
              </Heading>
              <HStack>
                <Circle size="12px" bg={isRecording ? (isPaused ? "orange.500" : "red.500") : "gray.300"} />
                <Text fontSize="lg" color="gray.600">
                  {!isRecording ? "녹음 대기 중" : isPaused ? "일시정지 중" : "녹음 중"}
                </Text>
              </HStack>
            </VStack>

            {/* 컨트롤 버튼 */}
            <HStack spacing={4}>
              {flowState === "idle" && (
                <Button size="lg" colorScheme="red" leftIcon={<FiMic />} onClick={handleStartMeetingFlow} w="200px">
                  회의 시작
                </Button>
              )}
              {flowState === "recording" && (
                <>
                  <Button size="lg" colorScheme={isPaused ? "green" : "orange"} leftIcon={isPaused ? <FiPlay /> : <FiPause />} onClick={handlePauseResume} w="150px">
                    {isPaused ? "재개" : "일시정지"}
                  </Button>
                  <Button size="lg" colorScheme="red" leftIcon={<FiSquare />} onClick={handleStopRecording} w="150px">
                    회의 종료
                  </Button>
                </>
              )}
              {flowState === "completed" && (
                <HStack spacing={4}>
                  <Button size="lg" colorScheme="purple" leftIcon={<FiMic />} onClick={handleResetMeeting}>새 회의 시작</Button>
                  <Button size="lg" colorScheme="blue" leftIcon={<FiSend />} onClick={() => navigate("/result")}>결과 보기</Button>
                  <Button size="lg" variant="outline" onClick={handleShutdown}>시스템 종료</Button>
                </HStack>
              )}
            </HStack>

          </VStack>
        </Card>

        {/* [실시간 전사] 청크마다 반영되는 영역 (v8 엔진 핵심) */}
        <Card mt={6}>
          <HStack justify="space-between" mb={3}>
            <Heading size="sm">📝 실시간 회의록 (Whisper + Diarization)</Heading>
            <HStack>
              <Circle size="8px" bg={backendStatus === "connected" ? "green.500" : "orange.500"} />
              <Text fontSize="xs" color="gray.500">{backendStatus === "connected" ? "엔진 작동 중" : "서버 대기 중"}</Text>
            </HStack>
          </HStack>

          {getBackendGuideHeader()}

          <Box
            bg="gray.50"
            p={4}
            borderRadius="8px"
            h="250px"
            overflowY="auto"
            border="1px solid"
            borderColor="gray.200"
          >
            {realtimeSegments.length === 0 ? (
              <VStack spacing={4} pt={8}>
                {backendStatus === "loading" ? (
                  <>
                    <Spinner size="md" color="blue.500" thickness="3px" />
                    <VStack spacing={1}>
                      <Text fontSize="sm" color="blue.600" fontWeight="bold">AI 모델 로딩 중...</Text>
                      <Text fontSize="xs" color="gray.500" textAlign="center">
                        GPU 엔진을 깨우는 중입니다 (최대 3~5분 소요).<br />
                        <b>녹음을 먼저 시작하셔도 데이터는 안전하게 큐잉됩니다.</b>
                      </Text>
                    </VStack>
                  </>
                ) : (
                  <Text fontSize="sm" color="gray.500" fontStyle="italic">
                    회의가 시작되면 실시간으로 말씀하신 내용이 화자별로 나타납니다.
                  </Text>
                )}
              </VStack>

            ) : (
              <VStack align="start" spacing={4}>
                {realtimeSegments.map((seg, i) => (
                  <HStack key={i} align="start" w="full" spacing={3}>
                    <Badge colorScheme="purple" variant="solid" px={2} borderRadius="full" flexShrink={0}>
                      {seg.speaker}
                    </Badge>
                    <VStack align="start" spacing={0}>
                      <Text fontSize="sm" color="gray.800" fontWeight="500">
                        {seg.text}
                      </Text>
                      <Text fontSize="10px" color="gray.400">
                        {Math.floor(seg.start / 60)}:{(seg.start % 60).toFixed(0).padStart(2, '0')}
                      </Text>
                    </VStack>
                  </HStack>
                ))}
                <div ref={segmentsEndRef} />
              </VStack>

            )}
          </Box>
        </Card>



        {/* 회의 정보 */}
        {currentMeeting && (
          <Card mt={6}>
            <Heading size="sm" mb={3}>
              📅 새 회의
            </Heading>
            <Box bg="gray.50" p={4} borderRadius="12px" w="full">
              <Text fontSize="lg" fontWeight="bold" mb={2}>
                {currentMeeting.title}
              </Text>
              <HStack justify="center" fontSize="sm" color="gray.600">
                <Text>{currentMeeting.date}</Text>
                <Text>·</Text>
                <Text>시작: {currentMeeting.startTime}</Text>
              </HStack>
            </Box>
          </Card>
        )}
      </Box>

      {/* 오른쪽: AI 비서 채팅창 */}
      <Box w="350px">
        <Card h="calc(100vh - 150px)" display="flex" flexDirection="column">
          <Heading size="sm" mb={4}>
            💬 이음 AI 비서
          </Heading>

          {/* 채팅 메시지 */}
          <Box
            flex="1"
            overflowY="auto"
            mb={4}
            p={2}
            bg="gray.50"
            borderRadius="8px"
          >
            <VStack spacing={3} align="stretch">
              {aiMessages.map((msg, idx) => (
                <Box
                  key={idx}
                  alignSelf={msg.type === "user" ? "flex-end" : "flex-start"}
                  maxW="85%"
                >
                  <Box
                    bg={msg.type === "user" ? "primary.500" : "white"}
                    color={msg.type === "user" ? "white" : "gray.800"}
                    p={3}
                    borderRadius="12px"
                    boxShadow="sm"
                  >
                    <Box
                      fontSize="sm"
                      sx={{
                        "& p": { marginBottom: "0.5rem" },
                        "& strong": {
                          fontWeight: "bold",
                          // 유저 메시지면 흰색 유지, AI 메시지면 보라색 포인트
                          color: msg.type === "user" ? "white" : "#4811BF",
                        },
                        "& ul": { paddingLeft: "1.2rem" },
                        "& li": { marginBottom: "0.2rem" },
                      }}
                    >
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </Box>
                  </Box>
                  <Text
                    fontSize="xs"
                    color="gray.500"
                    mt={1}
                    textAlign={msg.type === "user" ? "right" : "left"}
                  >
                    {msg.time}
                  </Text>
                </Box>
              ))}
              {isChatLoading && (
                <Box alignSelf="flex-start" maxW="85%">
                  <Box bg="white" color="gray.500" p={3} borderRadius="12px" boxShadow="sm">
                    <Text fontSize="sm">이음 AI가 답변을 생각중입니다...</Text>
                  </Box>
                </Box>
              )}
            </VStack>
          </Box>

          {/* 입력 창 */}
          <HStack>
            <Input
              placeholder="질문을 입력하세요..."
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAiSend()}
              size="sm"
              disabled={isChatLoading}
            />
            <Button
              colorScheme="primary"
              size="sm"
              leftIcon={<FiSend />}
              onClick={handleAiSend}
              isLoading={isChatLoading}
            >
              전송
            </Button>
          </HStack>
        </Card>
      </Box>
    </Flex>
  );
}

export default Meeting;
