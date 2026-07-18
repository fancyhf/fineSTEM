import sys, io, httpx, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, r'G:\mediaProjects\fineSTEM\apps\backend')
from datetime import timedelta
from app.api.auth import create_access_token

OWNER_ID = '27fb2e88-bf95-4c98-b33b-688891d40f43'
PROJECT_ID = 'f2a11545-2b53-488d-8c38-7048f3adc801'
CARD_ID = '544215f5-bc2d-4832-8c48-7fa2c9ee934c'
tok = create_access_token(data={'sub': OWNER_ID}, expires_delta=timedelta(hours=1))
H = {'Authorization': f'Bearer {tok}'}
B = 'http://localhost:3200/api/v1'

# 1) screenshots now populated
r = httpx.get(f'{B}/achievement-cards/projects/{PROJECT_ID}/screenshots', headers=H, timeout=15)
print('=== list screenshots ===', r.status_code)
print(json.dumps(r.json().get('data'), ensure_ascii=False, indent=2))

# 2) achievement card cover fixed
r = httpx.get(f'{B}/achievement-cards/{CARD_ID}', headers=H, timeout=15)
print('\n=== card cover ===', r.status_code)
d = r.json().get('data', {})
print('screenshots:', d.get('screenshots'))

# 3) verify new screenshot file is publicly served
r = httpx.get('http://localhost:3200/uploads/27fb2e88-bf95-4c98-b33b-688891d40f43/f2a11545-2b53-488d-8c38-7048f3adc801/8b502c6b-1fa7-4e73-b81b-643401a8ec97.png', timeout=15)
print('\n=== new screenshot file ===', r.status_code, 'bytes=', len(r.content), 'ct=', r.headers.get('content-type'))

# 4) cover file served
r = httpx.get('http://localhost:3200/media/covers/544215f5-bc2d-4832-8c48-7fa2c9ee934c.png', timeout=15)
print('=== cover file ===', r.status_code, 'bytes=', len(r.content))