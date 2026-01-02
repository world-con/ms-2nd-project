import React, { useEffect, useState } from "react";
import {
  Box,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Circle,
  Textarea,
  Input,
  Flex,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { useNavigate } from "react-router-dom";
import { FiMic, FiSquare, FiPause, FiPlay, FiSend } from "react-icons/fi";
import Card from "../components/Card";
import { useAppContext } from "../context/AppContext";

const API_URL = import.meta.env.VITE_API_URL;

const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.8; }
`;

function Meeting() {
  const navigate = useNavigate();
  const {
    currentMeeting,
    isRecording,
    recordingTime,
    setRecordingTime,
    stopRecording,
  } = useAppContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sttTranscript, setSttTranscript] = useState(""); // STT 전사 내용
  const [aiMessages, setAiMessages] = useState([
    {
      type: "ai",
      text: "회의 중 궁금한 점이 있으면 물어보세요!",
      time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [aiInput, setAiInput] = useState("");

  // STT 시뮬레이션 (더미 데이터)
  useEffect(() => {
    if (isRecording && !isPaused) {
      const timer = setTimeout(() => {
        const dummyTexts = [
          "[김프로] 오늘 회의 시작하겠습니다. 먼저 지난 회의 내용을 간단히 리뷰하겠습니다.",
          "[박팀장] 네, RAG 구현 부분은 진행 중입니다. 이번 주 내로 완료 예정입니다.",
          "[이매니저] 프론트엔드는 80% 완료되었고, 승인센터 기능을 추가 중입니다.",
          "[김프로] 좋습니다. 다음 주 데모 준비는 어떻게 되고 있나요?",
          "[박팀장] 데모 시나리오는 작성 완료했고, 실제 시연 준비 중입니다.",
        ];

        if (recordingTime > 0 && recordingTime % 5 === 0) {
          const randomIndex = Math.floor(Math.random() * dummyTexts.length);
          setSttTranscript(
            (prev) => prev + (prev ? "\n\n" : "") + dummyTexts[randomIndex]
          );
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isRecording, isPaused, recordingTime]);

  useEffect(() => {
    let timer;
    if (isRecording && !isPaused) {
      timer = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer); // ✅ 조건 추가
    };
  }, [isRecording, isPaused]); // ✅ setRecordingTime 제거

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const handlePauseResume = () => {
    setIsPaused(!isPaused);
  };

  const handleStopRecording = () => {
    stopRecording();
    setIsProcessing(true);

    // 2초 후 결과 화면으로 이동 (시뮬레이션)
    setTimeout(() => {
      setIsProcessing(false);
      navigate("/result/999");
    }, 2000);
  };

  const handleAiSend = async () => {
    if (!aiInput.trim()) return;

    // 1. 사용자 메시지 표시
    const userMessage = { type: "user", text: aiInput, time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) };
    setAiMessages((prev) => [...prev, userMessage]);
    setAiInput(""); // 입력창 비우기

    // 2. 백엔드로 질문 전송
    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.text,
          category: "all"
        }),
      });

      const data = await response.json();

      // 3. AI 응답 표시
      setAiMessages((prev) => [
        ...prev,
        {
          type: "ai",
          text: data.response,
          time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);

    } catch (error) {
      console.error("Chat Error:", error);
      setAiMessages((prev) => [
        ...prev,
        { type: "ai", text: "서버에 문제가 발생했습니다. 관리자에게 문의 바랍니다.", time: "..." },
      ]);
    }
  };

  if (isProcessing) {
    return (
      <Box textAlign="center" py={20}>
        <VStack spacing={6}>
          <Circle
            size="100px"
            bg="primary.500"
            animation={`${pulse} 1.5s ease-in-out infinite`}
          >
            <FiMic size={40} color="white" />
          </Circle>
          <Heading size="lg" color="primary.500">
            회의록 생성 중...
          </Heading>
          <Text color="gray.600">
            AI가 회의 내용을 분석하고 정리하고 있습니다
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
              bg="red.500"
              animation={`${pulse} 2s ease-in-out infinite`}
            >
              <FiMic size={60} color="white" />
            </Circle>

            {/* 타이머 */}
            <VStack spacing={2}>
              <Heading size="2xl" color="red.500">
                {formatTime(recordingTime)}
              </Heading>
              <HStack>
                <Circle size="12px" bg={isPaused ? "orange.500" : "red.500"} />
                <Text fontSize="lg" color="gray.600">
                  {isPaused ? "일시정지 중" : "녹음 중"}
                </Text>
              </HStack>
            </VStack>

            {/* 일시정지 / 종료 버튼 */}
            <HStack spacing={4}>
              <Button
                size="lg"
                colorScheme={isPaused ? "green" : "orange"}
                leftIcon={isPaused ? <FiPlay /> : <FiPause />}
                onClick={handlePauseResume}
                w="150px"
                _hover={{ transform: "scale(1.05)" }}
                transition="all 0.2s"
              >
                {isPaused ? "재개" : "일시정지"}
              </Button>

              <Button
                size="lg"
                colorScheme="red"
                leftIcon={<FiSquare />}
                onClick={handleStopRecording}
                w="150px"
                _hover={{ transform: "scale(1.05)" }}
                transition="all 0.2s"
              >
                회의 종료
              </Button>
            </HStack>
          </VStack>
        </Card>

        {/* STT 실시간 전사 창 */}
        <Card mt={6}>
          <Heading size="sm" mb={3}>
            📝 실시간 전사 내용 (STT)
          </Heading>
          <Box
            bg="gray.50"
            p={4}
            borderRadius="8px"
            h="calc(55vh - 150px)"
            overflowY="auto"
            border="1px solid"
            borderColor="gray.200"
          >
            {sttTranscript ? (
              <Text fontSize="sm" color="gray.700" whiteSpace="pre-wrap">
                {sttTranscript}
              </Text>
            ) : (
              <Text fontSize="sm" color="gray.500" fontStyle="italic">
                회의 내용이 여기에 실시간으로 표시됩니다...
              </Text>
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
                    <Text fontSize="sm">{msg.text}</Text>
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
            />
            <Button
              colorScheme="primary"
              size="sm"
              leftIcon={<FiSend />}
              onClick={handleAiSend}
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
