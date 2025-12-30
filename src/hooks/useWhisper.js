import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Custom hook to handle real-time transcription via Whisper WebSocket backend.
 * @param {Object} options 
 * @param {number} options.chunkSec - Duration of each audio chunk in seconds.
 * @param {string} options.wsUrl - WebSocket URL for real-time results.
 * @param {string} options.uploadUrl - POST URL for uploading audio chunks.
 */
export const useWhisper = ({ chunkSec = 30, wsUrl, uploadUrl }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isServerReady, setIsServerReady] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [error, setError] = useState(null);

    const mediaRecorderRef = useRef(null);
    const socketRef = useRef(null);
    const chunkIndexRef = useRef(0);
    const streamRef = useRef(null);
    const isServerReadyRef = useRef(false); // ondataavailable에서 최신 상태를 참조하기 위함
    const pendingBlobsRef = useRef([]); // 서버가 준비되기 전의 청크 보관

    // 1. WebSocket 연결 설정 및 서버 신호 대기
    useEffect(() => {
        if (isRecording) {
            socketRef.current = new WebSocket(wsUrl);

            socketRef.current.onopen = () => {
                console.log("WebSocket Connected (Waiting for ready signal...)");
            };

            socketRef.current.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.type === "server_ready") {
                    console.log("Server Ready Signal Received");
                    setIsServerReady(true);
                    isServerReadyRef.current = true;
                } else if (data.type === "new_segments") {
                    const newText = data.segments.map(s => `[${s.speaker}] ${s.text}`).join("\n");
                    setTranscript(prev => prev + (prev ? "\n\n" : "") + newText);
                }
            };

            socketRef.current.onerror = (err) => {
                console.error("WebSocket Error:", err);
                setError("WebSocket 연결 에러");
            };

            socketRef.current.onclose = () => {
                console.log("WebSocket Closed");
                setIsServerReady(false);
                isServerReadyRef.current = false;
            };

            return () => {
                socketRef.current?.close();
            };
        } else {
            setIsServerReady(false);
            isServerReadyRef.current = false;
        }
    }, [isRecording, wsUrl]);

    // 2. 오디오 청크 업로드 함수
    const uploadChunk = async (blob) => {
        const formData = new FormData();
        // 백엔드가 .wav를 요구하므로 blob 타입을 강제로 지정하거나 백엔드 수정을 추천합니다.
        // 여기서는 일단 blob 그대로 보냅니다. (이름만 .wav로 위장)
        formData.append("file", blob, `chunk_${chunkIndexRef.current}.wav`);
        formData.append("chunkIndex", chunkIndexRef.current);

        try {
            const response = await fetch(uploadUrl, {
                method: "POST",
                body: formData,
            });
            if (!response.ok) throw new Error("Chunk upload failed");
            console.log(`Chunk ${chunkIndexRef.current} uploaded`);
            chunkIndexRef.current += 1;
        } catch (err) {
            console.error("Upload Error:", err);
        }
    };

    // 3. 서버 준비 완료 시 대기 중인 청크들 전송 (Flush Buffer)
    useEffect(() => {
        if (isServerReady && pendingBlobsRef.current.length > 0) {
            console.log(`Flushing ${pendingBlobsRef.current.length} pending chunks...`);
            const flushBuffer = async () => {
                while (pendingBlobsRef.current.length > 0) {
                    const blob = pendingBlobsRef.current.shift();
                    await uploadChunk(blob);
                }
            };
            flushBuffer();
        }
    }, [isServerReady]);

    // 4. 녹음 시작/중지 제어
    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    if (isServerReadyRef.current) {
                        uploadChunk(e.data);
                    } else {
                        console.log("Server not ready, buffering chunk...");
                        pendingBlobsRef.current.push(e.data);
                    }
                }
            };

            // 즉시 녹음 및 청킹 시작
            recorder.start(chunkSec * 1000);
            setIsRecording(true);
            setIsPaused(false);
            chunkIndexRef.current = 0;
            pendingBlobsRef.current = [];
            setError(null);
            console.log("Microphone ON & Recording Started immediately");
        } catch (err) {
            console.error("Mic Access Error:", err);
            setError("마이크 접근 권한이 필요합니다.");
        }
    }, [chunkSec]);

    const stopRecording = useCallback(async () => {
        mediaRecorderRef.current?.stop();
        mediaRecorderRef.current = null;
        streamRef.current?.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setIsPaused(false);
        setIsServerReady(false);
        isServerReadyRef.current = false;
        pendingBlobsRef.current = [];

        // 회의 종료 알림 (Backend /end 호출)
        try {
            const endUrl = uploadUrl.replace("/chunk", "/end");
            await fetch(endUrl, { method: "POST" });
            console.log("Meeting ended and results finalized");
        } catch (err) {
            console.error("End Meeting Error:", err);
        }
    }, [uploadUrl]);

    const pauseRecording = useCallback(() => {
        mediaRecorderRef.current?.pause();
        setIsPaused(true);
    }, []);

    const resumeRecording = useCallback(() => {
        mediaRecorderRef.current?.resume();
        setIsPaused(false);
    }, []);

    return {
        isRecording,
        isPaused,
        transcript,
        error,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        setTranscript,
    };
};
