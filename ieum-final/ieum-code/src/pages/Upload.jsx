import React, { useState } from 'react'
import {
  Box,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Icon,
  List,
  ListItem,
  Badge,
  useToast,
  Progress,
} from '@chakra-ui/react'
import { FiUpload, FiFile, FiTrash2, FiCheckCircle } from 'react-icons/fi'
import Card from '../components/Card'

function Upload() {
  const [uploadedFiles, setUploadedFiles] = useState([
    {
      id: 1,
      name: '2024년 마케팅 전략.pdf',
      size: '2.3 MB',
      type: 'PDF',
      uploadDate: '2025-12-20',
      status: 'completed',
    },
    {
      id: 2,
      name: '개발 가이드라인.docx',
      size: '1.1 MB',
      type: 'DOCX',
      uploadDate: '2025-12-22',
      status: 'completed',
    },
  ])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const toast = useToast()

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files)
    
    if (files.length === 0) return

    // 업로드 시뮬레이션
    setIsUploading(true)
    setUploadProgress(0)

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsUploading(false)

          // 파일 추가
          const newFiles = files.map((file, index) => ({
            id: Date.now() + index,
            name: file.name,
            size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
            type: file.name.split('.').pop().toUpperCase(),
            uploadDate: new Date().toISOString().split('T')[0],
            status: 'completed',
          }))

          setUploadedFiles([...newFiles, ...uploadedFiles])

          toast({
            title: '업로드 완료! 🎉',
            description: `${files.length}개 파일이 RAG 시스템에 추가되었습니다`,
            status: 'success',
            duration: 3000,
          })

          return 0
        }
        return prev + 10
      })
    }, 200)
  }

  const handleDelete = (id) => {
    setUploadedFiles(uploadedFiles.filter((file) => file.id !== id))
    toast({
      title: '파일 삭제됨',
      description: 'RAG 데이터베이스에서 제거되었습니다',
      status: 'info',
      duration: 2000,
    })
  }

  return (
    <Box>
      <Heading size="xl" mb={6}>
        📤 RAG 데이터 업로드
      </Heading>

      {/* 업로드 영역 */}
      <Card mb={6} bg="linear-gradient(135deg, #4811BF 0%, #8C5CF2 100%)">
        <VStack spacing={4}>
          <Icon as={FiUpload} boxSize={12} color="white" />
          <Heading size="md" color="white">
            회의 자료를 업로드하세요
          </Heading>
          <Text color="whiteAlpha.900" textAlign="center">
            PDF, DOCX 파일을 업로드하면 이음 AI가 자동으로 분석하여
            <br />
            회의 중 관련 내용을 찾아드립니다
          </Text>

          <Button
            as="label"
            htmlFor="file-upload"
            size="lg"
            bg="white"
            color="primary.500"
            leftIcon={<FiUpload />}
            cursor="pointer"
            _hover={{ transform: 'scale(1.05)' }}
            transition="all 0.2s"
            isDisabled={isUploading}
          >
            파일 선택
          </Button>
          <input
            id="file-upload"
            type="file"
            accept=".pdf,.docx,.doc"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />

          <Text fontSize="xs" color="whiteAlpha.800">
            지원 형식: PDF, DOCX | 최대 파일 크기: 10MB
          </Text>
        </VStack>
      </Card>

      {/* 업로드 진행률 */}
      {isUploading && (
        <Card mb={6}>
          <VStack spacing={3}>
            <HStack w="full" justify="space-between">
              <Text fontWeight="bold">업로드 중...</Text>
              <Text fontSize="sm" color="gray.600">
                {uploadProgress}%
              </Text>
            </HStack>
            <Progress
              value={uploadProgress}
              size="lg"
              colorScheme="purple"
              w="full"
              borderRadius="full"
              hasStripe
              isAnimated
            />
          </VStack>
        </Card>
      )}

      {/* 업로드된 파일 목록 */}
      <Card>
        <HStack justify="space-between" mb={4}>
          <Heading size="md">업로드된 파일</Heading>
          <Badge colorScheme="purple" fontSize="md">
            {uploadedFiles.length}개
          </Badge>
        </HStack>

        {uploadedFiles.length === 0 ? (
          <Box textAlign="center" py={8} color="gray.500">
            <Text>아직 업로드된 파일이 없습니다</Text>
            <Text fontSize="sm" mt={2}>
              위 버튼을 클릭하여 파일을 추가해보세요
            </Text>
          </Box>
        ) : (
          <List spacing={3}>
            {uploadedFiles.map((file) => (
              <ListItem key={file.id}>
                <HStack
                  p={4}
                  bg="gray.50"
                  borderRadius="12px"
                  justify="space-between"
                  _hover={{ bg: 'gray.100' }}
                  transition="all 0.2s"
                >
                  <HStack spacing={4} flex="1">
                    <Icon as={FiFile} boxSize={6} color="primary.500" />
                    <VStack align="start" spacing={0} flex="1">
                      <Text fontWeight="bold">{file.name}</Text>
                      <HStack fontSize="xs" color="gray.600">
                        <Badge colorScheme="purple">{file.type}</Badge>
                        <Text>{file.size}</Text>
                        <Text>·</Text>
                        <Text>{file.uploadDate}</Text>
                      </HStack>
                    </VStack>
                    {file.status === 'completed' && (
                      <Icon as={FiCheckCircle} color="green.500" />
                    )}
                  </HStack>

                  <Button
                    size="sm"
                    colorScheme="red"
                    variant="ghost"
                    leftIcon={<FiTrash2 />}
                    onClick={() => handleDelete(file.id)}
                  >
                    삭제
                  </Button>
                </HStack>
              </ListItem>
            ))}
          </List>
        )}
      </Card>

      {/* 안내 사항 */}
      <Card mt={6} bg="blue.50">
        <VStack align="start" spacing={2}>
          <Heading size="sm" color="blue.700">
            💡 RAG 시스템 안내
          </Heading>
          <Text fontSize="sm" color="blue.700" lineHeight="1.8">
            • 업로드된 파일은 벡터 데이터베이스에 저장됩니다
            <br />
            • 회의 중 AI 비서가 관련 내용을 자동으로 찾아드립니다
            <br />
            • 과거 회의록과 연결하여 미해결 이슈를 추적합니다
            <br />• 보안을 위해 암호화되어 저장되며, 프로젝트 종료 후 3개월 뒤
            자동 삭제됩니다
          </Text>
        </VStack>
      </Card>
    </Box>
  )
}

export default Upload
