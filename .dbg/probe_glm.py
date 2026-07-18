import httpx
import os

# load env
env_path = r'G:\mediaProjects\fineSTEM\apps\backend\.env'
glm_key = None
with open(env_path, encoding='utf-8') as f:
    for line in f:
        if line.startswith('glm_key='):
            glm_key = line.split('=', 1)[1].strip()
            break
print('GLM_KEY:', (glm_key[:10] + '...') if glm_key else None)

# 1) Test CogView image generation endpoint
headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {glm_key}',
}
payload = {
    'model': 'cogview-3-flash',
    'prompt': 'a simple test image',
    'size': '1024x1024',
}
print('\n=== CogView /images/generations ===')
try:
    r = httpx.post('https://open.bigmodel.cn/api/paas/v4/images/generations', json=payload, headers=headers, timeout=60)
    print('STATUS', r.status_code)
    print('BODY', r.text[:800])
except Exception as e:
    print('ERR', e)

# 2) Test chat completions with an image_url content (to reproduce the error format)
print('\n=== Chat with image input (reproduce error) ===')
chat_payload = {
    'model': 'glm-5-turbo',
    'messages': [
        {'role': 'user', 'content': [
            {'type': 'text', 'text': 'describe this image'},
            {'type': 'image_url', 'image_url': {'url': 'https://example.com/image.png'}},
        ]}
    ],
}
try:
    r = httpx.post('https://open.bigmodel.cn/api/paas/v4/chat/completions', json=chat_payload, headers=headers, timeout=30)
    print('STATUS', r.status_code)
    print('BODY', r.text[:800])
except Exception as e:
    print('ERR', e)
