🚀 Backend & AI Integration (기능 구현 명세서)
기존 Frontend UI(React/Chakra UI)에 Azure AI 서비스와 FastAPI 백엔드를 연동하여 실제 작동하는 MVP를 구현했습니다.

🏗 System Architecture
Microservice-like Workflow: 프론트엔드는 UI에 집중하고, 복잡한 AI 연산과 외부 연동은 백엔드 및 Azure PaaS가 전담하는 구조입니다.

graph TD
    User[User / React Frontend] -->|1. 음성 입력| STT[Azure AI Speech]
    User -->|2. 텍스트 전송| FastAPI[Python Backend]
    
    subgraph "AI Processing"
        FastAPI -->|3. 요약 요청| GPT[Azure OpenAI (GPT-4o)]
        FastAPI -->|4. 벡터화 & 저장| VectorDB[Azure AI Search (RAG)]
    end
    
    subgraph "Automation"
        FastAPI -->|5. 실행 트리거| LogicApp[Azure Logic Apps]
        LogicApp -->|6. 메일/일정 발송| Outlook[Outlook/Gmail]
    end
    
    VectorDB -.->|7. 챗봇 질문 시 검색| GPT
💻 Frontend Integration Details (주요 구현 사항)
팀원이 구축한 ieum-frontend 구조를 유지하면서, Logic Injection 패턴으로 기능을 이식했습니다.

1. 프록시 설정 (vite.config.js)
React(5173)와 FastAPI(8000) 간의 CORS 문제 해결을 위해 개발 서버 프록시(/api -> localhost:8000)를 설정했습니다.
2. 전역 상태 관리 (AppContext.jsx)
페이지가 전환되어도 녹음 데이터가 유지되도록 transcript(녹음본)와 aiSummary(요약본) 상태를 전역 Context에 추가했습니다.
3. 실시간 STT 연동 (Meeting.jsx)
구현: Microsoft Cognitive Services Speech SDK를 활용하여 웹 브라우저 마이크 스트림을 실시간 텍스트로 변환.
특징: 기존 타이머 및 애니메이션 UI를 건드리지 않고, useEffect 훅을 통해 백그라운드에서 녹음 프로세스가 동작하도록 구현했습니다.
4. 자동화 승인 프로세스 (Result.jsx & ApprovalCenter.jsx)
Logic: 페이지 진입 시 /analyze-meeting API를 호출하여 요약 및 DB 저장만 수행(메일 발송 X).
Human-in-the-loop: 사용자가 승인 센터에서 체크박스를 선택하고 [실행하기] 버튼을 눌렀을 때만 /execute-action API가 호출되어 실제 메일이 발송되도록 구현했습니다.
Props Drilling: 상위 컴포넌트(Result)의 백엔드 통신 함수를 하위 컴포넌트(ApprovalCenter)로 전달하여, UI 컴포넌트의 재사용성을 높였습니다.
☁️ Backend & Cloud Services
1. FastAPI Server (main.py)
API 분리: 분석(Analyze)과 실행(Execute)을 분리하여 사용자 경험(UX) 최적화.
Safety Guard: Azure Content Filter 에러 방지를 위한 try-except 예외 처리 및 텍스트 길이 검증 로직 추가.


3. Workflow Automation
Azure Logic Apps: SMTP 설정 등 복잡한 코드 없이, HTTP 트리거 방식을 통해 이메일 대량 발송 및 일정 등록 자동화 구현.
