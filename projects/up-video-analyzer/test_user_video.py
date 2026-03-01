"""
测试提取用户提供的 B 站视频字幕
视频链接：https://www.bilibili.com/video/BV1ZoFmzUE7h/
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from bilibili_subtitle import extract_bilibili_subtitle

# 用户提供的视频链接
test_url = "https://www.bilibili.com/video/BV1ZoFmzUE7h/?spm_id_from=333.1387.homepage.video_card.click&vd_source=ad236b930e655bdc87fa0b67763858b8"

print("=" * 60)
print("B 站字幕提取测试")
print("=" * 60)
print(f"\n视频链接：{test_url}")
print("\n正在提取字幕...\n")

# 提取字幕
content, message = extract_bilibili_subtitle(test_url)

# 显示结果
print(message)
print()

if content:
    print("✅ 提取成功！")
    print(f"\n📊 统计信息:")
    print(f"   - 总字符数：{len(content)}")
    print(f"   - 总行数：{content.count(chr(10)) + 1}")
    print(f"   - 预估词数：{len(content) // 2}")
    
    print(f"\n📝 内容预览（前 500 字）:")
    print("-" * 60)
    print(content[:500])
    print("-" * 60)
    
    if len(content) > 500:
        print(f"\n... 还有 {len(content) - 500} 字 ...")
    
    # 保存字幕到文件
    output_file = os.path.join(os.path.dirname(__file__), 'test_subtitle.txt')
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"\n💾 字幕已保存到：{output_file}")
else:
    print("❌ 提取失败或视频无字幕")
    print("\n可能的原因:")
    print("  1. 该视频没有上传字幕")
    print("  2. 视频只有自动生成字幕但提取失败")
    print("  3. 网络连接问题")
    print("\n建议:")
    print("  - 尝试其他有 CC 字幕标识的视频")
    print("  - 使用 DownKyi 等工具手动下载字幕")
    print("  - 手动复制视频简介或评论进行分析")

print("\n" + "=" * 60)
