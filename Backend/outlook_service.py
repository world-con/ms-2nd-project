import os
import msal
import requests
from dotenv import load_dotenv

load_dotenv()

MS_CLIENT_ID = os.getenv("MS_CLIENT_ID")
# [수정] 권한 범위에 'Tasks.ReadWrite' 추가 (할 일 접근용)
SCOPES = ["Calendars.ReadWrite", "Tasks.ReadWrite"]
AUTHORITY_URL = "https://login.microsoftonline.com/common"
LOGIC_APP_URL = os.getenv("LOGIC_APP_URL_CALENDAR")

# 최초 로그인을 진행한 후에는 자동으로 저장된 토큰을 사용하도록 설정
CACHE_FILE = 'token_cache.bin'

def _load_cache():
    cache = msal.SerializableTokenCache()
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "r") as f:
            cache.deserialize(f.read())
    return cache

def _save_cache(cache):
    if cache.has_state_changed:
        with open(CACHE_FILE, "w") as f:
            f.write(cache.serialize())

def get_access_token():
    # MSAL 인증 토큰 발급(캐시 기능 추가)
    cache = _load_cache()
    app = msal.PublicClientApplication(
        MS_CLIENT_ID, 
        authority=AUTHORITY_URL,
        token_cache=cache # 캐시 연결
    )
    result = None
    accounts = app.get_accounts()
    
    if accounts:
        result = app.acquire_token_silent(SCOPES, account=accounts[0])
    
    if not result:
        # 주의: 서버 환경에서는 Interactive 로그인이 어려울 수 있습니다.
        print("최초 인증이 필요합니다. 브라우저에서 로그인을 완료해주세요.") 
        result = app.acquire_token_interactive(scopes=SCOPES)
        
    # 변경된 캐시 내용 저장
    _save_cache(cache)

    return result.get("access_token") if result else None

def send_event_to_logic_app(event_body):
    """(기존 유지) 준비된 JSON Body를 받아 Logic App으로 전송 - 달력용"""
    token = get_access_token()
    if not token:
        return False, "인증 실패"

    payload = {
        "access_token": token,
        "event_body": event_body
    }

    try:
        res = requests.post(LOGIC_APP_URL, json=payload)
        if res.status_code in [200, 202]:
            return True, "성공"
        else:
            return False, f"Logic App 오류: {res.text}"
    except Exception as e:
        return False, str(e)

# Microsoft Graph API를 이용한 To-Do 생성 함수
def create_todo_task(subject, content=None):
    """Microsoft Outlook Tasks(To-Do)에 작업을 추가하는 함수"""
    token = get_access_token()
    if not token:
        return False, "인증 실패"

    # Microsoft Graph API: Outlook Tasks 엔드포인트
    url = "https://graph.microsoft.com/v1.0/me/outlook/tasks"
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "subject": subject,  # 작업 제목
        "body": {
            "contentType": "text",
            "content": content if content else "자동 생성된 작업입니다."
        }
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        
        # 201 Created: 성공적으로 생성됨
        if response.status_code == 201:
            return True, "성공"
        else:
            return False, f"Graph API 오류: {response.text}"
    except Exception as e:
        return False, str(e)
    