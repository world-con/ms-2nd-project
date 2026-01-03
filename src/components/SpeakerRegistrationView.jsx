import React, { useState, useRef } from "react";
import {
    Box,
    Heading,
    Text,
    Button,
    VStack,
    HStack,
    Circle,
    Input,
    Badge,
} from "@chakra-ui/react";
import Card from "./Card";
import { useAppContext } from "../context/AppContext";

const SpeakerRegistrationView = () => {
    const {
        handleRegisterSpeaker,
        handleStartRecording,
        backendStatus,
        setFlowState // [NEW] Add setFlowState for back navigation
    } = useAppContext();

    const [speakers, setSpeakers] = useState([
        { id: 1, name: "", email: "", isRecording: false, progress: 0, isDone: false },
        { id: 2, name: "", email: "", isRecording: false, progress: 0, isDone: false },
        { id: 3, name: "", email: "", isRecording: false, progress: 0, isDone: false },
        { id: 4, name: "", email: "", isRecording: false, progress: 0, isDone: false },
        { id: 5, name: "", email: "", isRecording: false, progress: 0, isDone: false },
        { id: 6, name: "", email: "", isRecording: false, progress: 0, isDone: false },
    ]);
    const [activeId, setActiveId] = useState(null);
    const [isAgreed, setIsAgreed] = useState(false);
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
                    if (result?.status === "queued") {
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

            let p = 0;
            // [Modified] 40초 기준 (1초에 2.5%씩 증가)
            const interval = setInterval(() => {
                p += 2.5;
                setSpeakers(prev => prev.map(s => s.id === id ? { ...s, progress: p } : s));
                if (p >= 100) {
                    clearInterval(interval);
                    if (mr.state === "recording") {
                        mr.stop();
                        stream.getTracks().forEach(t => t.stop());
                    }
                    setActiveId(null);
                }
            }, 1000);

            // [NEW] 수동 종료를 위한 onstop 핸들러 보강 (progress interval 정리)
            const originalOnStop = mr.onstop;
            mr.onstop = async () => {
                clearInterval(interval); // 수동 종료 시 타이머 즉시 해제
                stream.getTracks().forEach(t => t.stop());
                setActiveId(null);
                await originalOnStop();
            };
        });
    };

    const hasAnyRegistered = speakers.some(s => s.isDone);

    const handleCancel = () => {
        // [NEW] Back logic
        setFlowState("idle");
    };

    return (
        <Box maxW="600px" mx="auto" py={10}>
            <Card shadow="xl" borderRadius="20px">
                <VStack spacing={6}>
                    <HStack w="full" justify="space-between">
                        <Heading size="md" color="purple.600">👥 회의 참가자 목소리 등록</Heading>
                        <Button size="xs" variant="ghost" onClick={handleCancel}>나가기</Button>
                    </HStack>

                    <Text fontSize="sm" color="gray.500" textAlign="center">
                        정확한 화자 분리를 위해 참가자의 목소리를 20초간 등록합니다.<br />
                        <b>[녹음시작]</b> 버튼을 누른 후 아래 가이드 문구를 편하게 읽어주세요.
                    </Text>

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
                                    colorScheme={s.isDone ? "green" : (s.isRecording ? "red" : "purple")}
                                    onClick={() => {
                                        if (s.isRecording) {
                                            // [NEW] 녹음 중 클릭 시 수동 종료
                                            const mr = speakerMediaRef.current;
                                            if (mr && mr.state === "recording") {
                                                mr.stop();
                                            }
                                        } else {
                                            if (!isAgreed) return alert("먼저 개인정보 활용 동의에 체크해주세요.");
                                            startRegRecording(s.id);
                                        }
                                    }}
                                    isDisabled={s.isDone || (activeId !== null && activeId !== s.id && !s.isRecording)}
                                    w="100px"
                                    _hover={{ transform: "scale(1.05)" }}
                                >
                                    {s.isDone ? (s.isQueued ? "전송대기" : "등록완료") : (s.isRecording ? "중단하기" : "녹음시작")}
                                </Button>
                            </HStack>
                        ))}
                    </VStack>

                    <Button
                        size="lg"
                        colorScheme="purple"
                        w="full"
                        isDisabled={!hasAnyRegistered}
                        onClick={handleStartRecording}
                        boxShadow="lg"
                    >
                        회의 시작하기
                    </Button>

                    <Button size="sm" variant="link" color="gray.500" onClick={handleCancel}>
                        등록 취소하고 돌아가기
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

export default SpeakerRegistrationView;
