"""
测试 B 站字幕提取功能
使用多个视频链接进行测试
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from bilibili_subtitle_v3 import extract_bilibili_subtitle

# 测试视频链接列表
test_urls = [
    # 罗翔说刑法
    "https://www.bilibili.com/video/BV1TR4y1T7us",
    # 李永乐老师
    "https://www.bilibili.com/video/BV1Fii2YaE48",
    # TED 演讲
    "https://www.bilibili.com/video/BV1xx411c7mD",
    # 更多测试
    "https://www.bilibili.com/video/BV1GJ411x7h7",
]

print("=" * 70)
print("B 站字幕提取功能测试")
print("=" * 70)

success_count = 0
fail_count = 0

for i, url in enumerate(test_urls, 1):
    print(f"\n【测试 {i}/{len(test_urls)}】")
    print(f"链接：{url}")
    print("-" * 50)
    
    content, message = extract_bilibili_subtitle(url)
    
    print(f"结果：{message}")
    
    if content:
        success_count += 1
        print(f"\n✅ 提取成功！")
        print(f"字符数：{len(content)}")
        print(f"内容预览：{content[:150]}...")
        
        # 保存成功的字幕
        output_file = f"test_subtitle_{i}.txt"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"已保存到：{output_file}")
    else:
        fail_count += 1
        print(f"\n❌ 提取失败")
    
    print("-" * 50)

print("\n" + "=" * 70)
print(f"测试完成！成功：{success_count}，失败：{fail_count}")
print("=" * 70)

if success_count > 0:
    print("\n✅ 字幕提取功能正常工作！")
else:
    print("\n❌ 所有测试都失败了，需要检查代码或网络")
