import os
import uuid
import time
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import requests

# Azure & LangChain
from openai import AzureOpenAI
from langchain_openai import AzureOpenAIEmbeddings, AzureChatOpenAI
from azure.search.documents import SearchClient
from azure.core.credentials import AzureKeyCredential

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

# --- 설정값 ---
LOGIC_APP_URL = os.getenv("LOGIC_APP_URL")
SEARCH_ENDPOINT = os.getenv("AZURE_SEARCH_ENDPOINT")
SEARCH_KEY = os.getenv("AZURE_SEARCH_API_KEY")
INDEX_NAME = os.getenv("AZURE_SEARCH_INDEX_NAME")

# 팀원 리스트
team_members = [
    "alfzm1024@naver.com",
    "parkjs801801@gmail.com",
    "hyenajeon37@gmail.com",
    "chaehun61@gmail.com",
    "kkst01221203@gmail.com",
    "hntexhibit@gmail.com"
]

# --- AI 모델 설정 ---
embeddings = AzureOpenAIEmbeddings(
    azure_deployment="text-embedding-ada-002",
    openai_api_version="2023-05-15", # 임베딩용 버전 확인
)

chat_llm = AzureChatOpenAI(
    azure_deployment="o4-mini", # 본인 챗봇 배포명 확인
    openai_api_version="2024-12-01-preview",
)

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
    question: str

# --- 내부 함수: RAG 검색 ---
def search_documents(query):
    try:
        search_client = SearchClient(SEARCH_ENDPOINT, INDEX_NAME, AzureKeyCredential(SEARCH_KEY))
        query_vector = embeddings.embed_query(query)
        results = search_client.search(
            search_text=query,
            vector_queries=[{"kind": "vector", "k": 3, "fields": "content_vector", "vector": query_vector}],
            select=["content", "source"]
        )
        found_context = ""
        for r in results:
            found_context += f"[출처: {r['source']}]\n{r['content']}\n\n"
        return found_context if found_context else "관련 정보 없음"
    except Exception as e:
        print(f"검색 에러: {e}")
        return ""

# --- 내부 함수: DB 저장 ---
def save_to_vector_db(summary_text):
    print("💾 요약본을 DB(Azure Search)에 저장 중...")
    try:
        search_client = SearchClient(SEARCH_ENDPOINT, INDEX_NAME, AzureKeyCredential(SEARCH_KEY))
        vector = embeddings.embed_query(summary_text)
        doc = {
            "id": str(uuid.uuid4()),
            "content": summary_text,
            "source": f"{datetime.now().strftime('%Y-%m-%d %H:%M')} 회의 요약",
            "content_vector": vector
        }
        search_client.upload_documents(documents=[doc])
        print("✅ DB 저장 완료!")
        return True
    except Exception as e:
        print(f"❌ DB 저장 실패: {e}")
        return False

# ===========================
# API 엔드포인트
# ===========================

# 1. 챗봇 질문
@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    print(f"💬 질문: {request.question}")
    context = search_documents(request.question)
    prompt = f"회의록 기반 비서입니다. 내용에 없으면 모른다고 하세요.\n[내용]\n{context}\n[질문]\n{request.question}"
    response = chat_llm.invoke(prompt)
    return {"answer": response.content}

# 2. [분석 단계] 요약 + DB저장 (메일 전송 X)
# 이름을 /analyze-meeting 으로 변경했습니다. (의도가 명확해짐)
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
        save_to_vector_db(ai_summary)

        # 요약본만 반환 (메일 안 보냄)
        return {"status": "success", "summary": ai_summary}

    except Exception as e:
        print(f"❌ AI 에러: {e}")
        if "content_filter" in str(e):
            return {"status": "success", "summary": "⚠️ 보안 필터가 작동했습니다."}
        return {"status": "error", "message": str(e)}

# 3. [실행 단계] 메일 전송 (요약 X)
# 사용자가 '승인' 버튼 누르면 실행됨
@app.post("/execute-action")
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
    for member in team_members:
        try:
            requests.post(LOGIC_APP_URL, json={"email": member, "subject": "[이음] 회의 결과 리포트", "body": html_body})
            count += 1
            time.sleep(0.3)
        except: pass

    return {"status": "success", "sent_count": count}