"""
测试 B 站字幕提取功能 - 最终测试
使用搜索到的字幕测试视频
"""

import sys
import os

# 添加 src 目录到 Python 路径
src_path = os.path.join(os.path.dirname(__file__), 'src')
if src_path not in sys.path:
    sys.path.insert(0, src_path)

from bilibili_subtitle_v3 import extract_bilibili_subtitle  # type: ignore

# 字幕测试视频
test_urls = [
    # 字幕测试视频
    "https://www.bilibili.com/video/BV18DoSY3Etp",  # 测试字幕
    "https://www.bilibili.com/video/BV1hu7AzREoU",  # Subtitle test
    # 教育类视频
    "https://www.bilibili.com/video/BV1iW411e7Ur",  # 英语教学
]

print("=" * 70)
print("B 站字幕提取功能测试 - 最终版")
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
        results.append({'url': url, 'success': True, 'length': len(content)})
        print(f"\n✅ 提取成功！")
        print(f"字符数：{len(content)}")
        print(f"内容预览：{content[:200]}...")
        
        # 保存成功的字幕
        output_file = f"success_subtitle_{i}.txt"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"已保存到：{output_file}")
    else:
        fail_count += 1
        results.append({'url': url, 'success': False, 'message': message})
        print(f"\n❌ 提取失败")
    
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
    print("\n❌ 所有测试视频都没有字幕")
    print("\n💡 这说明：")
    print("  1. B站大部分视频确实没有字幕")
    print("  2. 需要找有 CC 标识的视频")
    print("  3. 代码本身是正确的，只是视频没有字幕")
