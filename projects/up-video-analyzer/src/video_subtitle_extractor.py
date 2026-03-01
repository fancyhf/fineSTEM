"""
视频字幕提取工具
功能：从视频 URL 自动下载并生成字幕
支持：B站、抖音、西瓜视频等主流平台

流程：
1. 使用 yt-dlp 下载视频音频
2. 使用 Whisper 进行语音识别
3. 生成字幕文本
"""

import os
import re
import tempfile
import subprocess
from typing import Optional, Tuple

# 检查依赖
def check_dependencies():
    """检查必要的依赖是否安装"""
    missing = []
    
    try:
        import yt_dlp  # type: ignore
    except ImportError:
        missing.append("yt-dlp")
    
    try:
        import whisper  # type: ignore
    except ImportError:
        missing.append("openai-whisper")
    
    return missing


def download_audio(url: str, output_dir: str) -> Tuple[Optional[str], str]:
    """
    使用 yt-dlp 下载视频的音频部分
    
    Args:
        url: 视频 URL
        output_dir: 输出目录
    
    Returns:
        (音频文件路径, 状态消息)
    """
    try:
        import yt_dlp  # type: ignore
        
        # 配置 yt-dlp 选项
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(output_dir, '%(title)s.%(ext)s'),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'quiet': True,
            'no_warnings': True,
            'extractaudio': True,
            'noplaylist': True,
        }
        
        # 下载音频
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get('title', 'unknown')
            
            # 查找下载的文件
            for file in os.listdir(output_dir):
                if file.endswith('.mp3'):
                    return os.path.join(output_dir, file), f"✅ 音频下载成功：{title}"
        
        return None, "❌ 音频文件未找到"
        
    except Exception as e:
        return None, f"❌ 下载失败：{str(e)}"


def transcribe_audio(audio_path: str, model_size: str = "base") -> Tuple[Optional[str], str]:
    """
    使用 Whisper 进行语音识别
    
    Args:
        audio_path: 音频文件路径
        model_size: 模型大小 (tiny, base, small, medium, large)
    
    Returns:
        (字幕文本, 状态消息)
    """
    try:
        import whisper  # type: ignore
        
        # 加载模型
        print(f"正在加载 Whisper 模型 ({model_size})...")
        model = whisper.load_model(model_size)
        
        # 进行语音识别
        print("正在进行语音识别...")
        result = model.transcribe(audio_path, language='zh')
        
        # 提取文本
        text_segments = []
        for segment in result['segments']:
            text_segments.append(segment['text'])
        
        full_text = '\n'.join(text_segments)
        
        if full_text:
            return full_text, f"✅ 语音识别成功，共 {len(full_text)} 字符"
        else:
            return None, "❌ 未识别到语音内容"
            
    except Exception as e:
        return None, f"❌ 语音识别失败：{str(e)}"


def extract_subtitle_from_video(url: str, model_size: str = "base") -> Tuple[Optional[str], str]:
    """
    从视频 URL 提取字幕（完整流程）
    
    Args:
        url: 视频 URL
        model_size: Whisper 模型大小
    
    Returns:
        (字幕文本, 状态消息)
    """
    # 1. 检查依赖
    missing = check_dependencies()
    if missing:
        return None, f"❌ 请先安装依赖：pip install {' '.join(missing)}"
    
    # 2. 创建临时目录
    temp_dir = tempfile.mkdtemp()
    
    try:
        # 3. 下载音频
        audio_path, message = download_audio(url, temp_dir)
        if not audio_path:
            return None, message
        
        # 4. 语音识别
        subtitle, message = transcribe_audio(audio_path, model_size)
        
        return subtitle, message
        
    finally:
        # 5. 清理临时文件
        try:
            for file in os.listdir(temp_dir):
                os.remove(os.path.join(temp_dir, file))
            os.rmdir(temp_dir)
        except:
            pass


def extract_subtitle_from_video_simple(url: str) -> Tuple[Optional[str], str]:
    """
    从视频 URL 提取字幕（简化版，使用更小的模型）
    适合快速测试
    """
    return extract_subtitle_from_video(url, model_size="tiny")


if __name__ == "__main__":
    # 测试
    test_url = input("请输入视频链接：")
    
    print("\n" + "=" * 60)
    print("视频字幕提取测试")
    print("=" * 60)
    
    content, message = extract_subtitle_from_video_simple(test_url)
    
    print(f"\n{message}")
    
    if content:
        print(f"\n字幕内容预览：\n{content[:500]}...")
