# rag_chat.py
import os
from dotenv import load_dotenv
from langchain_openai import AzureOpenAIEmbeddings, AzureChatOpenAI
from azure.search.documents import SearchClient
from azure.core.credentials import AzureKeyCredential

load_dotenv()

# --- 설정값 ---
search_endpoint = os.getenv("AZURE_SEARCH_ENDPOINT")
search_key = os.getenv("AZURE_SEARCH_API_KEY")
index_name = os.getenv("AZURE_SEARCH_INDEX_NAME")

# 1. 임베딩 모델 (질문을 벡터로 바꾸기 위해 필요)
embeddings = AzureOpenAIEmbeddings(
    azure_deployment="text-embedding-ada-002", # 본인 배포 이름 확인
    openai_api_version="2024-12-01-preview",
)

# 2. GPT 모델 (답변 생성용)
llm = AzureChatOpenAI(
    azure_deployment="AZURE_OPENAI_DEPLOYMENT_NAME", # 본인 배포 이름 확인 (gpt-4o)
    openai_api_version="AZURE_OPENAI_API_VERSION",
    # 사실 기반 답변을 위해 0으로 설정
)

# 3. 검색 함수 (Retrieval)
def search_documents(query):
    search_client = SearchClient(search_endpoint, index_name, AzureKeyCredential(search_key))
    
    # 질문을 벡터로 변환
    query_vector = embeddings.embed_query(query)
    
    # 벡터 검색 실행 (가장 유사한 문서 3개 찾기)
    results = search_client.search(
        search_text=query, # 키워드 검색도 같이 함 (Hybrid Search)
        vector_queries=[{
            "kind": "vector",
            "k": 3,
            "fields": "content_vector",
            "vector": query_vector
        }],
        select=["content", "source"]
    )
    
    # 검색된 내용 합치기
    found_context = ""
    for r in results:
        found_context += f"[출처: {r['source']}]\n{r['content']}\n\n"
        
    return found_context if found_context else "관련된 정보를 찾을 수 없습니다."

# 4. 챗봇 함수 (Generation)
def ask_bot(user_question):
    print(f"User: {user_question}")
    
    # 1) 지식 검색
    context = search_documents(user_question)
    print(f"--- [검색된 지식] ---\n{context[:100]}...\n---------------------")
    
    # 2) GPT에게 질문 + 지식 전달
    prompt = f"""
    당신은 회의록 기반 AI 비서입니다. 아래 [회의 내용]을 바탕으로 질문에 답하세요.
    내용에 없는 내용은 "회의록에 없는 내용입니다"라고 답하세요.
    
    [회의 내용]
    {context}
    
    [질문]
    {user_question}
    """
    
    response = llm.invoke(prompt)
    print(f"Bot: {response.content}\n")
    return response.content

# --- 테스트 실행 ---
if __name__ == "__main__":
    # 질문 1: 날짜 확인
    ask_bot("이번 워크숍 며칠에 가기로 했어?")
    
    # 질문 2: 담당자 확인
    ask_bot("로그인 에러 누가 수정하기로 했지?")
    
    # 질문 3: 엉뚱한 질문 (없는 내용)
    ask_bot("점심에 피자 먹기로 했어?")