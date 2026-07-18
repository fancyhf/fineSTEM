import asyncio
import websockets
import json
import time

async def test():
    uri = 'ws://localhost:3200/api/v1/agent/ws'
    
    print('=' * 60)
    print('  WebSocket 事件调试测试')
    print('=' * 60)
    
    async with websockets.connect(uri) as ws:
        msg = {
            'user_id': f'event-test-{int(time.time())}',
            'message': '我想做一个项目，帮我选题',
            'context': {'page': 'create'},
            'enable_tools': True,
            'skill_id': 'stem-pbl-guide',
        }
        await ws.send(json.dumps(msg, ensure_ascii=False))
        
        event_counts = {}
        while True:
            try:
                r = await asyncio.wait_for(ws.recv(), timeout=60)
                data = json.loads(r)
                event = data.get('event', 'unknown')
                event_counts[event] = event_counts.get(event, 0) + 1
                
                if event == 'question':
                    print(f'\n[QUESTION EVENT]')
                    print(json.dumps(data.get('data', {}), ensure_ascii=False, indent=2)[:500])
                elif event == 'final':
                    print(f'\n[FINAL]')
                    print(f'事件统计: {json.dumps(event_counts, indent=2)}')
                    break
            except asyncio.TimeoutError:
                break

if __name__ == '__main__':
    asyncio.run(test())
