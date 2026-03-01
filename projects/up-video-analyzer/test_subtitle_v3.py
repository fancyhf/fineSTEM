"""
测试 B 站字幕提取功能 - 第三轮测试
使用教育类、语言学习类视频（更可能有字幕）
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from bilibili_subtitle_v3 import extract_bilibili_subtitle

# 教育类视频更可能有字幕
test_urls = [
    # 英语教学类
    "https://www.bilibili.com/video/BV1iW411e7Ur",  # 英语音标
    "https://www.bilibili.com/video/BV1Y4411T7pV",  # 英语语法
    "https://www.bilibili.com/video/BV1U44y1w7R5",  # 英语口语
    # TED 演讲
    "https://www.bilibili.com/video/BV1Ys41127Hs",  # TED
    # 纪录片
    "https://www.bilibili.com/video/BV1XW411W7Vq",  # BBC纪录片
]

print("=" * 70)
print("B 站字幕提取测试 - 教育类视频")
print("=" * 70)

results = []
for i, url in enumerate(test_urls, 1):
    print(f"\n【测试 {i}/{len(test_urls)}】")
    print(f"链接：{url}")
    print("-" * 50)
    
    content, message = extract_bilibili_subtitle(url)
    
    print(f"结果：{message}")
    
    if content:
        results.append({'url': url, 'success': True, 'length': len(content)})
        print(f"\n✅ 成功！字符数：{len(content)}")
        print(f"预览：{content[:100]}...")
    else:
        results.append({'url': url, 'success': False, 'message': message})
        print(f"\n❌ 失败")
    print("-" * 50)

print("\n" + "=" * 70)
print("测试结果汇总")
print("=" * 70)
success = sum(1 for r in results if r['success'])
print(f"成功：{success}，失败：{len(results) - success}")

if success > 0:
    print("\n✅ 找到了有字幕的视频！")
    for r in results:
        if r['success']:
            print(f"  - {r['url']} ({r['length']} 字符)")
else:
    print("\n❌ 所有测试视频都没有字幕")
    print("\n💡 建议：")
    print("1. B站大部分视频确实没有字幕")
    print("2. 需要找有 CC 标识的视频")
    print("3. 或者使用手动上传方式")
