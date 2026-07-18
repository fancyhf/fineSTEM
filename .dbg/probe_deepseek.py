import httpx

glm_key = None
with open(r'G:\mediaProjects\fineSTEM\apps\backend\.env', encoding='utf-8') as f:
    for line in f:
        if line.startswith('glm_key='):
            glm_key = line.split('=', 1)[1].strip()
        if line.startswith('deepseek_key=') or line.startswith('DEEPSEEK'):
            print('FOUND deepseek env line:', line.strip())

# Read .env fully
print('--- .env keys ---')
with open(r'G:\mediaProjects\fineSTEM\apps\backend\.env', encoding='utf-8') as f:
    for line in f:
        if '=' in line and not line.strip().startswith('#'):
            k = line.split('=', 1)[0]
            print(k)

# Test DeepSeek chat with image input
headers = {'Content-Type': 'application/json', 'Authorization': f'Bearer {glm_key}'}
chat_payload = {
    'model': 'deepseek-chat',
    'messages': [
        {'role': 'user', 'content': [
            {'type': 'text', 'text': 'describe this image'},
            {'type': 'image_url', 'image_url': {'url': 'https://example.com/image.png'}},
        ]}
    ],
}
print('\n=== DeepSeek chat with image input ===')
try:
    r = httpx.post('https://api.deepseek.com/v1/chat/completions', json=chat_payload, headers=headers, timeout=30)
    print('STATUS', r.status_code)
    print('BODY', r.text[:800])
except Exception as e:
    print('ERR', e)
