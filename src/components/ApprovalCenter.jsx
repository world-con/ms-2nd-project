import React, { useState } from 'react'
import {
  Box,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Checkbox,
  Badge,
  Progress,
  useToast,
  Divider,
  Icon,
  Input,
  Textarea,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
} from '@chakra-ui/react'
import { FiCalendar, FiMail, FiCheckSquare, FiCheck, FiEdit2, FiSend } from 'react-icons/fi'
import Card from './Card'

function ApprovalCenter({ approvalItems: initialItems }) {
  const [approvalItems, setApprovalItems] = useState(initialItems)
  const [selectedItems, setSelectedItems] = useState({})
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionProgress, setExecutionProgress] = useState(0)
  const [completedItems, setCompletedItems] = useState({})
  const [editingItem, setEditingItem] = useState(null)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const toast = useToast()

  const handleCheckboxChange = (id) => {
    setSelectedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // EDIT 버튼 클릭
  const handleEditClick = (item) => {
    setEditingItem({ ...item })
    onOpen()
  }

  // 편집 저장
  const handleSaveEdit = () => {
    setApprovalItems((prev) =>
      prev.map((item) => (item.id === editingItem.id ? editingItem : item))
    )
    toast({
      title: '수정 완료',
      description: '항목이 성공적으로 수정되었습니다.',
      status: 'success',
      duration: 2000,
    })
    onClose()
  }

  // 자동보고 실행
  const handleAutoReport = () => {
    toast({
      title: '자동 보고 발송 중...',
      description: '회의록과 심층 분석 내용을 상사에게 보고하고 있습니다.',
      status: 'info',
      duration: 2000,
    })

    setTimeout(() => {
      toast({
        title: '자동 보고 완료! 📧',
        description: '상사에게 회의 보고 메일이 성공적으로 발송되었습니다.',
        status: 'success',
        duration: 4000,
        isClosable: true,
      })
    }, 2000)
  }

  const handleApprove = async () => {
    const selectedCount = Object.values(selectedItems).filter(Boolean).length

    if (selectedCount === 0) {
      toast({
        title: '항목을 선택해주세요',
        description: '실행할 자동화 항목을 체크해주세요',
        status: 'warning',
        duration: 2000,
      })
      return
    }

    setIsExecuting(true)
    setExecutionProgress(0)

    // 시뮬레이션: 각 항목을 순차적으로 실행
    const selectedIds = Object.keys(selectedItems).filter((id) => selectedItems[id])
    const totalSteps = selectedIds.length

    for (let i = 0; i < totalSteps; i++) {
      const itemId = selectedIds[i]

      // 진행률 업데이트
      setExecutionProgress(((i + 1) / totalSteps) * 100)

      // 완료 표시
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setCompletedItems((prev) => ({ ...prev, [itemId]: true }))
    }

    // 완료 토스트
    toast({
      title: '자동화 실행 완료! 🎉',
      description: `${selectedCount}개 작업이 성공적으로 완료되었습니다`,
      status: 'success',
      duration: 4000,
      isClosable: true,
    })

    setIsExecuting(false)
  }

  const getIcon = (type) => {
    switch (type) {
      case 'calendar':
        return FiCalendar
      case 'email':
        return FiMail
      case 'todo':
        return FiCheckSquare
      case 'report':
        return FiSend
      default:
        return FiCheck
    }
  }

  const getColorScheme = (type) => {
    switch (type) {
      case 'calendar':
        return 'blue'
      case 'email':
        return 'green'
      case 'todo':
        return 'orange'
      case 'report':
        return 'purple'
      default:
        return 'purple'
    }
  }

  const selectedCount = Object.values(selectedItems).filter(Boolean).length
  const totalEstimatedTime = approvalItems
    .filter((item) => selectedItems[item.id])
    .reduce((acc, item) => acc + parseInt(item.estimatedTime), 0)

  return (
    <>
      <Card>
        <VStack align="stretch" spacing={6}>
          {/* 헤더 */}
          <Box>
            <Heading size="md" mb={2}>
              🚀 자동화 승인 센터
            </Heading>
            <Text fontSize="sm" color="gray.600">
              실행할 자동화 작업을 선택하고 승인해주세요
            </Text>
          </Box>

          <Divider />

          {/* KPI 요약 */}
          {!isExecuting && (
            <HStack
              bg="purple.50"
              p={4}
              borderRadius="12px"
              justify="space-around"
            >
              <VStack spacing={0}>
                <Text fontSize="2xl" fontWeight="bold" color="primary.500">
                  {selectedCount}
                </Text>
                <Text fontSize="xs" color="gray.600">
                  선택된 작업
                </Text>
              </VStack>
              <VStack spacing={0}>
                <Text fontSize="2xl" fontWeight="bold" color="secondary.500">
                  ~{totalEstimatedTime}초
                </Text>
                <Text fontSize="xs" color="gray.600">
                  예상 소요
                </Text>
              </VStack>
              <VStack spacing={0}>
                <Text fontSize="2xl" fontWeight="bold" color="success.500">
                  ~15분
                </Text>
                <Text fontSize="xs" color="gray.600">
                  절약 시간
                </Text>
              </VStack>
            </HStack>
          )}

          {/* 실행 중 진행률 */}
          {isExecuting && (
            <Box>
              <HStack justify="space-between" mb={2}>
                <Text fontWeight="bold">실행 중...</Text>
                <Text fontSize="sm" color="gray.600">
                  {Math.round(executionProgress)}%
                </Text>
              </HStack>
              <Progress
                value={executionProgress}
                size="lg"
                colorScheme="purple"
                borderRadius="full"
                hasStripe
                isAnimated
              />
            </Box>
          )}

          {/* 승인 항목 리스트 */}
          <VStack align="stretch" spacing={4}>
            {approvalItems.map((item) => (
              <Box
                key={item.id}
                p={4}
                bg={
                  completedItems[item.id]
                    ? 'green.50'
                    : selectedItems[item.id]
                    ? 'purple.50'
                    : 'gray.50'
                }
                borderRadius="12px"
                borderLeft="4px solid"
                borderColor={
                  completedItems[item.id]
                    ? 'green.500'
                    : selectedItems[item.id]
                    ? 'purple.500'
                    : 'gray.300'
                }
                transition="all 0.3s"
              >
                <HStack justify="space-between" mb={3}>
                  <HStack>
                    <Checkbox
                      isChecked={selectedItems[item.id] || false}
                      onChange={() => handleCheckboxChange(item.id)}
                      isDisabled={isExecuting || completedItems[item.id]}
                      colorScheme={getColorScheme(item.type)}
                      size="lg"
                    />
                    <Icon as={getIcon(item.type)} boxSize={5} color={`${getColorScheme(item.type)}.500`} />
                    <Text fontWeight="bold">{item.title}</Text>
                  </HStack>

                  <HStack>
                    {!completedItems[item.id] && !isExecuting && item.type !== 'report' && (
                      <IconButton
                        icon={<FiEdit2 />}
                        size="sm"
                        variant="ghost"
                        colorScheme="blue"
                        onClick={() => handleEditClick(item)}
                        aria-label="편집"
                      />
                    )}
                    {completedItems[item.id] ? (
                      <Badge colorScheme="green" fontSize="sm">
                        ✓ 완료
                      </Badge>
                    ) : (
                      <Badge colorScheme={getColorScheme(item.type)} fontSize="sm">
                        {item.estimatedTime}
                      </Badge>
                    )}
                  </HStack>
                </HStack>

                <Text fontSize="sm" color="gray.600" mb={2} ml={8}>
                  {item.description}
                </Text>

                {/* 상세 정보 */}
                {item.details && (
                  <Box ml={8} p={3} bg="white" borderRadius="8px" fontSize="sm">
                    {item.type === 'calendar' && (
                      <VStack align="stretch" spacing={1}>
                        <HStack>
                          <Text fontWeight="bold">제목:</Text>
                          <Text>{item.details.title}</Text>
                        </HStack>
                        <HStack>
                          <Text fontWeight="bold">날짜:</Text>
                          <Text>{item.details.date} {item.details.time}</Text>
                        </HStack>
                        <HStack>
                          <Text fontWeight="bold">참석자:</Text>
                          <Text>{item.details.attendees.join(', ')}</Text>
                        </HStack>
                      </VStack>
                    )}

                    {item.type === 'email' && (
                      <VStack align="stretch" spacing={1}>
                        <HStack>
                          <Text fontWeight="bold">수신:</Text>
                          <Text>{item.details.recipients.length}명</Text>
                        </HStack>
                        <HStack>
                          <Text fontWeight="bold">제목:</Text>
                          <Text>{item.details.subject}</Text>
                        </HStack>
                      </VStack>
                    )}

                    {item.type === 'todo' && (
                      <VStack align="stretch" spacing={2}>
                        <HStack>
                          <Text fontWeight="bold">생성 개수:</Text>
                          <Text>{item.details.count}개</Text>
                        </HStack>
                        {item.details.todoItems && item.details.todoItems.length > 0 && (
                          <Box>
                            <Text fontWeight="bold" fontSize="xs" mb={1} color="gray.700">TO-DO LIST:</Text>
                            <VStack align="stretch" spacing={1} pl={2}>
                              {item.details.todoItems.map((todo, idx) => (
                                <HStack key={idx} fontSize="xs" spacing={2}>
                                  <Badge colorScheme="orange" fontSize="xs">{idx + 1}</Badge>
                                  <Text flex="1">{todo.task}</Text>
                                  <Text color="gray.600">({todo.assignee})</Text>
                                  <Text color="gray.500" fontSize="xs">{todo.deadline}</Text>
                                </HStack>
                              ))}
                            </VStack>
                          </Box>
                        )}
                      </VStack>
                    )}

                    {item.type === 'report' && (
                      <VStack align="stretch" spacing={1}>
                        <HStack>
                          <Text fontWeight="bold">수신:</Text>
                          <Text>{item.details.recipient}</Text>
                        </HStack>
                        <HStack>
                          <Text fontWeight="bold">포함 내용:</Text>
                          <Text>{item.details.contents.join(', ')}</Text>
                        </HStack>
                      </VStack>
                    )}
                  </Box>
                )}
              </Box>
            ))}
          </VStack>

          {/* 승인 버튼 */}
          {!isExecuting && (
            <Button
              size="lg"
              colorScheme="purple"
              onClick={handleApprove}
              isDisabled={selectedCount === 0}
              bgGradient="linear(to-r, primary.500, secondary.500)"
              _hover={{
                bgGradient: 'linear(to-r, primary.600, secondary.600)',
                transform: 'scale(1.02)',
              }}
              transition="all 0.2s"
            >
              선택한 {selectedCount}개 작업 실행하기
            </Button>
          )}
        </VStack>
      </Card>

      {/* 편집 모달 */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>항목 편집</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {editingItem && (
              <VStack spacing={4} align="stretch">
                <Box>
                  <Text fontWeight="bold" mb={2}>제목</Text>
                  <Input
                    value={editingItem.title}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, title: e.target.value })
                    }
                  />
                </Box>

                <Box>
                  <Text fontWeight="bold" mb={2}>설명</Text>
                  <Textarea
                    value={editingItem.description}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, description: e.target.value })
                    }
                    rows={3}
                  />
                </Box>

                {editingItem.type === 'calendar' && editingItem.details && (
                  <>
                    <Box>
                      <Text fontWeight="bold" mb={2}>일정 제목</Text>
                      <Input
                        value={editingItem.details.title}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            details: { ...editingItem.details, title: e.target.value },
                          })
                        }
                      />
                    </Box>
                    <HStack>
                      <Box flex="1">
                        <Text fontWeight="bold" mb={2}>날짜</Text>
                        <Input
                          type="date"
                          value={editingItem.details.date}
                          onChange={(e) =>
                            setEditingItem({
                              ...editingItem,
                              details: { ...editingItem.details, date: e.target.value },
                            })
                          }
                        />
                      </Box>
                      <Box flex="1">
                        <Text fontWeight="bold" mb={2}>시간</Text>
                        <Input
                          type="time"
                          value={editingItem.details.time}
                          onChange={(e) =>
                            setEditingItem({
                              ...editingItem,
                              details: { ...editingItem.details, time: e.target.value },
                            })
                          }
                        />
                      </Box>
                    </HStack>
                  </>
                )}

                {editingItem.type === 'email' && editingItem.details && (
                  <>
                    <Box>
                      <Text fontWeight="bold" mb={2}>메일 제목</Text>
                      <Input
                        value={editingItem.details.subject}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            details: { ...editingItem.details, subject: e.target.value },
                          })
                        }
                      />
                    </Box>
                  </>
                )}
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              취소
            </Button>
            <Button colorScheme="blue" onClick={handleSaveEdit}>
              저장
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}

export default ApprovalCenter
