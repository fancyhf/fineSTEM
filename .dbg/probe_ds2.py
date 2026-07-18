import httpx

ds_key = None
with open(r'G:\mediaProjects\fineSTEM\apps\backend\.env', encoding='utf-8') as f:
    for line in f:
        if line.startswith('deepseek_key='):
            ds_key = line.split('=', 1)[1].strip()
print('DS_KEY:', (ds_key[:12] + '...') if ds_key else None)

headers = {'Content-Type': 'application/json', 'Authorization': f'Bearer {ds_key}'}

# Test DeepSeek chat with image input (multimodal content)
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
