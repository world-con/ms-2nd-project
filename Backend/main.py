import os
import uuid
import time
import asyncio # 추가 : 비동기 대기용
import httpx # 추가 : 비동기 요청용
from datetime import datetime, timedelta
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import requests
from typing import List

# 모듈 import
import outlook_service
import llm_agent
import rag_service

# Azure
from openai import AzureOpenAI

# 환경변수 로드
load_dotenv()

app = FastAPI()

# CORS 설정
origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Calendar DTO 정의 ---
class CalendarRequest(BaseModel):
    title: str
    date: str
    time: str
    attendees: List[str]

class TodoRequest(BaseModel):
    title: str
    content: str = None


# --- 설정값 ---
LOGIC_APP_URL = os.getenv("LOGIC_APP_URL_MAIL")

# 팀원 리스트
team_members = [
    "alfzm1024@naver.com",
    "parkjs801801@gmail.com",
    "hyenajeon37@gmail.com",
    "chaehun61@gmail.com",
    "kkst01221203@gmail.com",
    "hntexhibit@gmail.com"
]

client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
)
DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")

# --- 데이터 모델 ---
class EmailRequest(BaseModel):
    summary_text: str

class ChatRequest(BaseModel):
    message: str

# 1. 챗봇 질문
@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    print(f"💬 질문: {request.message}")
    try:
        # llm_agent에게 질문을 넘기면 llm_agent가 내부적으로 판단하도록 코드 수정
        answer = llm_agent.process_chat_request(request.message)
        return {"answer": answer}
    except Exception as e:
        print(f"에러: {e}")
        return {"answer": "죄송합니다. 처리 중 오류가 발생했습니다."}

# 2. [분석 단계] 요약 + DB저장 (메일 전송 X)
@app.post("/analyze-meeting")
async def analyze_meeting(request: EmailRequest):
    print("🧠 회의 분석 및 DB 저장 시작...")

    if len(request.summary_text.strip()) < 5:
        return {"status": "success", "summary": "내용이 너무 짧습니다."}

    try:
        response = client.chat.completions.create(
            model=DEPLOYMENT_NAME,
            messages=[
                {"role": "system", "content": "회의 내용을 [핵심요약/결정사항/할일] 로 요약해. HTML 태그 없이 텍스트만 줘."},
                {"role": "user", "content": request.summary_text}
            ]
        )
        ai_summary = response.choices[0].message.content
        
        # DB 저장
        rag_service.save_to_vector_db(ai_summary)

        # 요약본만 반환
        return {"status": "success", "summary": ai_summary}

    except Exception as e:
        print(f"❌ AI 에러: {e}")
        if "content_filter" in str(e):
            return {"status": "success", "summary": "⚠️ 보안 필터가 작동했습니다."}
        return {"status": "error", "message": str(e)}

# [자동화 기능 탭] 메일 전송 (요약 X)
# 사용자가 '승인' 버튼 누르면 실행됨
@app.post("/api/execute-action")
async def execute_action(request: EmailRequest):
    print("🚀 사용자 승인 완료! 메일 전송 시작...")
    
    ai_summary = request.summary_text
    formatted_summary = ai_summary.replace("\n", "<br>")

    html_body = f"""
    <div style="border: 1px solid #ddd; padding: 20px;">
        <h2>📢 AI 회의 요약</h2>
        <hr>{formatted_summary}<hr>
        <p>※ 관리자 승인 후 발송된 메일입니다.</p>
    </div>
    """

    count = 0
    # 서버 멈춤 방지
    async with httpx.AsyncClient() as http_client:
        for member in team_members:
            try:
                requests.post(LOGIC_APP_URL, json={"email": member, "subject": "[이음] 회의 결과 리포트", "body": html_body})
                count += 1
                await asyncio.sleep(0.3)
            except: pass

    return {"status": "success", "sent_count": count}

# [추가] Outlook Todo 생성 엔드포인트
@app.post("/api/create-outlook-task")
async def create_outlook_task(request: TodoRequest):
    print(f"📝 Outlook Todo 생성 요청: {request.title}")
    success, msg = outlook_service.create_todo_task(request.title, request.content)
    
    if success:
        return {"status": "success", "message": "작업이 등록되었습니다."}
    else:
        raise HTTPException(status_code=500, detail=msg)

# [실행 단계] 일정 자동화 기능
@app.post("/api/approve-calendar")
async def approve_calendar(item: CalendarRequest):
    try:
        # 1. 문자열 데이터를 datetime 객체로 변환
        # item.date: "2024-05-25", item.time: "14:00" 가정
        start_str = f"{item.date}T{item.time}:00"
        start_dt = datetime.strptime(start_str, "%Y-%m-%dT%H:%M:%S")
        
        # 2. 종료 시간 계산 (기본 1시간 추가)
        end_dt = start_dt + timedelta(hours=1)
        
        # 3. 다시 문자열로 변환 (ISO 8601 형식)
        end_str = end_dt.strftime("%Y-%m-%dT%H:%M:%S")

        # 4. Outlook 포맷으로 변환
        event_body = {
            "subject": item.title,
            "body": {
                "contentType": "Text", 
                "content": "이 일정은 관리자(사용자)에 의해 승인되어 등록되었습니다."
            },
            "start": {
                "dateTime": start_str, 
                "timeZone": "Korea Standard Time"
            },
            "end": {
                "dateTime": end_str, # 계산된 종료 시간 사용
                "timeZone": "Korea Standard Time"
            }, 
        }
        
        # 5. 공통 모듈 호출
        success, msg = outlook_service.send_event_to_logic_app(event_body)
        
        if not success:
            # 실패 시 500 에러와 함께 원인 메시지 반환
            raise HTTPException(status_code=500, detail=f"Outlook 연동 실패: {msg}")
            
        return {"status": "success", "message": "일정이 정상적으로 등록되었습니다."}

    except ValueError:

        # 날짜 형식이 잘못 들어왔을 때 처리
        raise HTTPException(status_code=400, detail="날짜/시간 형식이 올바르지 않습니다.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))