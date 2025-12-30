import React, { useState, useEffect } from "react";
import {
  Box,
  Heading,
  Text,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  VStack,
  HStack,
  Badge,
  Divider,
  Button,
  SimpleGrid,
  Spinner,
  useToast,
} from "@chakra-ui/react";
import {
  FiFileText,
  FiTrendingUp,
  FiCheckCircle,
  FiAlertCircle,
} from "react-icons/fi";
import Card from "../components/Card";
import ApprovalCenter from "../components/ApprovalCenter";
import { mockMeetingResult } from "../data/mockData";
import axios from "axios";
import { useAppContext } from "../context/AppContext";

function Result() {
  // --- [여기서부터 복사] ---
  const { transcript, setAiSummary, aiSummary } = useAppContext();
  const [tabIndex, setTabIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [realSummary, setRealSummary] = useState("");
  const toast = useToast();

  // 가짜 데이터 (UI 틀 유지용)
  const meeting = mockMeetingResult;

  // --- [핵심 로직] 페이지 열리면 백엔드 호출 ---
  useEffect(() => {
    const processMeeting = async () => {
      // 1. 녹음된 내용이 없으면 (그냥 들어왔으면) 가짜 데이터 보여주고 끝
      if (!transcript) {
        setIsLoading(false);
        return;
      }

      try {
        // 2. 백엔드에 요약/메일/DB저장 요청
        // (/api 접두사는 vite.config.js proxy 설정 덕분에 백엔드로 연결됨)
        const response = await axios.post("/api/analyze-meeting", {
          summary_text: transcript,
        });

        if (response.data.status === "success") {
          // 3. 성공하면 진짜 데이터로 교체
          const summaryText = response.data.summary; // 백엔드가 준 요약 텍스트
          setRealSummary(summaryText);
          setAiSummary(summaryText); // 전역 상태에도 저장 (다른 페이지용)

          toast({
            title: "AI 분석 완료",
            description: "회의록이 생성되고 승인 센터에서 체크하세요.",
            status: "info",
            duration: 5000,
            isClosable: true,
          });
        }
      } catch (error) {
        console.error("AI 처리 실패:", error);
        toast({
          title: "AI 처리 실패",
          description: "백엔드 연결을 확인해주세요.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setIsLoading(false);
      }
    };

    processMeeting();
  }, [transcript]); // transcript가 있을 때만 실행

  //2. 승인 버튼 함수
  const handleSendEmail = async () => {
    if (!realSummary) {
      toast({ title: "분석된 내용이 없습니다.", status: "warning" });
      return;
    }
    try {
      // setIsSending(true); // <-- 이 로딩은 ApprovalCenter 내부에서 처리하므로 여기서 뺍니다.
      const response = await axios.post("/api/execute-action", {
        summary_text: realSummary,
      });
      if (response.data.status === "success") {
        // 성공 로그 (Toast는 ApprovalCenter에서 띄울 거라 여기선 생략해도 됨)
        console.log("메일 발송 성공");
      }
    } catch (error) {
      console.error("메일 발송 실패");
      throw error; // 에러를 던져서 자식에게 알려줌
    }
  };

  return (
    <Box>
      {/* 헤더 */}
      <Card mb={6} bg="linear-gradient(135deg, #4811BF 0%, #8C5CF2 100%)">
        <VStack align="stretch" spacing={3}>
          <Heading size="lg" color="white">
            {meeting.title}
          </Heading>
          <HStack fontSize="sm" color="whiteAlpha.900">
            <Text>{meeting.date}</Text>
            <Text>·</Text>
            <Text>
              {meeting.startTime} - {meeting.endTime}
            </Text>
            <Text>·</Text>
            <Text>{meeting.duration}</Text>
            <Text>·</Text>
            <Text>{meeting.participants.length}명 참석</Text>
          </HStack>
          <HStack>
            {meeting.participants.map((name, i) => (
              <Badge key={i} colorScheme="purple" fontSize="xs">
                {name}
              </Badge>
            ))}
          </HStack>
        </VStack>
      </Card>

      {/* 탭 메뉴 */}
      <Tabs index={tabIndex} onChange={setTabIndex} colorScheme="purple">
        <TabList mb={6} bg="white" p={2} borderRadius="12px">
          <Tab>
            <HStack>
              <FiFileText />
              <Text>회의록</Text>
            </HStack>
          </Tab>
          <Tab>
            <HStack>
              <FiTrendingUp />
              <Text>심층 분석</Text>
            </HStack>
          </Tab>
          <Tab>
            <HStack>
              <FiCheckCircle />
              <Text>자동화 승인</Text>
            </HStack>
          </Tab>
        </TabList>

        <TabPanels>
          {/* Tab 1: 회의록 */}
          <TabPanel p={0}>
            <VStack align="stretch" spacing={6}>
              {/* 요약 */}
              <Card>
                <Heading size="md" mb={3}>
                  📝 회의 요약
                </Heading>
                {isLoading ? (
                  <VStack py={8}>
                    <Spinner size="xl" color="purple.500" thickness="4px" />
                    <Text mt={4} color="gray.500" fontSize="sm">
                      AI가 회의 내용을 분석하고 있습니다...
                    </Text>
                  </VStack>
                ) : (
                  <Text color="gray.700" lineHeight="1.8" whiteSpace="pre-line">
                    {/* 진짜 요약본이 있으면 보여주고, 없으면 가짜 데이터 보여줌 */}
                    {realSummary || meeting.summary}
                  </Text>
                )}
              </Card>

              {/* 결정사항 (여기는 아직 AI가 구조화해서 주지 않으므로 가짜 데이터 유지 or 요약본 참조) */}
              <Card>
                <HStack mb={4} justify="space-between">
                  <Heading size="md">✅ 주요 결정사항</Heading>
                  <Badge colorScheme="blue" fontSize="md">
                    AI 추출됨
                  </Badge>
                </HStack>
                {/* 시연을 위해 가짜 데이터 유지하거나, realSummary를 보고 설명 */}
                <VStack align="stretch" spacing={2}>
                  {/* ... 기존 map 코드 유지 ... */}
                  {meeting.decisions.map((decision, i) => (
                    <HStack
                      key={i}
                      p={3}
                      bg="blue.50"
                      borderRadius="8px"
                      borderLeft="4px solid"
                      borderColor="blue.500"
                    >
                      <Badge colorScheme="blue">{i + 1}</Badge>
                      <Text>{decision}</Text>
                    </HStack>
                  ))}
                </VStack>
              </Card>

              {/* 액션 아이템 */}
              <Card>
                <HStack mb={4} justify="space-between">
                  <Heading size="md">🎯 액션 아이템</Heading>
                  <Badge colorScheme="orange" fontSize="md">
                    {meeting.actionItems.length}개
                  </Badge>
                </HStack>
                <VStack align="stretch" spacing={3}>
                  {meeting.actionItems.map((item, i) => (
                    <Box
                      key={i}
                      p={4}
                      bg="orange.50"
                      borderRadius="8px"
                      borderLeft="4px solid"
                      borderColor="orange.500"
                    >
                      <HStack justify="space-between" mb={2}>
                        <Text fontWeight="bold">{item.task}</Text>
                        <Badge
                          colorScheme={
                            item.status === "completed" ? "green" : "orange"
                          }
                        >
                          {item.status === "completed" ? "완료" : "진행 중"}
                        </Badge>
                      </HStack>
                      <HStack fontSize="sm" color="gray.600">
                        <Text>담당: {item.assignee}</Text>
                        <Text>·</Text>
                        <Text>마감: {item.deadline}</Text>
                      </HStack>
                    </Box>
                  ))}
                </VStack>
              </Card>

              {/* 미해결 이슈 */}
              {meeting.openIssues && meeting.openIssues.length > 0 && (
                <Card>
                  <HStack mb={4} justify="space-between">
                    <Heading size="md">⚠️ 미해결 이슈</Heading>
                    <Badge colorScheme="red" fontSize="md">
                      {meeting.openIssues.length}개
                    </Badge>
                  </HStack>
                  <VStack align="stretch" spacing={2}>
                    {meeting.openIssues.map((issue, i) => (
                      <HStack
                        key={i}
                        p={3}
                        bg="red.50"
                        borderRadius="8px"
                        borderLeft="4px solid"
                        borderColor="red.500"
                      >
                        <FiAlertCircle color="#E53E3E" />
                        <Text flex="1">{issue.title}</Text>
                        <Text fontSize="xs" color="gray.600">
                          마지막 언급: {issue.lastMentioned}
                        </Text>
                      </HStack>
                    ))}
                  </VStack>
                </Card>
              )}

              {/* 전체 회의록 */}
              <Card>
                <Heading size="md" mb={3}>
                  💬 전체 회의록
                </Heading>
                <Divider mb={3} />
                <Box
                  bg="gray.50"
                  p={4}
                  borderRadius="8px"
                  fontSize="sm"
                  whiteSpace="pre-line"
                  lineHeight="1.8"
                  maxH="400px"
                  overflow="auto"
                >
                  {transcript || meeting.transcript}
                </Box>
              </Card>
            </VStack>
          </TabPanel>

          {/* Tab 2: 심층 분석 */}
          <TabPanel p={0}>
            <VStack align="stretch" spacing={6}>
              {/* 회의 유형 및 감정 분석 */}
              <Card>
                <Heading size="md" mb={4}>
                  📊 회의 분석
                </Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <Box p={4} bg="purple.50" borderRadius="8px">
                    <Text fontSize="sm" color="gray.600" mb={1}>
                      회의 유형
                    </Text>
                    <Text fontSize="xl" fontWeight="bold" color="primary.500">
                      {meeting.insights.meetingType}
                    </Text>
                  </Box>
                  <Box p={4} bg="green.50" borderRadius="8px">
                    <Text fontSize="sm" color="gray.600" mb={1}>
                      전체 분위기
                    </Text>
                    <Text fontSize="xl" fontWeight="bold" color="success.500">
                      긍정적 ✅
                    </Text>
                  </Box>
                </SimpleGrid>
              </Card>

              {/* 주요 토픽 */}
              <Card>
                <Heading size="md" mb={3}>
                  🔑 주요 토픽
                </Heading>
                <HStack spacing={2} flexWrap="wrap">
                  {meeting.insights.keyTopics.map((topic, i) => (
                    <Badge key={i} colorScheme="purple" fontSize="md" p={2}>
                      {topic}
                    </Badge>
                  ))}
                </HStack>
              </Card>

              {/* 리스크 분석 */}
              <Card>
                <Heading size="md" mb={4}>
                  ⚠️ 리스크 분석
                </Heading>
                <VStack align="stretch" spacing={3}>
                  {meeting.insights.risks.map((risk, i) => (
                    <Box
                      key={i}
                      p={4}
                      bg={risk.level === "high" ? "red.50" : "yellow.50"}
                      borderRadius="8px"
                      borderLeft="4px solid"
                      borderColor={
                        risk.level === "high" ? "red.500" : "yellow.500"
                      }
                    >
                      <HStack justify="space-between" mb={2}>
                        <Badge
                          colorScheme={risk.level === "high" ? "red" : "yellow"}
                        >
                          {risk.level === "high" ? "높음" : "중간"}
                        </Badge>
                      </HStack>
                      <Text>{risk.description}</Text>
                    </Box>
                  ))}
                </VStack>
              </Card>

              {/* AI 추천 사항 */}
              <Card>
                <Heading size="md" mb={4}>
                  💡 AI 추천 사항
                </Heading>
                <VStack align="stretch" spacing={3}>
                  {meeting.insights.recommendations.map((rec, i) => (
                    <HStack
                      key={i}
                      p={3}
                      bg="blue.50"
                      borderRadius="8px"
                      align="flex-start"
                    >
                      <Badge colorScheme="blue" mt={1}>
                        {i + 1}
                      </Badge>
                      <Text flex="1">{rec}</Text>
                    </HStack>
                  ))}
                </VStack>
              </Card>
            </VStack>
          </TabPanel>

          {/* Tab 3: 자동화 승인 */}
          <TabPanel p={0}>
            <VStack align="stretch" spacing={6}>
              {/* 차별화 포인트 강조 */}
              <Card bg="gradient.to-r, primary.50, secondary.50">
                <HStack spacing={4} align="start">
                  <Box p={3} bg="white" borderRadius="12px" boxShadow="sm">
                    <Text fontSize="3xl">🚀</Text>
                  </Box>
                  <Box flex="1">
                    <Heading size="md" mb={2} color="primary.500">
                      이음의 차별화 포인트!
                    </Heading>
                    <Text color="gray.700" fontSize="sm" lineHeight="1.8">
                      Notion AI는 회의록을 저장하는 것으로 끝나지만,
                      <strong>
                        {" "}
                        이음은 회의 종료 후 자동으로 실행까지 연결
                      </strong>
                      합니다.
                      <br />
                      아래 항목을 체크하고 승인하면{" "}
                      <strong>수동 작업 15분을 3초로 단축</strong>할 수
                      있습니다.
                    </Text>
                  </Box>
                </HStack>
              </Card>

              {/* 승인 센터 */}
              <ApprovalCenter
                approvalItems={meeting.approvalItems}
                onSendEmail={handleSendEmail}
              />
              <Box pt={6} pb={10}></Box>
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}

export default Result;
