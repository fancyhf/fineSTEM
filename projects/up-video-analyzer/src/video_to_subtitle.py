"""
视频字幕提取工具 - 在线API版
使用 yt-dlp 下载视频，使用 SiliconFlow SenseVoice 进行语音识别
支持保存到指定任务目录
"""

import os
import re
import sys
import tempfile
import subprocess
import json
import base64
import requests
import shutil
from typing import Optional, Tuple

# 添加本地 libs 目录到 Python 路径
LIBS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'libs')
if os.path.exists(LIBS_PATH) and LIBS_PATH not in sys.path:
    sys.path.insert(0, LIBS_PATH)

# SiliconFlow API 配置
SILICONFLOW_API_KEY = "sk-mqyhprbiobyydcqxtvbipknsfkdeqtndoucaqjkduvcdespg"
SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1"


def check_yt_dlp():
    """检查 yt-dlp 是否安装"""
    try:
        import yt_dlp  # type: ignore
        return True
    except ImportError:
        pass
    try:
        result = subprocess.run(
            ['python', '-m', 'yt_dlp', '--version'],
            capture_output=True,
            text=True
        )
        return result.returncode == 0
    except Exception:
        return False


def download_audio_from_video(url: str, output_path: str, progress_callback=None) -> Tuple[bool, str]:
    """
    使用 yt-dlp 下载视频的音频部分
    
    Args:
        url: 视频 URL
        output_path: 输出音频文件路径
        progress_callback: 进度回调函数，接收进度百分比
    
    Returns:
        (是否成功, 消息)
    """
    if not check_yt_dlp():
        return False, "❌ yt-dlp 未安装，请运行：pip install yt-dlp"
    
    try:
        # 设置环境变量，确保能找到本地 libs
        env = os.environ.copy()
        if LIBS_PATH not in env.get('PYTHONPATH', ''):
            env['PYTHONPATH'] = LIBS_PATH + ';' + env.get('PYTHONPATH', '')
        
        # 使用 yt-dlp 只下载音频流
        # -f bestaudio: 只选择最佳音频流，不下载视频
        # --extract-audio: 提取音频
        # --audio-format mp3: 转换为 mp3
        # --audio-quality 7: 低比特率（约 64kbps）
        # --cookies-from-browser: 尝试从浏览器获取 cookies（用于 B站等需要登录的平台）
        # --referer: 设置 referer（B站需要）
        cmd = [
            sys.executable, '-m', 'yt_dlp',
            '-f', 'bestaudio/bestaudio',  # 只选择音频流
            '--no-video',  # 不下载视频
            '--extract-audio',
            '--audio-format', 'mp3',
            '--audio-quality', '7',  # 低比特率，减小文件大小
            '-o', output_path,
            '--no-playlist',
            '--no-check-certificate',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            '--referer', 'https://www.bilibili.com',
            '--add-header', 'Origin:https://www.bilibili.com',
            url
        ]
        
        if progress_callback:
            progress_callback(20)
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,  # 5分钟超时
            env=env
        )
        
        if progress_callback:
            progress_callback(50)
        
        if result.returncode == 0:
            return True, f"✅ 音频下载成功"
        else:
            return False, f"❌ 下载失败：{result.stderr}"
            
    except subprocess.TimeoutExpired:
        return False, "❌ 下载超时，请检查网络连接"
    except Exception as e:
        return False, f"❌ 下载出错：{str(e)}"


def transcribe_with_siliconflow(audio_path: str, progress_callback=None) -> Tuple[Optional[str], str]:
    """
    使用 SiliconFlow SenseVoice API 进行语音识别
    
    Args:
        audio_path: 音频文件路径
        progress_callback: 进度回调函数
    
    Returns:
        (识别文本, 状态消息)
    """
    try:
        if progress_callback:
            progress_callback(60)
        
        # 调用 SiliconFlow API - 使用 multipart/form-data 格式
        url = f"{SILICONFLOW_BASE_URL}/audio/transcriptions"
        
        headers = {
            "Authorization": f"Bearer {SILICONFLOW_API_KEY}"
            # 注意：使用 multipart/form-data 时不要手动设置 Content-Type
        }
        
        # 获取文件扩展名用于确定 MIME 类型
        file_ext = os.path.splitext(audio_path)[1].lower()
        if file_ext == '.mp3':
            mime_type = 'audio/mpeg'
        elif file_ext == '.wav':
            mime_type = 'audio/wav'
        elif file_ext == '.m4a':
            mime_type = 'audio/mp4'
        elif file_ext == '.ogg':
            mime_type = 'audio/ogg'
        else:
            mime_type = 'audio/wav'
        
        # 构建 multipart/form-data 请求
        # 注意：SiliconFlow API 需要 file 字段包含音频文件
        with open(audio_path, 'rb') as audio_file:
            files = {
                'file': (os.path.basename(audio_path), audio_file, mime_type)
            }
            data = {
                'model': 'FunAudioLLM/SenseVoiceSmall'
            }
            
            print("正在调用 SiliconFlow SenseVoice API...")
            
            response = requests.post(
                url, 
                headers=headers, 
                files=files, 
                data=data, 
                timeout=120
            )
        
        if progress_callback:
            progress_callback(80)
        
        if response.status_code == 200:
            result = response.json()
            text = result.get('text', '')
            if text:
                return text, "✅ 语音识别成功"
            else:
                return None, "❌ 识别结果为空"
        else:
            error_msg = response.text
            return None, f"❌ API 调用失败 ({response.status_code}): {error_msg}"
            
    except requests.Timeout:
        return None, "❌ API 请求超时"
    except Exception as e:
        import traceback
        traceback.print_exc()
        return None, f"❌ 语音识别出错：{str(e)}"


