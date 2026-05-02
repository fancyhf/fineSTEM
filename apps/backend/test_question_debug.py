import asyncio
import websockets
import json
import time

async def test():
    uri = 'ws://localhost:3000/api/v1/agent/ws'
    
    print('=' * 60)
    print('  Question 解析调试测试')
    print('=' * 60)
    
    async with websockets.connect(uri) as ws:
        # 第1轮
        msg = {
            'user_id': f'debug-{int(time.time())}',
            'message': '我想做一个项目，帮我选题',
            'context': {'page': 'create'},
            'enable_tools': True,
            'skill_id': 'stem-pbl-guide',
        }
        await ws.send(json.dumps(msg, ensure_ascii=False))
        
        full_text = ''
        events = []
        while True:
            try:
                r = await asyncio.wait_for(ws.recv(), timeout=60)
                data = json.loads(r)
                events.append(data)
                event = data.get('event')
                
                if event == 'token':
                    token = data.get('data', {}).get('token', '')
                    full_text += token
                elif event == 'question':
                    print(f'\n[QUESTION EVENT]')
                    print(json.dumps(data.get('data', {}), ensure_ascii=False, indent=2))
                elif event == 'final':
                    print(f'\n[FINAL]')
                    print(f'完整文本长度: {len(full_text)}')
                    # 检查是否包含 question
                    if '<question' in full_text.lower():
                        idx = full_text.lower().find('<question')
                        print(f'发现 <question> 在位置 {idx}')
                        print(f'内容片段: {full_text[idx:idx+200]}')
                    break
            except asyncio.TimeoutError:
                break
        
        print(f'\n第1轮事件: {len(events)}')
    
    # 第2轮
    async with websockets.connect(uri) as ws:
        msg = {
            'user_id': f'debug-{int(time.time())}',
            'message': '[选择] 你目前在读哪个年级？\n回答：初中',
            'context': {'page': 'create'},
            'enable_tools': True,
            'skill_id': 'stem-pbl-guide',
        }
        await ws.send(json.dumps(msg, ensure_ascii=False))
        
        full_text2 = ''
        events2 = []
        while True:
            try:
                r = await asyncio.wait_for(ws.recv(), timeout=60)
                data = json.loads(r)
                events2.append(data)
                event = data.get('event')
                
                if event == 'token':
                    token = data.get('data', {}).get('token', '')
                    full_text2 += token
                elif event == 'question':
                    print(f'\n[QUESTION EVENT - 第2轮]')
                    print(json.dumps(data.get('data', {}), ensure_ascii=False, indent=2))
                elif event == 'final':
                    print(f'\n[FINAL - 第2轮]')
                    print(f'完整文本长度: {len(full_text2)}')
                    if '<question' in full_text2.lower():
                        idx = full_text2.lower().find('<question')
                        print(f'发现 <question> 在位置 {idx}')
                        print(f'内容片段: {full_text2[idx:idx+200]}')
                    else:
                        print('未发现 <question>')
                        print(f'文本最后500字符: {full_text2[-500:]}')
                    break
            except asyncio.TimeoutError:
                break
        
        print(f'\n第2轮事件: {len(events2)}')

if __name__ == '__main__':
    asyncio.run(test())
