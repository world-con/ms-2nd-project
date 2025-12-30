# Backend 주요 변경사항

2025-12-30 : 일정 관리 기능 + 메일 전송 기능 통합

### 1. main2.py  
: 원하는 요청에 맞게 서비스 또는 에이전트로 전달하는 역할

/api/chat : 사용자 입력을 llm_agent로 넘겨 처리 결과 반환

/analyze-meeting : 회의록 텍스트를 요약하고 rag_service를 통해 Vector DB에 저장

/api/execute-action : 비동기 형식으로 Logic App에 메일 발송 요청

### 2. llm_agent.py 
: 사용자의 입력메시지를 해석하여 “검색이 필요한지”, “일정 등록이 필요한지”, “단순 대화인지” 판단

tools 정의를 통해 OpenAI에게 사용 가능한 함수를 알려주는 역할

(register_calendar_event, search_knowledge_base)

주요 로직 : tool_choice=”auto”를 통해 AI가 스스로 도구 사용 여부 결정

### 3. rag_service.py 
: RAG(검색 증강 생성)관련 기능을 전담하는 모듈

주요 로직 : 

search_documents : Azure AI Search에서 하이브리드 검색 수행

save_to_vector_db : 텍스트 임베딩 후 DB 저장

ask_bot : 검색된 문서를 바탕으로 답변 생성(Generation)

### 4. outlook_service.py

: Calendar 관련 Logic App 및 Microsoft Graph API 통신 담당

주요 로직 : 

MSAL 인증 & 캐싱 : token_cache.bin을 사용하여 불필요한 재로그인 을 방지하고 토큰을 효율적으로 관리

send_event_to_logic_app : Outlook 일정 등록을 위한 Logic App 호출

효율성 : 인증 로직이 모듈화 되어있기 때문에 다른 파일에서 쉽게 사용 가능
