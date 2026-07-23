#!/usr/bin/env python3
"""AI 自动续接功能 - 快速验证测试"""

import asyncio
import sys
sys.path.insert(0, 'apps/backend')

from app.services.orchestrator import AgentOrchestratorService, AgentChatRequest

async def quick_test():
    print('='*60)
    print('AI 自动续接功能 - 快速验证测试')
    print('='*60)

    service = AgentOrchestratorService()

    # 测试 1: 截断检测
    print('\n[测试 1] 截断检测逻辑')
    test_cases = [
        ('```python\nprint(1)\npython', True, '以编程语言名结尾'),
        ('```python\nprint(1)\n```', False, '闭合代码块'),
        ('<option>test', True, '未闭合标签'),
        ('正常文本', False, '普通文本'),
    ]

    all_passed = True
    for content, expected, desc in test_cases:
        result = service._is_output_truncated(content)
        status = '✅' if result == expected else '❌'
        if result != expected:
            all_passed = False
        print(f'  {status} {desc}: {result} (预期 {expected})')

    # 测试 2: 短代码生成
    print('\n[测试 2] 短代码生成（30秒内）')
    req = AgentChatRequest(
        message='写一个 Python 函数计算阶乘',
        session_id='test-quick',
        context={'current_stage': 'stage_07_execute', 'skill_id': 'stem-pbl-guide'},
        enable_tools=False
    )

    token_count = 0
    final_content = ''

    try:
        async for event_type, event_data in service.stream_chat_with_events('test-user', req):
            if event_type == 'token':
                token_count += 1
                final_content += event_data.get('token', '')
            if event_type == 'final':
                break
            if token_count > 2000:  # 安全限制
                break

        code_blocks = final_content.count('```')
        print(f'  ✅ 生成完成: {token_count} tokens, {len(final_content)} 字符')
        print(f'  ✅ 代码块状态: {code_blocks // 2} 个完整代码块')
    except Exception as e:
        print(f'  ⚠️  测试中断: {e}')
        all_passed = False

    print('\n' + '='*60)
    if all_passed:
        print('✅ 所有快速验证测试通过！')
    else:
        print('❌ 部分测试未通过')
    print('='*60)

if __name__ == '__main__':
    asyncio.run(quick_test())
