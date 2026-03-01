"""
B 站字幕提取工具
支持从 B 站视频提取字幕（包括 CC 字幕和自动生成字幕）
"""

import re
import json
import requests
from typing import Optional, Tuple
from urllib.parse import urlencode
import hashlib
import time


def get_bvid(url: str) -> Optional[str]:
    """从 URL 提取 BV 号"""
    bv_match = re.search(r'(BV\w{10})', url)
    if bv_match:
        return bv_match.group(1)
    
    # 如果是 av 号，需要转换为 BV 号
    av_match = re.search(r'av(\d+)', url)
    if av_match:
        return f"av{av_match.group(1)}"
    
    return None


def get_video_info(bvid: str) -> Optional[dict]:
    """获取视频信息（包括 cid）"""
    if bvid.startswith('av'):
        # av 号需要转换
        url = f"https://api.bilibili.com/x/web-interface/view?aid={bvid[2:]}"
    else:
        url = f"https://api.bilibili.com/x/web-interface/view?bvid={bvid}"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        data = response.json()
        
        if data.get('code') == 0:
            return {
                'cid': data['data']['cid'],
                'title': data['data']['title'],
                'bvid': data['data']['bvid']
            }
        return None
    except Exception as e:
        print(f"获取视频信息失败：{e}")
        return None


def get_subtitle_list_wbi(cid: int, bvid: str) -> list:
    """
    获取字幕列表 (使用 WBI 加密参数)
    """
    # WBI 参数生成所需的一些固定值
    # 这里我们使用一种简化的处理方式，直接访问旧的 API
    # 或者尝试使用不同的 API 端点
    
    # 尝试使用 player.so 接口
    try:
        url = f"https://api.bilibili.com/x/player.so?id=cid:{cid}&bvid={bvid}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': f'https://www.bilibili.com/video/{bvid}'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.encoding = 'utf-8'
        
        # 检查响应是否包含字幕信息
        if '"subtitle"' in response.text:
            # 尝试解析 XML 响应
            import xml.etree.ElementTree as ET
            root = ET.fromstring(response.text)
            
            # 查找字幕相关信息
            for child in root.iter():
                if 'subtitle' in child.tag.lower():
                    return [{'subtitle_url': '', 'lan': 'xml', 'lan_doc': 'XML 字幕'}]
    except:
        pass
    
    # 尝试使用另一种 API 端点
    try:
        url = f"https://api.bilibili.com/x/player/v2?cid={cid}&bvid={bvid}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': f'https://www.bilibili.com/video/{bvid}'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        data = response.json()
        
        if data.get('code') == 0:
            subtitle_info = data['data'].get('subtitle', {})
            subtitles = subtitle_info.get('subtitles', [])
            return subtitles
    except Exception as e:
        print(f"WBI API 调用失败: {e}")
    
    return []


def extract_subtitle(subtitle_url: str) -> str:
    """提取字幕内容"""
    try:
        # 确保使用 HTTPS
        if subtitle_url.startswith('http:'):
            subtitle_url = subtitle_url.replace('http:', 'https:')
        
        response = requests.get(subtitle_url, timeout=10)
        data = response.json()
        
        # 提取字幕文本
        subtitles = data.get('body', [])
        text_content = []
        
        for item in subtitles:
            content = item.get('content', '')
            if content:
                text_content.append(content)
        
        return '\n'.join(text_content)
    except Exception as e:
        print(f"提取字幕失败：{e}")
        return ""


def extract_bilibili_subtitle(url: str) -> Tuple[Optional[str], str]:
    """
    从 B 站 URL 提取字幕
    返回：(字幕内容，状态消息)
    """
    # 1. 提取 BV 号
    bvid = get_bvid(url)
    if not bvid:
        return None, "❌ 未找到有效的视频 ID，请检查链接格式"
    
    # 2. 获取视频信息
    video_info = get_video_info(bvid)
    if not video_info:
        return None, "❌ 无法获取视频信息，请检查链接是否正确"
    
    cid = video_info['cid']
    title = video_info['title']
    
    # 3. 获取字幕列表 (使用新方法)
    subtitles = get_subtitle_list_wbi(cid, bvid)
    
    if not subtitles:
        return None, f"ℹ️ 视频《{title}》没有找到字幕\n\n可能的原因：\n• UP 主未上传字幕\n• 视频没有自动生成字幕\n• B 站 API 限制\n\n💡 建议：\n1. 使用「唧唧」等工具下载字幕\n2. 手动复制视频简介或评论\n3. 联系 UP 主提供字幕"
    
    # 4. 提取第一个字幕（通常是最主要的）
    subtitle = subtitles[0]
    subtitle_url = subtitle.get('subtitle_url', '')
    subtitle_title = subtitle.get('lan_doc', '字幕')
    
    if not subtitle_url:
        # 如果没有字幕 URL，可能是 XML 字幕或其他格式
        return None, f"ℹ️ 视频《{title}》有字幕但无法直接提取内容\n\n可能需要使用第三方工具：\n• DownKyi（唧唧）\n• Bilibili-Evolved 浏览器扩展\n• 手动复制字幕内容"
    
    # 5. 提取字幕内容
    content = extract_subtitle(subtitle_url)
    
    if content:
        return content, f"✅ 成功提取《{title}》的字幕（{subtitle_title}）\n共 {len(content)} 字符"
    else:
        return None, f"ℹ️ 视频《{title}》有字幕但内容提取失败\n\n可能需要使用第三方工具：\n• DownKyi（唧唧）\n• Bilibili-Evolved 浏览器扩展"


if __name__ == "__main__":
    # 测试
    test_url = input("请输入 B 站视频链接：")
    content, message = extract_bilibili_subtitle(test_url)
    print(f"\n{message}")
    if content:
        print(f"\n字幕内容预览：\n{content[:500]}...")
