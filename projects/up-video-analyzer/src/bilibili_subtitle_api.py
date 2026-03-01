"""
使用 bilibili-api-python 库提取字幕
官方库：https://github.com/Nemo2011/bilibili-api
"""

import asyncio
import re
from typing import Optional, Tuple

try:
    from bilibili_api import video, sync  # type: ignore
    BILI_API_AVAILABLE = True
except ImportError:
    BILI_API_AVAILABLE = False
    video = None  # type: ignore
    sync = None  # type: ignore
    print("⚠️ bilibili-api-python 未安装，请运行：pip install bilibili-api-python")


def extract_bvid(url: str) -> Optional[str]:
    """从 URL 提取 BV 号"""
    bv_match = re.search(r'(BV\w{10})', url)
    if bv_match:
        return bv_match.group(1)
    
    av_match = re.search(r'av(\d+)', url)
    if av_match:
        return f"av{av_match.group(1)}"
    
    return None


async def get_subtitle_async(bvid: str) -> Tuple[Optional[str], str]:
    """异步获取字幕"""
    if not BILI_API_AVAILABLE or video is None:
        return None, "❌ bilibili-api-python 未安装"
    
    try:
        # 创建视频对象
        v = video.Video(bvid=bvid)
        
        # 获取视频信息
        info = await v.get_info()
        title = info.get('title', '未知视频')
        
        # 获取字幕
        subtitle_info = await v.get_subtitle()
        
        if not subtitle_info or 'subtitles' not in subtitle_info:
            return None, f"ℹ️ 视频《{title}》没有找到字幕\n\n可能的原因：\n• UP 主未上传字幕\n• 视频没有自动生成字幕\n\n💡 建议：换一个有 CC 字幕标识的视频"
        
        subtitles = subtitle_info.get('subtitles', [])
        if not subtitles:
            return None, f"ℹ️ 视频《{title}》没有可用的字幕"
        
        # 获取第一个字幕（通常是主要字幕）
        first_subtitle = subtitles[0]
        subtitle_url = first_subtitle.get('subtitle_url', '')
        subtitle_lang = first_subtitle.get('lan_doc', '字幕')
        
        if not subtitle_url:
            return None, f"ℹ️ 视频《{title}》的字幕无法获取链接"
        
        # 下载字幕内容
        import requests
        if subtitle_url.startswith('http:'):
            subtitle_url = subtitle_url.replace('http:', 'https:')
        
        response = requests.get(subtitle_url, timeout=10)
        data = response.json()
        
        # 提取文本
        body = data.get('body', [])
        text_content = []
        for item in body:
            content = item.get('content', '')
            if content:
                text_content.append(content)
        
        full_text = '\n'.join(text_content)
        
        if full_text:
            return full_text, f"✅ 成功提取《{title}》的字幕（{subtitle_lang}）\n共 {len(full_text)} 字符"
        else:
            return None, f"ℹ️ 视频《{title}》的字幕内容为空"
            
    except Exception as e:
        return None, f"❌ 提取失败：{str(e)}"


def extract_bilibili_subtitle(url: str) -> Tuple[Optional[str], str]:
    """
    从 B 站 URL 提取字幕（使用 bilibili-api-python 库）
    """
    if not BILI_API_AVAILABLE:
        return None, "❌ 请先安装 bilibili-api-python：pip install bilibili-api-python"
    
    # 提取 BV 号
    bvid = extract_bvid(url)
    if not bvid:
        return None, "❌ 未找到有效的视频 ID，请检查链接格式"
    
    # 如果是 av 号，需要转换
    if bvid.startswith('av'):
        # bilibili-api-python 需要 BV 号
        # 这里需要转换
        try:
            from bilibili_api import video as video_module  # type: ignore
            aid = int(bvid[2:])
            # 创建视频对象时使用 aid
            v = video_module.Video(aid=aid)
            # 获取 bvid
            bvid = v.get_bvid()
        except Exception:
            return None, "❌ 无法转换 av 号，请使用 BV 号链接"
    
    # 使用同步方式调用异步函数
    try:
        if sync is None:
            return None, "❌ bilibili-api-python 未安装"
        return sync(get_subtitle_async(bvid))
    except Exception as e:
        return None, f"❌ 提取失败：{str(e)}"


if __name__ == "__main__":
    # 测试
    test_urls = [
        "https://www.bilibili.com/video/BV1CizeBPEf1/",
    ]
    
    print("=" * 60)
    print("B 站字幕提取测试（使用 bilibili-api-python 库）")
    print("=" * 60)
    
    for url in test_urls:
        print(f"\n测试：{url}")
        print("-" * 40)
        content, message = extract_bilibili_subtitle(url)
        print(f"\n{message}")
        if content:
            print(f"\n预览：{content[:300]}...")
        print("-" * 40)
