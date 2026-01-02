# pip install fastapi uvicorn

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os, shutil, uuid

# 만든 모듈 불러오기 (upload_pipeline.py, rag_engine.py, delete_manager.py, meeting_doc_generator.py)
from upload_pipeline import upload_file_to_rag, search_client, blob_service_client
from rag_engine import ask_bot
from delete_manager import delete_file_and_index
from meeting_doc_generator import extract_text_with_coordinates, get_coordinates_json_from_llm, update_docx_by_coordinates

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

class MeetingSummaryData(BaseModel):
    summary_text: str

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

# [커스텀 회의록 파일 생성]
@app.post("/generate-minutes")
async def generate_minutes(data: MeetingSummaryData):
    try:
        # 1. 작업용 임시 폴더 생성
        temp_dir = "temp_processing"
        os.makedirs(temp_dir, exist_ok=True)
        
        # 기본 템플릿 경로 (프로젝트 루트에 default_template.docx 필수!)
        default_template_name = "default_template.docx"
        local_template_path = os.path.join(temp_dir, "current_template.docx")
        
        # 2. 템플릿 결정 로직 (Azure Blob 'style' 컨테이너 확인)
        used_template_source = "Default"
        try:
            container_client = blob_service_client.get_container_client("style")
            
            # 컨테이너가 존재하면 파일 목록 확인
            if container_client.exists():
                blobs_list = list(container_client.list_blobs())
                if blobs_list:
                    # 가장 최근 파일 가져오기 (이름순 정렬 후 마지막 것 사용)
                    # 실제 운영에선 created_on 속성으로 정렬 추천
                    latest_blob = sorted(blobs_list, key=lambda b: b.name)[-1]
                    
                    print(f"📥 커스텀 템플릿 다운로드: {latest_blob.name}")
                    with open(local_template_path, "wb") as f:
                        f.write(container_client.download_blob(latest_blob.name).readall())
                    used_template_source = "Custom (Azure Blob)"
                else:
                    raise Exception("스타일 컨테이너가 비어있음")
            else:
                raise Exception("스타일 컨테이너 없음")
                
        except Exception as e:
            print(f"커스텀 템플릿 사용 불가 ({e}) -> 기본 템플릿 사용")
            if os.path.exists(default_template_name):
                shutil.copy(default_template_name, local_template_path)
            else:
                raise HTTPException(status_code=500, detail="서버에 기본 템플릿(default_template.docx)이 없습니다.")

        print(f"✅ 템플릿 준비 완료: {used_template_source}")

        # 3. 문서 생성 프로세스 (RAG Logic)
        
        # A. 템플릿 좌표 읽기
        coords_text = extract_text_with_coordinates(local_template_path)
        
        # B. LLM에게 매핑 요청
        llm_result = get_coordinates_json_from_llm(coords_text, data.summary_text)
        
        # C. 문서 내용 교체 및 저장
        output_filename = f"meeting_result_{uuid.uuid4().hex[:8]}.docx"
        output_path = os.path.join(temp_dir, output_filename)
        
        update_docx_by_coordinates(local_template_path, output_path, llm_result["updates"])
        
        # 4. 파일 반환
        return FileResponse(
            path=output_path,
            filename=f"이음AI_회의록_{uuid.uuid4().hex[:4]}.docx",
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )

    except Exception as e:
        print(f"❌ 문서 생성 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# 메인 실행
# ==========================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)