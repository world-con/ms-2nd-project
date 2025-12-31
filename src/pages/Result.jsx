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

function Result() {
  const [tabIndex, setTabIndex] = useState(0);
  const meeting = mockMeetingResult;
  const toast = useToast();

  // 회의록 다운로드 함수
  const handleDownloadMinutes = () => {
    const minutesContent = `
[이음 AI 회의록]

회의명: ${meeting.title}
일시: ${meeting.date} ${meeting.startTime} - ${meeting.endTime}
참석자: ${meeting.participants.join(", ")}
소요시간: ${meeting.duration}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 회의 요약
${meeting.summary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 주요 결정사항 (${meeting.decisions.length}개)
${meeting.decisions.map((d, i) => `${i + 1}. ${d}`).join("\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 TO-DO LIST (${todoList.length}개)
${todoList
  .map(
    (item, i) => `
${i + 1}. ${item.task}
   담당자: ${item.assignee}
   마감일: ${item.deadline}
   상태: ${item.status === "completed" ? "완료" : "진행 중"}
`
  )
  .join("\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ 미해결 이슈 (${meeting.openIssues?.length || 0}개)
${
  meeting.openIssues
    ?.map(
      (issue, i) =>
        `${i + 1}. ${issue.title} (마지막 언급: ${issue.lastMentioned})`
    )
    .join("\n") || "없음"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 전체 회의록
${meeting.transcript}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

생성일시: ${new Date().toLocaleString("ko-KR")}
생성자: 이음 AI 회의 서비스
    `;

    const blob = new Blob([minutesContent], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `이음_회의록_${meeting.date}_${meeting.title}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "회의록 다운로드 완료",
      description: "RAG 양식으로 회의록이 다운로드되었습니다.",
      status: "success",
      duration: 3000,
      isClosable: true,
    });
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
