"""
测试 B 站字幕提取功能 - 第二轮测试
使用搜索到的视频链接
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from bilibili_subtitle_v3 import extract_bilibili_subtitle

# 测试视频链接列表 - 教育类视频更可能有字幕
test_urls = [
    # 科学科普视频
    "https://www.bilibili.com/video/BV1tnBmYEExK",
    # 罗翔说刑法 - 热门视频
    "https://www.bilibili.com/video/BV1TR4y1T7us",
    # TED 演讲
    "https://www.bilibili.com/video/BV1xx411c7mD",
    # 教程视频
    "https://www.bilibili.com/video/BV1Fii2YaE48",
]

print("=" * 70)
print("B 站字幕提取功能测试 - 第二轮")
print("=" * 70)

success_count = 0
fail_count = 0
results = []

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
        print(f"内容预览：{content[:200]}...")
        
        # 保存成功的字幕
        output_file = f"test_subtitle_success_{i}.txt"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(f"视频链接：{url}\n")
            f.write(f"字幕内容：\n\n")
            f.write(content)
        print(f"已保存到：{output_file}")
        
        results.append({
            'url': url,
            'success': True,
            'length': len(content)
        })
    else:
        fail_count += 1
        print(f"\n❌ 提取失败")
        
        results.append({
            'url': url,
            'success': False,
            'message': message
        })
    
    print("-" * 50)

print("\n" + "=" * 70)
print(f"测试完成！成功：{success_count}，失败：{fail_count}")
print("=" * 70)

if success_count > 0:
    print("\n✅ 字幕提取功能正常工作！")
    print("\n成功提取的视频：")
    for r in results:
        if r['success']:
            print(f"  - {r['url']} ({r['length']} 字符)")
else:
    print("\n❌ 所有测试都失败了")
    print("\n失败原因分析：")
    for r in results:
        if not r['success']:
            print(f"  - {r['url']}: {r['message']}")
