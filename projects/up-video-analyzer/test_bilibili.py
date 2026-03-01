"""
B 站字幕提取功能测试
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from bilibili_subtitle import extract_bilibili_subtitle

def test_extraction():
    """测试 B 站字幕提取"""
    print("B 站字幕提取功能测试")
    print("=" * 50)
    
    # 测试链接（你可以替换为实际存在的 B 站视频链接）
    test_urls = [
        "https://www.bilibili.com/video/BV1GJ411x7h7",  # 示例链接
        "https://www.bilibili.com/video/BV1xx411c7mD",  # 示例链接
    ]
    
    for url in test_urls:
        print(f"\n测试链接: {url}")
        print("-" * 30)
        
        content, message = extract_bilibili_subtitle(url)
        
        print(f"状态: {message}")
        
        if content:
            print(f"字幕长度: {len(content)} 字符")
            print(f"内容预览: {content[:200]}...")
        else:
            print("提取失败或无字幕")
        
        print("-" * 30)

if __name__ == "__main__":
    test_extraction()
