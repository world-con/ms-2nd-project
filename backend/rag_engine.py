import os
from dotenv import load_dotenv
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizedQuery
from openai import AzureOpenAI

load_dotenv()

# ==========================================
# 환경 변수 불러오기
# ==========================================
AZURE_SEARCH_ENDPOINT = os.getenv("AZURE_SEARCH_ENDPOINT")
AZURE_SEARCH_API_KEY = os.getenv("AZURE_SEARCH_API_KEY")
AZURE_SEARCH_INDEX_NAME = os.getenv("AZURE_SEARCH_INDEX_NAME")

AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION")
AZURE_OPENAI_DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
EMBEDDING_DEPLOYMENT_NAME = os.getenv("EMBEDDING_DEPLOYMENT_NAME")

# 클라이언트 초기화
search_client = SearchClient(AZURE_SEARCH_ENDPOINT, AZURE_SEARCH_INDEX_NAME, AzureKeyCredential(AZURE_SEARCH_API_KEY))
openai_client = AzureOpenAI(
    api_key=AZURE_OPENAI_API_KEY,
    api_version=AZURE_OPENAI_API_VERSION,
    azure_endpoint=AZURE_OPENAI_ENDPOINT
)

# ==========================================
# 1. 질문을 벡터로 변환
# ==========================================
def generate_embedding(text):
    response = openai_client.embeddings.create(input=text, model=EMBEDDING_DEPLOYMENT_NAME)
    return response.data[0].embedding

# ==========================================
# 2. Azure AI Search 검색 (Retrieve)
# ==========================================
def search_documents(query, category=None, top_k=3):
    """
    category:
      - "all" 또는 None: style을 제외한 모든 문서 검색 (history + reference)
      - "history", "reference": 해당 카테고리에서만 검색
    """
    try:
        # 1. 질문 벡터화
        vector = generate_embedding(query)
        vector_query = VectorizedQuery(vector=vector, k_nearest_neighbors=top_k, fields="content_vector")

        # 2. 필터 구성 (OData Syntax)
        filter_str = "category ne 'style'"
        if category and category.lower() != "all":
            filter_str = f"category eq '{category}'"

        # 3. 검색 실행 (Hybrid Search)
        results = search_client.search(
            search_text=query,             # 키워드 검색용
            vector_queries=[vector_query], # 벡터 검색용
            filter=filter_str,             # 카테고리 필터
            select=["title", "content", "created_at", "file_url", "category"],
            top=top_k
        )

        # 4. 결과 정리
        retrieved_docs = []
        for result in results:
            source_tag = f"[{result['category'].upper()}] {result['title']}"
            retrieved_docs.append(f"Source: {source_tag}\nContent: {result['content']}\n")
            
        return retrieved_docs
    
    except Exception as e:
        print(f"❌ 검색 실패: {e}")
        return []

# ==========================================
# 3. 답변 생성 (Generate)
# ==========================================
def generate_answer(query, context_docs):
    if not context_docs:
        return "관련된 정보를 찾을 수 없습니다."

    context_text = "\n\n".join(context_docs)
    
    system_prompt = """
    너는 회의 어시스턴트야.
    아래 제공된 [Context]에 있는 내용만을 바탕으로 답변해.
    모르는 내용은 절대 지어내지 말고 '문서에 해당 내용이 없습니다'라고 말해.
    답변 끝에는 참고한 문서의 제목을 인용해.
    """
    
    user_prompt = f"""
    [Context]
    {context_text}

    [Question]
    {query}
    """

    response = openai_client.chat.completions.create(
        model=AZURE_OPENAI_DEPLOYMENT_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
    )

    return response.choices[0].message.content

# ==========================================
# 메인 함수 (외부 호출용)
# ==========================================
def ask_bot(user_query, target_category="history"):
    print(f"🔍 검색 중... (Category: {target_category})")
    
    # 1. 검색
    docs = search_documents(user_query, category=target_category)
    
    # 2. 답변 생성
    answer = generate_answer(user_query, docs)
    
    return answer

# ==========================================
# 실행 테스트
# ==========================================
if __name__ == "__main__":
    # 테스트 질문
    q = "그 여행사 이름이 뭐였지?"
    
    # history 카테고리에서 검색
    response = ask_bot(q, target_category="history")
    
    print("\n🤖 AI 답변:")
    print(response)