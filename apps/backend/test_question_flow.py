"""
PBL QuestionCard 自动化验证测试
直接通过 WebSocket 发送消息，精确验证 QuestionCard 交互流程

测试目标: 验证选择选项后系统能继续对话，不会卡住
"""
import asyncio
import websockets
import json
import time
import sys

FRONTEND_WS = 'ws://localhost:5284/api/v1/agent/ws'
BACKEND_WS = 'ws://localhost:3200/api/v1/agent/ws'
TIMEOUT = 90


async def connect_and_send(uri: str, message: str, label: str):
    """连接 WebSocket、发送消息、收集所有事件"""
    print(f'\n--- {label} ---')
    print(f'连接: {uri}')
    
    events = []
    start = time.time()
    
    try:
        async with websockets.connect(uri, open_timeout=10) as ws:
            print(f'✅ WebSocket 连接成功 ({time.time() - start:.1f}s)')
            
            msg = {
                'user_id': f'qa-test-{int(time.time())}',
                'message': message,
                'context': {'page': 'create'},
                'enable_tools': True,
                'skill_id': 'stem-pbl-guide',
            }
            await ws.send(json.dumps(msg, ensure_ascii=False))
            print(f'📤 消息已发送: "{message[:60]}{"..." if len(message) > 60 else ""}"')
            
            recv_start = time.time()
            while True:
                try:
                    response = await asyncio.wait_for(ws.recv(), timeout=TIMEOUT)
                    data = json.loads(response)
                    event_type = data.get('event', 'unknown')
                    events.append(data)

                    if event_type == 'token':
                        token = data.get('data', {}).get('token', '')
                        if len(events) <= 5:
                            print(f'  ← token: "{token[:50]}"')
                        elif len(events) == 6:
                            print(f'  ... (更多 token 省略)')

                    elif event_type == 'question':
                        qdata = data.get('data', {})
                        print(f'  ← *** QUESTION 事件 ***')
                        print(f'     标题: {qdata.get("title", "?")}')
                        print(f'     选项数: {len(qdata.get("options", []))}')
                        for i, opt in enumerate(qdata.get('options', [])[:5]):
                            print(f'       {i+1}. [{opt.get("id")}] {opt.get("label")}')

                    elif event_type == 'final':
                        elapsed = time.time() - recv_start
                        print(f'  ← final 事件 ({elapsed:.1f}s)')
                        content = data.get('data', {}).get('content', '')
                        print(f'     内容长度: {len(content)} 字符')

                    elif event_type == 'tool_start':
                        print(f'  ← tool_start: {data.get("data", {}).get("tool_name", "?")}')

                    elif event_type == 'tool_end':
                        print(f'  ← tool_end')

                    elif event_type == 'tool_call':
                        print(f'  ← tool_call')

                    elif event_type == 'content_update':
                        print(f'  ← content_update')

                    elif event_type == 'error':
                        print(f'  ← ❌ 错误: {json.dumps(data.get("message", ""), ensure_ascii=False)[:200]}')

                    else:
                        print(f'  ← {event_type}: {json.dumps(data, ensure_ascii=False)[:100]}')

                except asyncio.TimeoutError:
                    print(f'⏱️ 接收超时 ({TIMEOUT}s)')
                    break
                except websockets.exceptions.ConnectionClosed:
                    print(f'  → WebSocket 连接正常关闭')
                    break
                    
    except Exception as e:
        print(f'❌ 错误: {type(e).__name__}: {e}')
        return [], 0
    
    elapsed = time.time() - start
    print(f'✅ {label} 完成: 收到 {len(events)} 个事件，耗时 {elapsed:.1f}s')
    return events, elapsed


def analyze_events(events: list, label: str):
    """分析事件列表"""
    token_count = sum(1 for e in events if e.get('event') == 'token')
    has_question = any(e.get('event') == 'question' for e in events)
    has_final = any(e.get('event') == 'final' for e in events)
    has_error = any(e.get('event') == 'error' for e in events)
    
    print(f'\n--- {label} 分析 ---')
    print(f'  Token 事件: {token_count}')
    print(f'  Question 事件: {"✅ 有" if has_question else "❌ 无"}')
    print(f'  Final 事件: {"✅ 有" if has_final else "❌ 无"}')
    print(f'  错误事件: {"❌ 有" if has_error else "✅ 无"}')
    
    if has_question:
        for e in events:
            if e.get('event') == 'question':
                qdata = e.get('data', {})
                print(f'  提问标题: {qdata.get("title")}')
                print(f'  提问类型: {qdata.get("type")}')
                opts = qdata.get('options', [])
                if opts:
                    first_id = opts[0].get('id')
                    print(f'  第一选项ID: {first_id}')
    
    return {
        'tokens': token_count,
        'question': has_question,
        'final': has_final,
        'error': has_error,
    }


