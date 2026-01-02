# pip install fastapi uvicorn

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import shutil
import os

# 기존에 만든 모듈 불러오기 (upload_pipeline.py, rag_engine.py, delete_manager.py)
from upload_pipeline import upload_file_to_rag, search_client
from rag_engine import ask_bot
from delete_manager import delete_file_and_index

app = FastAPI()

# ==========================================
# 1. CORS 설정 (프론트엔드 포트 허용)
# ==========================================
origins = [
    "http://localhost:5173",    # Vite 기본 포트
    "http://localhost:3000",    # CRA 기본 포트
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 2. 데이터 모델 정의
# ==========================================
class ChatRequest(BaseModel):
    message: str
    category: Optional[str] = "history"

class DeleteRequest(BaseModel):
    filename: str
    category: str

# ==========================================
# 3. API 엔드포인트
# ==========================================
@app.get("/")
def read_root():
    return {"status": "Backend is running"}

# [파일 목록 조회]
@app.get("/files")
def get_uploaded_files():
    try:
        # Azure AI Search에서 모든 문서의 메타데이터 조회 (필요한 필드만)
        results = search_client.search(
            search_text="*",
            select=["id", "title", "category", "created_at", "file_url", "size"],
            top=1000    # 충분한 개수
        )
        
        file_list = []
        seen_files = set()  # 청킹으로 인해 중복된 파일명 제거

        for doc in results:
            # Search 데이터가 가끔 None일 수 있으므로 안전하게 처리
            title = doc.get('title', 'Untitled')
            category = doc.get('category', 'reference')

            # (제목, 카테고리) 쌍으로 중복 검사
            unique_key = (title, category)

            # 청크 단위로 저장되어 있어서 파일명이 중복될 수 있음 -> 중복 제거
            if unique_key not in seen_files:
                seen_files.add(unique_key)
                file_list.append({
                    "id": doc['id'],
                    "name": title,
                    "category": category, # history, style, reference
                    "uploadDate": doc.get('created_at', '').split("T")[0] if doc['created_at'] else "",
                    "url": doc.get('file_url', ''),
                    "size": doc.get('size', "Unknown")
                })
        
        return {"files": file_list}

    except Exception as e:
        print(f"Error fetching files: {e}")
        raise HTTPException(status_code=500, detail=str(e))

ALLOWED_EXTENSIONS = {
    "history": {".pdf", ".docx"},       # 회의록: PDF, Word
    "style": {".docx"},                 # 템플릿: Word Only (수정용)
    "reference": {".pdf", ".docx", ".txt"} # 참고 자료: 텍스트 기반 문서
}

# [파일 업로드]
@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...), 
    category: str = Form(...) # 'ieum'(history), 'custom'(style), 'external'(reference)
):
    try:
        # 1. 카테고리 매핑 (Frontend 섹션 -> Backend 카테고리)
        category_map = {
            "ieum": "history",
            "custom": "style",
            "external": "reference",
            "history": "history",
            "style": "style",
            "reference": "reference"
        }
        target_category = category_map.get(category, "reference")

        # 2. 파일 확장자 검사
        file_ext = os.path.splitext(file.filename)[1].lower()
        allowed_list = ALLOWED_EXTENSIONS.get(target_category, set())
        if file_ext not in allowed_list:
            error_msg = f"'{target_category}' 카테고리는 {file_ext} 형식을 지원하지 않습니다. (지원: {', '.join(allowed_list)})"
            raise HTTPException(status_code=400, detail=error_msg)

        # 3. 임시 파일 저장
        temp_dir = "temp_uploads"
        os.makedirs(temp_dir, exist_ok=True)
        file_path = os.path.join(temp_dir, file.filename)
        
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
             raise HTTPException(status_code=500, detail=f"파일 저장 실패: {str(e)}")

        # 4. RAG 파이프라인 실행
        container_name = target_category    # 컨테이너 이름도 카테고리와 동일하게 사용
        upload_file_to_rag(file_path, target_category, container_name)
        
        # 5. 임시 파일 삭제
        os.remove(file_path)
        
        return {"filename": file.filename, "status": "success"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        print(f"Server Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# [채팅 / 질문하기]
@app.post("/chat")
def chat_endpoint(request: ChatRequest):
    try:
        # RAG 엔진 호출
        answer = ask_bot(request.message, target_category=request.category)
        return {"response": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# [파일 삭제]
@app.delete("/delete")
def delete_endpoint(request: DeleteRequest):
    try:
        category_map = {
            "ieum": "history",
            "custom": "style",
            "external": "reference",
            "history": "history",
            "style": "style",
            "reference": "reference"
        }
        container_name = category_map.get(request.category, "reference")
        
        delete_file_and_index(request.filename, container_name)
        return {"status": "deleted", "filename": request.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# 메인 실행
# ==========================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)