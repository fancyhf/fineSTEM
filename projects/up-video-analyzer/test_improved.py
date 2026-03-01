"""
测试改进后的 B 站字幕提取功能
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from bilibili_subtitle import extract_bilibili_subtitle

# 测试多个视频链接
test_urls = [
    "https://www.bilibili.com/video/BV1CizeBPEf1/",
    "https://www.bilibili.com/video/BV18h411X7bE",  # 罗翔说刑法
    "https://www.bilibili.com/video/BV1q4411M7r2",  # 李永乐老师
]

print("=" * 60)
print("B 站字幕提取功能测试（改进版）")
print("=" * 60)

for i, url in enumerate(test_urls, 1):
    print(f"\n测试 {i}: {url}")
    print("-" * 40)
    
    content, message = extract_bilibili_subtitle(url)
    
    print(message)
    
    if content:
        print(f"\n✅ 提取成功！")
        print(f"字符数：{len(content)}")
        print(f"预览：{content[:200]}...")
    else:
        print(f"\n❌ 提取失败或无字幕")
    
    print("-" * 40)

print(f"\n💡 提示：如果仍然失败，可能需要使用第三方工具：")
print(f"   • DownKyi（唧唧）")
print(f"   • Bilibili-Evolved 浏览器扩展")
print(f"   • 手动复制视频内容")

print("\n" + "=" * 60)
