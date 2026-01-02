import React, { useState } from "react";
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
  useToast,
} from "@chakra-ui/react";
import {
  FiFileText,
  FiTrendingUp,
  FiCheckCircle,
  FiDownload,
} from "react-icons/fi";
import Card from "../components/Card";
import ApprovalCenter from "../components/ApprovalCenter";
import { mockMeetingResult } from "../data/mockData";

const API_URL = import.meta.env.VITE_API_URL;

function Result() {
  const [tabIndex, setTabIndex] = useState(0);
  const meeting = mockMeetingResult;
  const toast = useToast();

  // 회의록 다운로드 함수
  const handleDownloadMinutes = async () => {
    // 1. 사용자 피드백 (로딩 토스트)
    toast({
        title: "회의록 생성 시작",
        description: "AI가 템플릿(스타일)을 확인하고 내용을 작성 중입니다...",
        status: "loading",
        duration: null, // 처리될 때까지 유지
        isClosable: false,
    });

    try {
        // 2. 현재 회의 데이터를 텍스트 컨텍스트로 변환 (LLM이 이해하기 좋은 형태로)
        const summaryContext = `
회의명: 팀 프로젝트 구체화 회의
회의 일시: 2025년 12월 23일
참석자: 전혜나, 김성태, 박훈용, 고영후, 박지성, 공채헌
회의 목적: 프로젝트 구체화 작업 및 역할 분담, 개발 착수 논의

1. 회의 주요 내용

① 프로젝트 진행 현황
- 팀 프로젝트의 원활한 협업을 위해 Git 초기 설정 및 사용법 공유 완료
- 사용자 경험 개선을 위한 UI/UX 기획 진행
- 전반적인 프로젝트 진행률은 약 20% 수준

② 파트별 진행 사항
- 프론트엔드
    김성태: 프로젝트 전체 콘셉트 정리 및 프론트엔드 레이아웃 초안 설계
    박훈용, 고영후: 프론트엔드 레이아웃 작업 공동 지원 및 기술 스택 검토
- 백엔드
    박지성: 백엔드에서 RAG 관련 로직 담당 예정
- STT 및 운영
    공채헌: STT 기술 위주 자료 조사 완료
    추후 토큰 사용량 계산을 통한 운영 비용 산정 예정
- 자동화
    전혜나: Azure Logic App을 활용한 자동화 기능 적용 방안 검토 중

③ 역할 분담(R&R)
- 팀 전반의 R&R이 1차적으로 정리되었으며, 세부 역할은 개발 과정에서 추가 조정 예정
- 핵심 코어 모델(Core Model) 개발 담당:
    고영후, 박훈용, 공채헌

2. 향후 계획 및 일정

- 내일부터 본격적인 개발 착수
    고영후 · 박훈용 · 공채헌: 핵심 코어 모델 개발 시작
    박지성: 프로토타입 개발 착수
- 개발 진행 상황에 따라 세부 기능 및 일정 지속 업데이트 예정
        `;

        // 3. 백엔드 요청
        const response = await fetch(`${API_URL}/generate-minutes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ summary_text: summaryContext }),
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "생성 실패");
        }

        // 4. Blob 응답 처리 (파일 다운로드)
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `이음_회의록_${meeting.title}.docx`);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        
        // 5. 성공 토스트
        toast.closeAll();
        toast({
            title: "다운로드 완료!",
            description: "Custom 회의록이 생성되었습니다.",
            status: "success",
            duration: 3000,
        });

    } catch (error) {
        console.error("Download Error:", error);
        toast.closeAll();
        toast({
            title: "생성 실패",
            description: "회의록 생성 중 오류가 발생했습니다.",
            status: "error",
            duration: 4000,
        });
    }
  };

  // TO-DO LIST 편집 저장
  const handleSaveTodoList = () => {
    setTodoList([...editedTodoList]);
    setIsEditingTodo(false);
    toast({
      title: "TO-DO LIST 저장 완료",
      description: "변경사항이 저장되었습니다.",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  };

  // TO-DO LIST 편집 취소
  const handleCancelTodoEdit = () => {
    setEditedTodoList([...todoList]);
    setIsEditingTodo(false);
  };

  // TO-DO 항목 수정
  const handleTodoChange = (index, field, value) => {
    const updated = [...editedTodoList];
    updated[index] = { ...updated[index], [field]: value };
    setEditedTodoList(updated);
  };

  // TO-DO 항목 추가
  const handleAddTodo = () => {
    setEditedTodoList([
      ...editedTodoList,
      {
        task: "새 작업",
        assignee: "담당자",
        deadline: "2025-12-31",
        status: "pending",
      },
    ]);
  };

  // TO-DO 항목 삭제
  const handleDeleteTodo = (index) => {
    const updated = editedTodoList.filter((_, i) => i !== index);
    setEditedTodoList(updated);
  };

  // TO-DO LIST 메일 발송
  const handleSendTodoEmail = () => {
    toast({
      title: "TO-DO LIST 메일 발송",
      description: "TO-DO LIST가 담당자들에게 메일로 발송되었습니다.",
      status: "success",
      duration: 3000,
      isClosable: true,
    });
  };

  return (
    <Box>
      {/* 헤더 */}
      <Card mb={6} bg="linear-gradient(135deg, #4811BF 0%, #8C5CF2 100%)">
        <VStack align="stretch" spacing={3}>
          <HStack justify="space-between">
            <Heading size="lg" color="white">
              {meeting.title}
            </Heading>
            <Button
              leftIcon={<FiDownload />}
              colorScheme="whiteAlpha"
              variant="solid"
              onClick={handleDownloadMinutes}
              size="lg"
              px={12}
              py={8}
              fontSize="lg"
              fontWeight="bold"
              height="60px"
              _hover={{ transform: "scale(0.9)", boxShadow: "lg" }}
              transition="all 0.2s"
            >
              RAG Custom 회의록
            </Button>
          </HStack>
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
                <Text color="gray.700" lineHeight="1.8">
                  {meeting.summary}
                </Text>
              </Card>

              {/* 결정사항 */}
              <Card>
                <HStack mb={4} justify="space-between">
                  <Heading size="md">✅ 주요 결정사항</Heading>
                  <Badge colorScheme="blue" fontSize="md">
                    {meeting.decisions.length}개
                  </Badge>
                </HStack>
                <VStack align="stretch" spacing={2}>
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
                  {meeting.transcript}
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
              <ApprovalCenter approvalItems={meeting.approvalItems} />
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}

export default Result;
