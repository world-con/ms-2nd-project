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
                <Button size="lg" colorScheme="red" leftIcon={<FiMic />} onClick={handleStartRecording} w="200px">
                  녹음 시작
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
