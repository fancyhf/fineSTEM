import asyncio
import websockets
import json

async def test_ws():
    uri = 'ws://localhost:3000/api/v1/agent/ws'
    try:
        async with websockets.connect(uri, open_timeout=10) as ws:
            print('WebSocket connected')
            msg = {
                'user_id': 'test-user-456',
                'message': 'hello',
                'context': {'page': 'create'},
                'enable_tools': True,
                'skill_id': 'stem-pbl-guide'
            }
            await ws.send(json.dumps(msg))
            print('Message sent, waiting for response...')
            
            try:
                response = await asyncio.wait_for(ws.recv(), timeout=60)
                print(f'Response received: {str(response)[:800]}')
            except asyncio.TimeoutError:
                print('Timeout waiting for response')
                
    except Exception as e:
        print(f'Error: {type(e).__name__}: {e}')

if __name__ == '__main__':
    asyncio.run(test_ws())
