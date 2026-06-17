import asyncio
import websockets
import json

async def test_ws_via_proxy():
    # 测试通过 Vite 代理的 WebSocket（模拟前端行为）
    uri = 'ws://localhost:5284/api/v1/agent/ws'
    try:
        print(f'Connecting to {uri}...')
        async with websockets.connect(uri, open_timeout=10) as ws:
            print('WebSocket connected via proxy')
            msg = {
                'user_id': 'test-proxy-user',
                'message': '我想做一个学生成绩管理系统',
                'context': {'page': 'create'},
                'enable_tools': True,
                'skill_id': 'stem-pbl-guide'
            }
            await ws.send(json.dumps(msg))
            print('Message sent, waiting for responses...')
            
            response_count = 0
            while response_count < 5:
                try:
                    response = await asyncio.wait_for(ws.recv(), timeout=30)
                    response_count += 1
                    data = json.loads(response)
                    event_type = data.get('event', 'unknown')
                    print(f'Response #{response_count}: event={event_type}')
                    
                    if event_type == 'final':
                        print('Final event received!')
                        break
                    if event_type == 'question':
                        print(f'*** QUESTION CARD DETECTED! ***')
                        print(f'Question data: {json.dumps(data.get("data", {}), ensure_ascii=False)[:500]}')
                        
                except asyncio.TimeoutError:
                    print('Timeout waiting for more responses')
                    break
                    
            print(f'Total responses received: {response_count}')
                
    except Exception as e:
        print(f'Error: {type(e).__name__}: {e}')

if __name__ == '__main__':
    asyncio.run(test_ws_via_proxy())