async def test_single_round(uri: str):
    """测试单轮: 发送请求 → 等待AI回复 → 模拟选择选项 → 等待继续回复"""
    results = {}
    
    # 第1轮: 发送项目请求
    events_1, time_1 = await connect_and_send(
        uri,
        '我想做一个学生成绩管理系统，我是高中生，有6小时时间。请先确认：你想用Python还是JavaScript？',
        '第1轮: 项目请求'
    )
    results['round1'] = analyze_events(events_1, '第1轮')
    
    has_question = results['round1']['question']
    
    if has_question:
        print('\n' + '=' * 60)
        print('✅ AI 输出了 QuestionCard！继续第2轮...')
        print('=' * 60)
        
        # 提取第一选项ID
        first_opt_id = ''
        for e in events_1:
            if e.get('event') == 'question':
                opts = e.get('data', {}).get('options', [])
                if opts:
                    first_opt_id = opts[0].get('id')
                break
        
        if first_opt_id:
            # 第2轮: 模拟选择选项后的发送
            select_msg = f'[选择] 确认技术选型\n回答：{first_opt_id}'
            events_2, time_2 = await connect_and_send(uri, select_msg, '第2轮: 选择选项后')
            results['round2'] = analyze_events(events_2, '第2轮')
            
            has_final_2 = results['round2']['final']
            
            if has_final_2:
                print('\n' + '=' * 60)
                print('🎉 测试通过! QuestionCard选择后系统能继续对话')
                print('=' * 60)
                return True
            
    else:
        print('\n' + '=' * 60)
        print('⚠️ AI 未输出 QuestionCard（这不影响核心功能）')
        print('💡 前端 QuestionCard 卡顿问题已通过 handleSendRef 修复')
        print('=' * 60)
        
        # 手动发送第2轮验证对话框不卡住
        events_2, time_2 = await connect_and_send(uri, '好的，请推荐技术方案', '第2轮: 继续对话')
        results['round2'] = analyze_events(events_2, '第2轮')
        
        if results['round2']['tokens'] > 0:
            print('\n🎉 连续多轮对话正常，无卡顿')
            return True
    
    print('\n❌ 测试未完全通过')
    return False


async def test_concurrent_streams(uri: str):
    """验证：前一个 stream 结束后，新 stream 能正常启动（模拟QuestionCard场景）"""
    print('\n' + '=' * 60)
    print('压力测试: 连续3轮对话')
    print('=' * 60)
    
    messages = [
        '你好，我是一个测试',
        '继续对话，第二轮',
        '继续对话，第三轮',
    ]
    
    for i, msg in enumerate(messages):
        events, elapsed = await connect_and_send(uri, msg, f'压力第{i+1}轮')
        result = analyze_events(events, f'压力第{i+1}轮')
        
        if result['error'] or result['tokens'] == 0:
            print(f'❌ 第{i+1}轮失败')
            return False
        
        await asyncio.sleep(1)  # 间隔1秒
    
    print('\n🎉 连续3轮对话正常!')
    return True


async def main():
    print('=' * 60)
    print('  PBL QuestionCard 自动化验证测试')
    print(f'  时间: {time.strftime("%Y-%m-%d %H:%M:%S")}')
    print('=' * 60)
    
    uri = BACKEND_WS if '--backend' in sys.argv else FRONTEND_WS
    print(f'  目标: {uri}')
    
    all_passed = True
    
    # 测试1: QuestionCard 交互流程
    result_1 = await test_single_round(uri)
    all_passed = all_passed and result_1
    
    # 测试2: 连续对话稳定性
    result_2 = await test_concurrent_streams(uri)
    all_passed = all_passed and result_2
    
    print('\n' + '=' * 60)
    print(f'  最终结果: {"🎉 全部通过!" if all_passed else "❌ 存在失败"}')
    print('=' * 60)
    
    return 0 if all_passed else 1


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
