"""自动化复现：以项目所有者身份调用 /code/capture-preview，看真实返回。"""
import sys
sys.path.insert(0, r'G:\mediaProjects\fineSTEM\apps\backend')

from datetime import timedelta, datetime, timezone
from jose import jwt
import httpx

from app.core.config import settings
from app.api.auth import create_access_token

OWNER_ID = '27fb2e88-bf95-4c98-b33b-688891d40f43'  # fang, owner of f2a11545
PROJECT_ID = 'f2a11545-2b53-488d-8c38-7048f3adc801'

# mint token
tok = create_access_token(data={'sub': OWNER_ID}, expires_delta=timedelta(hours=1))
print('MINTED token:', tok[:30], '...')

headers = {'Authorization': f'Bearer {tok}', 'Content-Type': 'application/json'}

# 1) verify me
r = httpx.get('http://localhost:3200/api/v1/auth/me', headers=headers, timeout=15)
print('\n=== /auth/me ===')
print('STATUS', r.status_code)
print('BODY', r.text[:300])

# 2) verify project access
r = httpx.get(f'http://localhost:3200/api/v1/projects/{PROJECT_ID}', headers=headers, timeout=15)
print('\n=== GET project ===')
print('STATUS', r.status_code)
print('BODY', r.text[:300])

# 3) list existing screenshots
r = httpx.get(f'http://localhost:3200/api/v1/achievement-cards/projects/{PROJECT_ID}/screenshots', headers=headers, timeout=15)
print('\n=== list screenshots ===')
print('STATUS', r.status_code)
print('BODY', r.text[:500])

# 4) THE capture-preview call
print('\n=== POST /code/capture-preview (this is what CoverPicker calls) ===')
r = httpx.post('http://localhost:3200/api/v1/code/capture-preview',
               json={'project_id': PROJECT_ID},
               headers=headers, timeout=90)
print('STATUS', r.status_code)
print('HEADERS', dict(r.headers))
print('BODY', r.text[:1500])
