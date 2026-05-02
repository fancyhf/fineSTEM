import asyncio
import websockets
import json
import time

async def test_multi_round():
    uri = 'ws://localhost:3000/api/v1/agent/ws'
    
    print('=' * 60)
    print('  多轮 QuestionCard 测试')
    print(f'  时间: {time.strftime("%Y-%m-%d %H:%M:%S")}')
    print('=' * 60)
    
    # 第1轮: 发送项目请求
    print('\n--- 第1轮: 发送项目请求 ---')
    async with websockets.connect(uri) as ws:
        msg = {
            'user_id': f'test-{int(time.time())}',
            'message': '我想做一个项目，帮我选题',
            'context': {'page': 'create'},
            'enable_tools': True,
            'skill_id': 'stem-pbl-guide',
        }
        await ws.send(json.dumps(msg, ensure_ascii=False))
        print('消息已发送')
        
        events = []
        while True:
            try:
                r = await asyncio.wait_for(ws.recv(), timeout=60)
                data = json.loads(r)
                events.append(data)
                event = data.get('event')
                
                if event == 'token':
                    token = data.get('data', {}).get('token', '')
                    print(token, end='', flush=True)
                elif event == 'question':
                    print('\n[QUESTION]')
                    q = data.get('data', {})
                    print(f'  标题: {q.get("title")}')
                    print(f'  步骤: {q.get("step")}/{q.get("total_steps")}')
                    for opt in q.get('options', []):
                        print(f'    [{opt.get("id")}] {opt.get("label")}')
                elif event == 'final':
                    print('\n[final]')
                    break
            except asyncio.TimeoutError:
                print('\n[超时]')
                break
        
        print(f'\n第1轮事件数: {len(events)}')
        has_q1 = any(e.get('event') == 'question' for e in events)
        print(f'有Question: {has_q1}')
    
    if not has_q1:
        print('\nAI未输出question，测试结束')
        return
    
    # 第2轮: 模拟选择第一个选项
    print('\n--- 第2轮: 选择选项后 ---')
    async with websockets.connect(uri) as ws:
        msg = {
            'user_id': f'test-{int(time.time())}',
            'message': '[选择] 你现在是哪个年级？\n回答：初中（7-9年级）',
            'context': {'page': 'create'},
            'enable_tools': True,
            'skill_id': 'stem-pbl-guide',
        }
        await ws.send(json.dumps(msg, ensure_ascii=False))
        print('选择消息已发送')
        
        events2 = []
        while True:
            try:
                r = await asyncio.wait_for(ws.recv(), timeout=60)
                data = json.loads(r)
                events2.append(data)
                event = data.get('event')
                
                if event == 'token':
                    token = data.get('data', {}).get('token', '')
                    print(token, end='', flush=True)
                elif event == 'question':
                    print('\n[QUESTION]')
                    q = data.get('data', {})
                    print(f'  标题: {q.get("title")}')
                    print(f'  步骤: {q.get("step")}/{q.get("total_steps")}')
                    for opt in q.get('options', []):
                        print(f'    [{opt.get("id")}] {opt.get("label")}')
                elif event == 'final':
                    print('\n[final]')
                    break
            except asyncio.TimeoutError:
                print('\n[超时]')
                break
        
        print(f'\n第2轮事件数: {len(events2)}')
        has_q2 = any(e.get('event') == 'question' for e in events2)
        print(f'有Question: {has_q2}')
    
    # 总结
    print('\n' + '=' * 60)
    print(f'  第1轮 Question: {"是" if has_q1 else "否"}')
    print(f'  第2轮 Question: {"是" if has_q2 else "否"}')
    if has_q1 and has_q2:
        print('  结果: 多轮问答成功!')
    else:
        print('  结果: 需要继续优化')
    print('=' * 60)

if __name__ == '__main__':
    asyncio.run(test_multi_round())
