"""
B 站字幕提取工具 - 最简版本
直接从视频页面提取字幕，无需复杂依赖
参考：https://blog.csdn.net/wizardforcel/article/details/142281926
"""

import re
import json
import requests
from typing import Optional, Tuple


def extract_bilibili_subtitle(url: str) -> Tuple[Optional[str], str]:
    """
    从 B 站视频提取字幕
    原理：访问视频页面 → 提取 aid 和 cid → 调用 API 获取字幕
    """
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com',
        'Accept': 'application/json, text/plain, */*',
    }
    
    try:
        # 1. 提取 BV 号
        bv_match = re.search(r'(BV\w{10})', url)
        if not bv_match:
            av_match = re.search(r'av(\d+)', url)
            if av_match:
                aid = int(av_match.group(1))
                bvid = None
            else:
                return None, "❌ 未找到有效的视频 ID"
        else:
            bvid = bv_match.group(1)
            aid = None
        
        # 2. 获取视频信息（包括 cid）
        if bvid:
            info_url = f"https://api.bilibili.com/x/web-interface/view?bvid={bvid}"
        else:
            info_url = f"https://api.bilibili.com/x/web-interface/view?aid={aid}"
        
        print(f"获取视频信息：{info_url}")
        response = requests.get(info_url, headers=headers, timeout=15)
        data = response.json()
        
        if data.get('code') != 0:
            return None, f"❌ 获取视频信息失败：{data.get('message', '未知错误')}"
        
        video_data = data['data']
        title = video_data.get('title', '未知视频')
        aid = video_data.get('aid')
        cid = video_data.get('cid')
        
        print(f"视频标题：{title}")
        print(f"AID: {aid}, CID: {cid}")
        
        # 3. 获取字幕列表
        # 尝试多个 API 端点
        subtitle_apis = [
            f"https://api.bilibili.com/x/player/v2?aid={aid}&cid={cid}",
            f"https://api.bilibili.com/x/player.so?id=cid:{cid}&aid={aid}",
        ]
        
        subtitle_data = None
        for api_url in subtitle_apis:
            try:
                print(f"尝试 API：{api_url}")
                resp = requests.get(api_url, headers=headers, timeout=10)
                resp_data = resp.json()
                
                if resp_data.get('code') == 0:
                    subtitle_data = resp_data.get('data', {})
                    break
            except:
                continue
        
        if not subtitle_data:
            return None, f"ℹ️ 视频《{title}》没有找到字幕\n\n💡 这个视频可能没有上传字幕。\n\n建议：\n• 换一个有 CC 字幕标识的视频\n• 手动复制视频简介内容"
        
        # 4. 提取字幕 URL
        subtitle_info = subtitle_data.get('subtitle', {})
        subtitles = subtitle_info.get('subtitles', []) or subtitle_info.get('list', [])
        
        if not subtitles:
            return None, f"ℹ️ 视频《{title}》没有可用的字幕\n\n💡 这个视频可能没有上传字幕。"
        
        # 获取第一个字幕
        first_sub = subtitles[0]
        subtitle_url = first_sub.get('subtitle_url', '') or first_sub.get('url', '')
        lang = first_sub.get('lan_doc', '字幕')
        
        if not subtitle_url:
            return None, f"ℹ️ 视频《{title}》的字幕链接无法获取"
        
        # 修复 URL
        if subtitle_url.startswith('//'):
            subtitle_url = 'https:' + subtitle_url
        elif subtitle_url.startswith('http:'):
            subtitle_url = subtitle_url.replace('http:', 'https:')
        
        print(f"字幕链接：{subtitle_url}")
        
        # 5. 下载字幕内容
        sub_resp = requests.get(subtitle_url, headers=headers, timeout=10)
        sub_data = sub_resp.json()
        
        body = sub_data.get('body', [])
        if not body:
            return None, f"ℹ️ 视频《{title}》的字幕内容为空"
        
        # 6. 提取文本
        text_content = []
        for item in body:
            content = item.get('content', '')
            if content:
                text_content.append(content)
        
        full_text = '\n'.join(text_content)
        
        if full_text:
            return full_text, f"✅ 成功提取《{title}》的字幕（{lang}）\n共 {len(full_text)} 字符"
        else:
            return None, f"ℹ️ 视频《{title}》的字幕无法解析"
            
    except requests.exceptions.Timeout:
        return None, "❌ 网络超时，请检查网络连接"
    except requests.exceptions.RequestException as e:
        return None, f"❌ 网络错误：{str(e)}"
    except json.JSONDecodeError:
        return None, "❌ 数据格式错误"
    except Exception as e:
        return None, f"❌ 提取失败：{str(e)}\n\n请尝试其他视频或手动上传字幕文件"


if __name__ == "__main__":
    # 测试
    test_urls = [
        "https://www.bilibili.com/video/BV1CizeBPEf1/",
        "https://www.bilibili.com/video/BV1GJ411x7h7",  # 示例
    ]
    
    print("=" * 60)
    print("B 站字幕提取测试")
    print("=" * 60)
    
    for url in test_urls:
        print(f"\n测试：{url}")
        print("-" * 40)
        content, message = extract_bilibili_subtitle(url)
        print(f"\n{message}")
        if content:
            print(f"\n预览：{content[:200]}...")
        print("-" * 40)