def extract_subtitle_from_video(
    url: str, 
    task_id: Optional[str] = None,
    audio_output_dir: Optional[str] = None,
    progress_callback=None
) -> Tuple[Optional[str], str, Optional[str]]:
    """
    从视频 URL 提取字幕
    
    流程：
    1. 下载视频音频
    2. 使用 SiliconFlow SenseVoice 进行语音识别
    3. 返回字幕文本
    4. 保存音频到任务目录（如果提供了 task_id）
    
    Args:
        url: 视频 URL（支持 B站、抖音、西瓜视频等）
        task_id: 任务ID，用于保存文件到指定目录
        audio_output_dir: 音频输出目录（备用）
        progress_callback: 进度回调函数
    
    Returns:
        (字幕文本, 状态消息, 音频文件路径)
    """
    # 1. 检查 URL 格式
    if not url or not url.startswith('http'):
        return None, "❌ 请输入有效的视频链接", None
    
    # 2. 检测视频平台
    platform = None
    if 'bilibili.com' in url or 'b23.tv' in url:
        platform = "B站"
    elif 'douyin.com' in url or 'iesdouyin.com' in url:
        platform = "抖音"
    elif 'ixigua.com' in url or 'toutiao.com' in url:
        platform = "西瓜视频"
    elif 'youtube.com' in url or 'youtu.be' in url:
        platform = "YouTube"
    
    if not platform:
        return None, "⚠️ 未知平台，目前支持：B站、抖音、西瓜视频、YouTube", None
    
    print(f"检测到平台：{platform}")
    
    # 3. 确定音频保存路径
    temp_dir = None
    audio_path = None
    final_audio_path = None
    
    try:
        # 如果有 task_id，使用任务目录
        if task_id:
            from task_manager import get_task_manager
            task_manager = get_task_manager()
            audio_path = task_manager.storage.get_audio_path(task_id, "audio.mp3")
            final_audio_path = audio_path
            # 确保目录存在
            os.makedirs(os.path.dirname(audio_path), exist_ok=True)
        elif audio_output_dir:
            # 使用指定的输出目录
            os.makedirs(audio_output_dir, exist_ok=True)
            audio_path = os.path.join(audio_output_dir, 'audio.mp3')
            final_audio_path = audio_path
        else:
            # 使用临时目录
            temp_dir = tempfile.mkdtemp()
            audio_path = os.path.join(temp_dir, 'audio.mp3')
            final_audio_path = None  # 临时文件不返回
        
        if progress_callback:
            progress_callback(10)
        
        # 4. 下载音频
        print("正在下载视频音频...")
        success, message = download_audio_from_video(url, audio_path, progress_callback)
        
        if not success:
            return None, message, None
        
        print(message)
        
        # 5. 检查是否下载成功
        if not os.path.exists(audio_path):
            return None, "❌ 音频文件下载失败", None
        
        file_size = os.path.getsize(audio_path)
        print(f"音频文件大小：{file_size / 1024 / 1024:.2f} MB")
        
        # 检查文件大小限制（SiliconFlow API 限制）
        if file_size > 50 * 1024 * 1024:  # 50MB
            return None, "❌ 音频文件过大（>50MB），请选择较短的视频（建议5分钟以内）", None
        
        # 6. 使用 SiliconFlow SenseVoice 进行语音识别
        subtitle_text, message = transcribe_with_siliconflow(audio_path, progress_callback)
        
        if progress_callback:
            progress_callback(90)
        
        if subtitle_text:
            # 如果是临时文件，删除它
            if temp_dir and os.path.exists(audio_path):
                try:
                    os.remove(audio_path)
                    os.rmdir(temp_dir)
                except:
                    pass
                final_audio_path = None
            
            return (
                subtitle_text.strip(), 
                f"✅ 成功提取字幕\n共 {len(subtitle_text)} 字符\n平台：{platform}",
                final_audio_path
            )
        else:
            return None, message, None
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return None, f"❌ 处理出错：{str(e)}", None
    
    finally:
        # 清理临时文件
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
            except:
                pass


def extract_subtitle_from_video_simple(url: str) -> Tuple[Optional[str], str]:
    """
    简化版接口 - 保持向后兼容
    
    Args:
        url: 视频 URL
    
    Returns:
        (字幕文本, 状态消息)
    """
    content, message, _ = extract_subtitle_from_video(url)
    return content, message


if __name__ == "__main__":
    # 测试
    print("=" * 60)
    print("视频字幕提取工具（SiliconFlow SenseVoice 版）")
    print("=" * 60)
    
    url = input("\n请输入视频链接：")
    
    content, message, audio_path = extract_subtitle_from_video(url)
    
    print(f"\n{message}")
    
    if content:
        print(f"\n字幕内容预览：\n{content[:300]}...")
        if audio_path:
            print(f"\n音频文件保存位置：{audio_path}")
