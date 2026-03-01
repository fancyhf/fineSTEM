"""
B 站字幕提取工具 - 简单版本
直接从视频页面 HTML 中提取字幕 JSON 数据
不需要 API 签名，不需要登录
"""

import re
import json
import requests
from typing import Optional, Tuple


def extract_bilibili_subtitle(url: str) -> Tuple[Optional[str], str]:
    """
    从 B 站视频页面提取字幕
    原理：访问视频页面，从 HTML 中提取字幕 JSON 数据
    """
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    }
    
    try:
        # 1. 访问视频页面
        print(f"正在访问：{url}")
        response = requests.get(url, headers=headers, timeout=15)
        response.encoding = 'utf-8'
        html = response.text
        
        # 2. 提取视频标题
        title_match = re.search(r'<title>(.*?)</title>', html)
        video_title = title_match.group(1).replace('-bilibili', '').strip() if title_match else "未知视频"
        
        # 3. 查找字幕 JSON 数据
        # B 站会在页面 HTML 中嵌入字幕信息
        subtitle_patterns = [
            r'"subtitle_url":"(https?://[^"]+\.json)"',
            r'subtitle":{"url":"(https?://[^"]+\.json)"',
            r'"subtitles":\[.*?\{"url":"(https?://[^"]+\.json)"'
        ]
        
        subtitle_url = None
        for pattern in subtitle_patterns:
            match = re.search(pattern, html)
            if match:
                subtitle_url = match.group(1)
                # 修复 URL 协议
                if subtitle_url.startswith('http:'):
                    subtitle_url = subtitle_url.replace('http:', 'https:')
                break
        
        if not subtitle_url:
            return None, f"ℹ️ 视频《{video_title}》没有找到字幕\n\n💡 这个视频可能没有上传字幕\n\n建议：\n1. 换一个有 CC 字幕的视频\n2. 手动复制视频简介内容\n3. 使用剪映等工具自动生成字幕"
        
        # 4. 下载字幕文件
        print(f"找到字幕链接：{subtitle_url}")
        subtitle_response = requests.get(subtitle_url, headers=headers, timeout=10)
        subtitle_data = subtitle_response.json()
        
        # 5. 提取字幕文本
        body = subtitle_data.get('body', [])
        if not body:
            return None, f"ℹ️ 视频《{video_title}》的字幕内容为空"
        
        text_content = []
        for item in body:
            content = item.get('content', '')
            if content:
                text_content.append(content)
        
        full_text = '\n'.join(text_content)
        
        if full_text:
            return full_text, f"✅ 成功提取《{video_title}》的字幕\n共 {len(full_text)} 字符"
        else:
            return None, f"ℹ️ 视频《{video_title}》的字幕无法解析"
            
    except requests.exceptions.Timeout:
        return None, "❌ 网络超时，请检查网络连接"
    except requests.exceptions.RequestException as e:
        return None, f"❌ 网络错误：{str(e)}"
    except json.JSONDecodeError:
        return None, "❌ 字幕格式错误，无法解析"
    except Exception as e:
        return None, f"❌ 提取失败：{str(e)}"


if __name__ == "__main__":
    # 测试
    test_urls = [
        "https://www.bilibili.com/video/BV1CizeBPEf1/",
    ]
    
    for url in test_urls:
        print("=" * 60)
        print(f"测试：{url}")
        print("=" * 60)
        content, message = extract_bilibili_subtitle(url)
        print(f"\n{message}\n")
        if content:
            print(f"预览：{content[:300]}...")
        print()
