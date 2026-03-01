"""
项目：UP 主视频内容分析器
描述：上传视频字幕，AI 自动生成词云、统计分析和内容总结
技术栈：Python + Streamlit
创建时间：2026-02-28
维护者：AI Student Project Guide
文档：.trae/documents/projects/up-video-analyzer/docs/04_design.json
"""

import streamlit as st
import jieba
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from PIL import Image
import io
from collections import Counter
import re
import requests
import time
import os
from datetime import datetime

from typing import Optional, Tuple

# 导入字幕提取模块
try:
    from bilibili_subtitle_v3 import extract_bilibili_subtitle
    BILI_SUBTITLE_AVAILABLE = True
except ImportError:
    BILI_SUBTITLE_AVAILABLE = False
    def extract_bilibili_subtitle(url: str) -> Tuple[Optional[str], str]:
        return None, "❌ CC字幕提取模块加载失败"

# 导入视频字幕提取模块（下载视频+语音识别）
try:
    from video_to_subtitle import extract_subtitle_from_video
    VIDEO_TO_SUBTITLE_AVAILABLE = True
except ImportError:
    VIDEO_TO_SUBTITLE_AVAILABLE = False
    def extract_subtitle_from_video(url: str, task_id: Optional[str] = None, audio_output_dir: Optional[str] = None, progress_callback=None) -> Tuple[Optional[str], str, Optional[str]]:
        return None, "❌ 视频字幕提取模块加载失败", None

# 导入任务管理模块
try:
    from task_manager import get_task_manager, TaskStatus  # type: ignore
    TASK_MANAGER_AVAILABLE = True
except ImportError:
    TASK_MANAGER_AVAILABLE = False
    TaskStatus = None
    def get_task_manager(): return None  # type: ignore

# 设置 matplotlib 支持中文显示
plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei', 'Arial Unicode MS']
plt.rcParams['axes.unicode_minus'] = False

# 页面配置
st.set_page_config(
    page_title="UP 主视频内容分析器",
    page_icon="📹",
    layout="wide",
    initial_sidebar_state="expanded"
)

# 初始化 session state
if 'current_task_id' not in st.session_state:
    st.session_state.current_task_id = None
if 'selected_task_id' not in st.session_state:
    st.session_state.selected_task_id = None
if 'refresh_tasks' not in st.session_state:
    st.session_state.refresh_tasks = False
if 'extracted_content' not in st.session_state:
    st.session_state.extracted_content = None
if 'extracted_task_id' not in st.session_state:
    st.session_state.extracted_task_id = None
if 'active_tab' not in st.session_state:
    st.session_state.active_tab = "📝 新建任务"
if 'reanalyze_task_id' not in st.session_state:
    st.session_state.reanalyze_task_id = None

# 样式设置 (科技感 + 简约)
st.markdown("""
<style>
    .main {
        background-color: #0e1117;
    }
    .stButton>button {
        background-color: #4CAF50;
        color: white;
        border-radius: 8px;
        border: none;
        padding: 10px 24px;
        font-size: 16px;
    }
    .stButton>button:hover {
        background-color: #45a049;
    }
    .metric-card {
        background-color: #1e2330;
        padding: 20px;
        border-radius: 10px;
        margin: 10px 0;
    }
    h1, h2, h3 {
        color: #ffffff;
    }
    /* 中文化上传组件 */
    .stFileUploader {
        border: 2px dashed #4CAF50;
        border-radius: 10px;
        padding: 20px;
        background-color: #1e2330;
    }
    .stFileUploader:hover {
        border-color: #45a049;
        background-color: #252b3a;
    }
    .stFileUploader p {
        color: #ffffff !important;
        font-size: 16px;
    }
    .stFileUploader .st-emotion-cache-1v0mbhu {
        color: #ffffff !important;
    }
    /* 隐藏默认英文提示 */
    .stFileUploader .small {
        display: none;
    }
    /* 自定义中文提示 */
    .custom-upload-text::before {
        content: "将文件拖放到此处，或点击浏览文件";
        color: #cccccc;
        font-size: 14px;
    }
    /* 加宽输入框 2倍 */
    .stTextInput, .stTextInput > div, .stTextInput input {
        width: 100% !important;
        max-width: 100% !important;
    }
    .stTextInput input {
        font-size: 16px;
        padding: 12px 16px;
        background-color: #1e2330;
        border: 2px solid #4CAF50;
        border-radius: 8px;
        color: #ffffff;
    }
    .stTextInput input:focus {
        border-color: #45a049;
        box-shadow: 0 0 10px rgba(76, 175, 80, 0.3);
    }
    .stTextInput input::placeholder {
        color: #888888;
    }
    /* 加宽提示区域 */
    .stAlert, .stInfo, .stSuccess, .stWarning {
        width: 100% !important;
        max-width: 100% !important;
    }
    /* 加宽按钮区域 */
    .stColumns {
        width: 100% !important;
    }
    /* 任务列表样式 */
    .task-item {
        background-color: #1e2330;
        border-radius: 8px;
        padding: 12px;
        margin: 8px 0;
        border-left: 4px solid #4CAF50;
    }
    .task-item:hover {
        background-color: #252b3a;
    }
    .task-status-pending { border-left-color: #ffc107; }
    .task-status-downloading { border-left-color: #17a2b8; }
    .task-status-extracting { border-left-color: #6f42c1; }
    .task-status-completed { border-left-color: #28a745; }
    .task-status-failed { border-left-color: #dc3545; }
    /* 执行报告样式 */
    .report-card {
        background-color: #1e2330;
        border-radius: 10px;
        padding: 20px;
        margin: 10px 0;
    }
    .report-section {
        margin: 15px 0;
        padding: 15px;
        background-color: #252b3a;
        border-radius: 8px;
    }
</style>
""", unsafe_allow_html=True)

# 获取任务管理器
task_manager = get_task_manager() if TASK_MANAGER_AVAILABLE else None

# 辅助函数
def get_status_icon(status):
    """获取状态图标"""
    icons = {
        'pending': '⏳',
        'downloading': '⬇️',
        'extracting': '🎯',
        'analyzing': '📊',
        'completed': '✅',
        'failed': '❌',
        'cancelled': '🚫'
    }
    return icons.get(status, '❓')

def get_status_text(status):
    """获取状态文本"""
    texts = {
        'pending': '等待中',
        'downloading': '下载中',
        'extracting': '提取中',
        'analyzing': '分析中',
        'completed': '已完成',
        'failed': '失败',
        'cancelled': '已取消'
    }
    return texts.get(status, status)

def format_time(dt_str):
    """格式化时间"""
    try:
        dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
        return dt.strftime("%m-%d %H:%M")
    except:
        return dt_str

def truncate_url(url, max_len=40):
    """截断 URL 显示"""
    if len(url) <= max_len:
        return url
    return url[:max_len] + "..."

# 侧边栏
with st.sidebar:
    st.header("📊 任务统计")
    
    if task_manager:
        stats = task_manager.get_stats()
        
        col1, col2 = st.columns(2)
        with col1:
            st.metric("总任务", stats['total'])
        with col2:
            st.metric("成功率", f"{stats['success_rate']:.0f}%")
        
        col3, col4 = st.columns(2)
        with col3:
            st.metric("已完成", stats['completed'])
        with col4:
            st.metric("失败", stats['failed'])
        
        if stats['downloading'] > 0 or stats['extracting'] > 0:
            st.info(f"⏳ 进行中: {stats['downloading']} 下载, {stats['extracting']} 提取")
    else:
        st.warning("任务管理器未加载")
    
    st.markdown("---")
    st.markdown("**支持格式**:")
    st.markdown("- SRT 字幕文件")
    st.markdown("- TXT 文本文件")
    st.markdown("- B 站/抖音等视频链接")
    
    st.markdown("---")
    st.markdown("**功能说明**:")
    st.markdown("1. ☁️ 词频可视化")
    st.markdown("2. 📊 数据统计面板")
    st.markdown("3. 🤖 AI 智能总结")
    st.markdown("4. 📥 导出报告")

# 主界面 - 使用标签页
st.title("📹 UP 主视频内容分析器")
st.markdown("### 上传视频字幕，AI 自动生成词云、统计分析和内容总结")
st.markdown("---")

# 使用 radio 按钮模拟标签页，以便程序控制切换
tab_options = ["📝 新建任务", "📋 任务历史", "📊 执行报告"]
selected_tab = st.radio(
    "选择功能:",
    tab_options,
    horizontal=True,
    label_visibility="collapsed",
    index=tab_options.index(st.session_state.active_tab) if st.session_state.active_tab in tab_options else 0
)

# 如果用户手动切换了标签页，更新 session_state
if selected_tab != st.session_state.active_tab:
    st.session_state.active_tab = selected_tab
    st.rerun()

st.markdown("---")

# ========== 标签页 1: 新建任务 ==========
if selected_tab == "📝 新建任务":
    col1, col2 = st.columns([1, 2])
    
    with col1:
        st.header("📤 输入方式")
        
        # 添加输入方式选择
        input_method = st.radio(
            "选择输入方式:",
            ["📁 上传字幕文件", "🔗 粘贴视频链接"],
            horizontal=False
        )
        
        file_content = None
        current_task = None
        uploaded_file = None
        
        # 初始化视频链接相关的 session state
        if 'confirmed_video_url' not in st.session_state:
            st.session_state.confirmed_video_url = None
        if 'confirmed_platform' not in st.session_state:
            st.session_state.confirmed_platform = None
        
        # 检查是否有重新分析的任务
        if st.session_state.reanalyze_task_id:
            reanalyze_task = task_manager.get_task(st.session_state.reanalyze_task_id) if task_manager else None
            if reanalyze_task and reanalyze_task.subtitle_content:
                file_content = reanalyze_task.subtitle_content
                current_task = reanalyze_task
                st.success(f"✅ 已加载历史字幕，共 {len(file_content)} 字符")
                st.info(f"📋 任务ID: {reanalyze_task.id} | 平台: {reanalyze_task.platform}")
                
                # 添加清除按钮
                if st.button("🗑️ 清除当前内容", use_container_width=True):
                    st.session_state.reanalyze_task_id = None
                    st.rerun()
        # 检查是否有从视频提取保存的内容
        elif st.session_state.extracted_content and st.session_state.extracted_task_id:
            file_content = st.session_state.extracted_content
            current_task = task_manager.get_task(st.session_state.extracted_task_id) if task_manager else None
            st.success(f"✅ 已提取字幕，共 {len(file_content)} 字符")
            
            # 添加清除按钮
            if st.button("🗑️ 清除当前内容", use_container_width=True):
                st.session_state.extracted_content = None
                st.session_state.extracted_task_id = None
                st.rerun()
        
        if input_method == "📁 上传字幕文件":
            uploaded_file = st.file_uploader(
                "拖拽文件到此处，或点击上传",
                type=['srt', 'txt'],
                help="支持 SRT 字幕文件和 TXT 纯文本文件",
                label_visibility="collapsed"
            )
            
            if uploaded_file is not None:
                st.success(f"✅ 已上传：{uploaded_file.name}")
                
                # 读取文件内容
                try:
                    file_content = uploaded_file.read().decode('utf-8')
                    st.info(f"文件大小：{len(file_content)} 字符")
                    
                    # 创建任务记录
                    if task_manager:
                        current_task = task_manager.create_task(
                            url=f"file://{uploaded_file.name}",
                            platform="本地文件"
                        )
                        st.session_state.current_task_id = current_task.id
                        
                except Exception as e:
                    st.error(f"读取文件失败：{str(e)}")
                    file_content = None
        else:
            # 使用更宽的容器和更大的输入框
            st.markdown("<style>.stTextInput > div > div > input { font-size: 16px; }</style>", unsafe_allow_html=True)
            
            video_url = st.text_area(
                "粘贴视频链接",
                placeholder="支持 B站、抖音、西瓜视频、YouTube 等",
                help="自动下载视频并提取字幕",
                key="video_url_input",
                height=80
            )
            
            # 确认按钮
            confirm_clicked = st.button("✅ 确认链接", use_container_width=True, type="primary")
            
            if video_url and confirm_clicked:
                # 检测视频平台
                platform = None
                if 'bilibili.com' in video_url or 'b23.tv' in video_url:
                    platform = "B站"
                elif 'douyin.com' in video_url or 'iesdouyin.com' in video_url:
                    platform = "抖音"
                elif 'ixigua.com' in video_url or 'toutiao.com' in video_url:
                    platform = "西瓜视频"
                elif 'youtube.com' in video_url or 'youtu.be' in video_url:
                    platform = "YouTube"
                
                if platform:
                    st.success(f"✅ 已确认平台：{platform}")
                    
                    # 保存到 session state
                    st.session_state.confirmed_video_url = video_url
                    st.session_state.confirmed_platform = platform
                    
                    # 创建任务
                    if task_manager:
                        current_task = task_manager.create_task(
                            url=video_url,
                            platform=platform
                        )
                        st.session_state.current_task_id = current_task.id
                        st.session_state.confirmed_task_id = current_task.id
                    
                    st.rerun()
                else:
                    st.warning("⚠️ 未知平台，目前支持：B站、抖音、西瓜视频、YouTube")
            
            # 显示已确认的链接和提取选项
            if st.session_state.confirmed_video_url and st.session_state.confirmed_platform:
                video_url = st.session_state.confirmed_video_url
                platform = st.session_state.confirmed_platform
                
                st.success(f"✅ 已确认平台：{platform}")
                
                # 获取当前任务
                if task_manager and hasattr(st.session_state, 'confirmed_task_id'):
                    current_task = task_manager.get_task(st.session_state.confirmed_task_id)
                
                # 清除确认按钮
                if st.button("🗑️ 清除链接", use_container_width=True):
                    st.session_state.confirmed_video_url = None
                    st.session_state.confirmed_platform = None
                    if hasattr(st.session_state, 'confirmed_task_id'):
                        del st.session_state.confirmed_task_id
                    st.rerun()
                
                # 两个提取选项
                col_btn1, col_btn2 = st.columns(2)
                
                with col_btn1:
                    extract_btn = st.button("🔄 提取字幕", use_container_width=True)
                
                with col_btn2:
                    download_btn = st.button("⬇️ 下载视频提取", use_container_width=True)
                
                # 提取 CC 字幕（仅 B 站）
                if extract_btn:
                    if platform != "B站":
                        st.warning("⚠️ CC 字幕提取仅支持 B 站视频")
                    elif not BILI_SUBTITLE_AVAILABLE:
                        st.error("❌ CC 字幕提取模块加载失败")
                    else:
                        # 更新任务状态
                        if current_task and task_manager and TASK_MANAGER_AVAILABLE and TaskStatus is not None:
                            task_manager.update_task(  # type: ignore
                                current_task.id,
                                status=TaskStatus.EXTRACTING.value,
                                progress=30
                            )
                        
                        with st.spinner("正在提取 CC 字幕..."):
                            start_time = time.time()
                            content, message = extract_bilibili_subtitle(video_url)
                            elapsed = time.time() - start_time
                            
                            if current_task and task_manager and TASK_MANAGER_AVAILABLE and TaskStatus is not None:
                                if "✅" in message:
                                    task_manager.update_task(  # type: ignore
                                        current_task.id,
                                        status=TaskStatus.COMPLETED.value,
                                        progress=100,
                                        subtitle_content=content,
                                        elapsed_time=elapsed
                                    )
                                    st.success(message)
                                    # 保存到 session_state 以便分析使用
                                    st.session_state.extracted_content = content
                                    st.session_state.extracted_task_id = current_task.id
                                    # 清除确认状态
                                    st.session_state.confirmed_video_url = None
                                    st.session_state.confirmed_platform = None
                                    if hasattr(st.session_state, 'confirmed_task_id'):
                                        del st.session_state.confirmed_task_id
                                    st.rerun()
                                else:
                                    if current_task and task_manager and TASK_MANAGER_AVAILABLE and TaskStatus is not None:
                                        task_manager.update_task(  # type: ignore
                                            current_task.id,
                                            status=TaskStatus.FAILED.value,
                                            progress=0,
                                            error_message=message,
                                            elapsed_time=elapsed
                                        )
                                    st.info(message)
                                    st.info("💡 建议：尝试使用「下载视频提取」功能")
                
                # 下载视频并生成字幕
                if download_btn:
                        if not VIDEO_TO_SUBTITLE_AVAILABLE:
                            st.error("❌ 视频字幕提取模块加载失败")
                            st.code("pip install yt-dlp openai-whisper", language="bash")
                        else:
                            # 更新任务状态
                            if current_task and task_manager and TASK_MANAGER_AVAILABLE and TaskStatus is not None:
                                task_manager.update_task(  # type: ignore
                                    current_task.id,
                                    status=TaskStatus.DOWNLOADING.value,
                                    progress=10
                                )
                            
                            progress_placeholder = st.empty()
                            progress_bar = st.progress(0)
                            status_text_placeholder = st.empty()
                            status_text_placeholder.info("⬇️ 正在下载视频音频...")
                            
                            # 进度回调函数
                            def update_progress(progress):
                                progress_bar.progress(min(progress, 100))
                                if progress < 30:
                                    status_text_placeholder.info("⬇️ 正在下载视频音频...")
                                elif progress < 60:
                                    status_text_placeholder.info("🎯 正在提取音频...")
                                    if current_task and task_manager and TASK_MANAGER_AVAILABLE and TaskStatus is not None:
                                        task_manager.update_task(  # type: ignore
                                            current_task.id,
                                            status=TaskStatus.EXTRACTING.value,
                                            progress=progress
                                        )
                                elif progress < 90:
                                    status_text_placeholder.info("🤖 正在进行语音识别...")
                                else:
                                    status_text_placeholder.info("✅ 处理完成！")
                            
                            with st.spinner("正在下载视频并提取字幕，这可能需要几分钟..."):
                                start_time = time.time()
                                
                                # 调用提取函数，传入 task_id 以保存音频到任务目录
                                content, message, audio_path = extract_subtitle_from_video(
                                    video_url,
                                    task_id=current_task.id if current_task else None,
                                    progress_callback=update_progress
                                )
                                elapsed = time.time() - start_time
                                
                                progress_bar.empty()
                                status_text_placeholder.empty()
                                progress_placeholder.empty()
                                
                                if current_task and task_manager and TASK_MANAGER_AVAILABLE and TaskStatus is not None:
                                    if "✅" in message:
                                        # 保存字幕到任务目录
                                        task_manager.save_subtitle(current_task.id, content)  # type: ignore
                                        
                                        # 更新任务状态
                                        task_manager.update_task(  # type: ignore
                                            current_task.id,
                                            status=TaskStatus.COMPLETED.value,
                                            progress=100,
                                            subtitle_content=content,
                                            elapsed_time=elapsed,
                                            audio_file=audio_path
                                        )
                                        
                                        # 显示成功信息和文件位置
                                        st.success(f"{message}\n\n⏱️ 耗时: {elapsed:.1f} 秒")
                                        if audio_path:
                                            st.info(f"💾 音频已保存: `{audio_path}`")
                                        
                                        # 保存到 session_state 以便分析使用
                                        st.session_state.extracted_content = content
                                        st.session_state.extracted_task_id = current_task.id
                                        st.rerun()
                                    else:
                                        if current_task and task_manager and TASK_MANAGER_AVAILABLE and TaskStatus is not None:
                                            task_manager.update_task(  # type: ignore
                                                current_task.id,
                                                status=TaskStatus.FAILED.value,
                                                progress=0,
                                                error_message=message,
                                                elapsed_time=elapsed
                                            )
                                        st.warning(f"{message}\n\n⏱️ 耗时: {elapsed:.1f} 秒")
                else:
                    st.warning("⚠️ 未知平台，目前支持：B站、抖音、西瓜视频、YouTube")
        
        analyze_btn = st.button(
            "🔍 开始分析",
            disabled=(file_content is None),
            use_container_width=True
        )

    with col2:
        st.header("🖼️ 分析结果")
        
        if file_content and analyze_btn:
            # 更新任务状态
            if current_task and task_manager and TASK_MANAGER_AVAILABLE and TaskStatus is not None:
                task_manager.update_task(  # type: ignore
                    current_task.id,
                    status=TaskStatus.ANALYZING.value,
                    progress=80
                )
            
            with st.spinner("正在分析内容，请稍候..."):
                # 1. 文本预处理
                if input_method == "📁 上传字幕文件" and uploaded_file is not None and uploaded_file.name.endswith('.srt'):
                    # SRT 格式处理 (简单去除时间轴)
                    lines = file_content.split('\n')
                    text_lines = []
                    for line in lines:
                        if '-->' not in line and not line.strip().isdigit() and line.strip():
                            text_lines.append(line.strip())
                    clean_text = ' '.join(text_lines)
                else:
                    clean_text = file_content
                
                # 2. 中文分词
                words = jieba.lcut(clean_text)
                
                # 3. 加载停用词表
                stopwords = set()
                stopwords_path = os.path.join(os.path.dirname(__file__), 'stopwords.txt')
                if os.path.exists(stopwords_path):
                    with open(stopwords_path, 'r', encoding='utf-8') as f:
                        for line in f:
                            word = line.strip()
                            if word and not word.startswith('#') and not word.startswith('中文') and not word.startswith('来源') and len(word) < 20:
                                stopwords.add(word)
                
                # 添加基础停用词（确保核心词被过滤）
                basic_stopwords = {
                    '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', 
                    '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', 
                    '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '他',
                    '她', '它', '们', '这个', '那个', '什么', '怎么', '这样', '那样',
                    '可以', '可能', '应该', '必须', '需要', '能够', '能', '要', '得',
                    '还', '又', '再', '已', '已经', '正在', '将', '将要', '快要',
                    '但', '但是', '然而', '如果', '因为', '所以', '因此', '于是',
                    '虽然', '即使', '尽管', '不过', '只是', '只有', '只要', '无论',
                    '或者', '还是', '以及', '及', '与', '或', '而', '而且', '并',
                    '并且', '并', '且', '也', '都', '就', '才', '只', '仅', '光',
                    '刚', '刚刚', '已', '已经', '曾', '曾经', '正', '正在', '将',
                    '要', '得', '地', '着', '过', '啊', '呀', '哦', '嗯', '哎',
                    '唉', '嗨', '喂', '哼', '哇', '哈', '嘿', '嘻', '呵', '噢',
                    '喔', '呗', '哒', '滴', '咯', '嘛', '么', '吗', '呢', '吧'
                }
                stopwords.update(basic_stopwords)
                
                # 4. 过滤停用词、单字、数字和纯标点
                filtered_words = [
                    w for w in words 
                    if w not in stopwords 
                    and len(w) > 1 
                    and not w.isdigit()
                    and not re.match(r'^[^\u4e00-\u9fa5a-zA-Z]+$', w)
                ]
                
                # 5. 词频统计
                word_freq = Counter(filtered_words)
                top_words = word_freq.most_common(20)
                
                # 6. 生成词频柱状图
                st.subheader("☁️ 词频可视化")
                fig = None
                if top_words:
                    fig, ax = plt.subplots(figsize=(10, 6))
                    words_list = [w[0] for w in top_words]
                    freqs = [w[1] for w in top_words]
                    colors = plt.cm.get_cmap('viridis')(np.linspace(0, 0.8, len(words_list)))
                    ax.barh(range(len(words_list)), freqs, color=colors)
                    ax.set_yticks(range(len(words_list)))
                    ax.set_yticklabels(words_list)
                    ax.set_xlabel('频次')
                    ax.set_title('高频词 TOP20')
                    plt.tight_layout()
                    st.pyplot(fig)
                    plt.close()
                
                # 7. 统计面板
                st.subheader("📊 数据统计")
                
                col_stats1, col_stats2, col_stats3 = st.columns(3)
                with col_stats1:
                    st.metric("总词数", len(filtered_words))
                with col_stats2:
                    st.metric("不重复词数", len(word_freq))
                with col_stats3:
                    st.metric("平均词长", f"{np.mean([len(w) for w in filtered_words]):.1f}字")
                
                # 8. 高频词表格
                st.subheader("🔝 高频词 TOP20")
                df_words = pd.DataFrame(top_words, columns=pd.Index(['词语', '频次']))
                st.dataframe(df_words, use_container_width=True, hide_index=True)
                
                # 9. AI 总结 (模拟)
                st.subheader("🤖 AI 智能总结")
                if top_words:
                    top_keywords = ', '.join([w[0] for w in top_words[:5]])
                    summary = f"""
                    这段内容主要讨论了以下关键话题：
                    
                    **核心关键词**: {top_keywords}
                    
                    **内容特点**:
                    - 使用了 {len(filtered_words)} 个词汇，表达{'丰富' if len(filtered_words) > 500 else '简洁'}
                    - 不重复词汇 {len(word_freq)} 个，词汇多样性{'较高' if len(word_freq) > 200 else '一般'}
                    - 高频词集中度{'较高' if top_words[0][1] > 20 else '较低'}
                    
                    **建议**:
                    这些关键词反映了内容的核心主题，可以用于视频标签、标题优化等场景。
                    """
                    st.info(summary)
                else:
                    st.warning("无法生成总结，请检查文本内容")
                
                # 10. 导出功能
                st.subheader("📥 导出报告")
                
                # 导出柱状图
                if fig is not None:
                    img_buffer = io.BytesIO()
                    fig.savefig(img_buffer, format='PNG', dpi=150, bbox_inches='tight')
                    img_buffer.seek(0)
                    
                    col_exp1, col_exp2 = st.columns(2)
                    with col_exp1:
                        st.download_button(
                            label="下载词频图表 (PNG)",
                            data=img_buffer,
                            file_name="word_frequency_chart.png",
                            mime="image/png",
                            use_container_width=True
                        )
                    
                    with col_exp2:
                        # 导出 CSV
                        csv_data = df_words.to_csv(index=False).encode('utf-8-sig')
                        st.download_button(
                            label="下载词频数据 (CSV)",
                            data=csv_data,
                            file_name="word_frequency.csv",
                            mime="text/csv",
                            use_container_width=True
                        )
                else:
                    # 没有 fig 时只导出 CSV
                    csv_data = df_words.to_csv(index=False).encode('utf-8-sig')
                    st.download_button(
                        label="下载词频数据 (CSV)",
                        data=csv_data,
                        file_name="word_frequency.csv",
                        mime="text/csv",
                        use_container_width=True
                    )
                
                # 更新任务完成状态
                if current_task and task_manager and TASK_MANAGER_AVAILABLE and TaskStatus is not None:
                    analysis_result = {
                        'word_freq': dict(word_freq),
                        'top_words': top_words,
                        'total_words': len(filtered_words),
                        'unique_words': len(word_freq)
                    }
                    # 保存分析结果到任务目录
                    task_manager.save_analysis_result(current_task.id, analysis_result)  # type: ignore
                    # 保存词频图表
                    if fig is not None:
                        chart_path = task_manager.storage.get_analysis_path(current_task.id, 'word_frequency_chart.png')  # type: ignore
                        fig.savefig(chart_path, format='PNG', dpi=150, bbox_inches='tight')
                    # 更新任务状态
                    task_manager.update_task(  # type: ignore
                        current_task.id,
                        status=TaskStatus.COMPLETED.value,
                        progress=100,
                        analysis_result=analysis_result
                    )
                
        elif file_content:
            st.info("👆 请点击「开始分析」按钮")
        else:
            st.info("等待上传文件或输入视频链接...")

# ========== 标签页 2: 任务历史 ==========
if selected_tab == "📋 任务历史":
    st.header("📋 任务历史记录")
    
    if not task_manager:
        st.error("❌ 任务管理器未加载")
    else:
        # 刷新按钮
        col_refresh, col_clear = st.columns([1, 5])
        with col_refresh:
            if st.button("🔄 刷新", use_container_width=True):
                st.rerun()
        
        # 获取所有任务
        tasks = task_manager.get_all_tasks()
        
        if not tasks:
            st.info("暂无任务记录，请在「新建任务」标签页创建任务")
        else:
            st.write(f"共 {len(tasks)} 个任务")
            
            # 筛选选项
            filter_status = st.selectbox(
                "筛选状态:",
                ["全部", "等待中", "下载中", "提取中", "已完成", "失败"],
                index=0
            )
            
            # 过滤任务
            status_map = {
                "等待中": "pending",
                "下载中": "downloading",
                "提取中": "extracting",
                "已完成": "completed",
                "失败": "failed"
            }
            target_status = status_map.get(filter_status)
            if target_status is None or filter_status == "全部":
                filtered_tasks = list(tasks)
            else:
                filtered_tasks = [t for t in tasks if t.status == target_status]
            
            # 显示任务列表
            for task in filtered_tasks:
                with st.container():
                    status_icon = get_status_icon(task.status)
                    status_text = get_status_text(task.status)
                    
                    # 创建任务卡片
                    col_task1, col_task2, col_task3 = st.columns([3, 2, 2])
                    
                    with col_task1:
                        st.write(f"**{status_icon} {task.platform}**")
                        st.caption(f"🔗 {truncate_url(task.url)}")
                        st.caption(f"🕐 {format_time(task.created_at)}")
                    
                    with col_task2:
                        st.write(f"状态: **{status_text}**")
                        if task.progress > 0:
                            st.progress(task.progress / 100, text=f"{task.progress}%")
                        if task.elapsed_time:
                            st.caption(f"⏱️ {task.elapsed_time:.1f}秒")
                    
                    with col_task3:
                        # 操作按钮 - 使用容器确保布局一致
                        with st.container():
                            # 已完成且有字幕内容的任务 - 显示查看报告、重新分析、删除
                            if task.status == 'completed':
                                has_subtitle = task.subtitle_content is not None and len(task.subtitle_content) > 0
                                if has_subtitle:
                                    # 第一行：查看报告 + 重新分析
                                    col_btn1, col_btn2 = st.columns(2)
                                    with col_btn1:
                                        if st.button("📊 查看报告", key=f"view_{task.id}", use_container_width=True):
                                            st.session_state.selected_task_id = task.id
                                            st.session_state.active_tab = "📊 执行报告"
                                            st.rerun()
                                    with col_btn2:
                                        if st.button("🔄 重新分析", key=f"reanalyze_{task.id}", use_container_width=True):
                                            st.session_state.selected_task_id = task.id
                                            st.session_state.reanalyze_task_id = task.id
                                            st.session_state.active_tab = "📝 新建任务"
                                            st.rerun()
                                else:
                                    # 已完成但没有字幕内容
                                    st.info("无字幕内容")
                                
                                # 删除按钮（所有已完成任务都显示）
                                if st.button("🗑️ 删除", key=f"delete_{task.id}", use_container_width=True):
                                    task_manager.delete_task(task.id)
                                    st.rerun()
                            
                            # 失败的任务 - 显示重试和删除
                            elif task.status == 'failed':
                                if st.button("🔄 重试", key=f"retry_{task.id}", use_container_width=True):
                                    task_manager.retry_task(task.id)
                                    st.session_state.selected_task_id = task.id
                                    st.rerun()
                                if st.button("🗑️ 删除", key=f"delete_{task.id}", use_container_width=True):
                                    task_manager.delete_task(task.id)
                                    st.rerun()
                            
                            # 其他状态（等待中、下载中、提取中）- 只显示删除
                            else:
                                if st.button("🗑️ 删除", key=f"delete_{task.id}", use_container_width=True):
                                    task_manager.delete_task(task.id)
                                    st.rerun()
                    
                    # 显示错误信息
                    if task.error_message and task.status == 'failed':
                        st.error(f"错误: {task.error_message}")
                    
                    st.divider()

# ========== 标签页 3: 执行报告 ==========
if selected_tab == "📊 执行报告":
    st.header("📊 执行报告")
    
    if not task_manager:
        st.error("❌ 任务管理器未加载")
    else:
        # 存储统计
        with st.expander("💾 存储统计", expanded=True):
            storage_stats = task_manager.get_storage_stats()
            col_s1, col_s2, col_s3, col_s4 = st.columns(4)
            with col_s1:
                st.metric("总任务数", storage_stats['total_tasks'])
            with col_s2:
                st.metric("总存储大小", f"{storage_stats['total_size_mb']} MB")
            with col_s3:
                st.metric("音频文件", storage_stats['audio_files'])
            with col_s4:
                st.metric("字幕文件", storage_stats['subtitle_files'])
        
        st.markdown("---")
        
        # 选择要查看的任务
        if TASK_MANAGER_AVAILABLE and TaskStatus is not None:
            completed_tasks = task_manager.get_tasks_by_status(TaskStatus.COMPLETED)
        else:
            completed_tasks = []
        
        if not completed_tasks:
            st.info("暂无已完成的任务报告")
        else:
            # 任务选择器
            task_options = {f"{t.platform} - {format_time(t.created_at)} ({t.id})": t.id for t in completed_tasks}
            
            # 如果有选中的任务ID，找到对应的索引
            default_index = 0
            if st.session_state.selected_task_id:
                for i, (label, tid) in enumerate(task_options.items()):
                    if tid == st.session_state.selected_task_id:
                        default_index = i
                        break
            
            selected_task_label = st.selectbox(
                "选择任务查看报告:",
                options=list(task_options.keys()),
                index=default_index
            )
            
            if selected_task_label:
                task_id = task_options[selected_task_label]
                task = task_manager.get_task(task_id)
                
                if task:
                    # 显示报告
                    st.markdown("<div class='report-card'>", unsafe_allow_html=True)
                    
                    # 任务基本信息
                    st.subheader("📋 任务信息")
                    col_r1, col_r2, col_r3, col_r4 = st.columns(4)
                    with col_r1:
                        st.metric("平台", task.platform)
                    with col_r2:
                        st.metric("处理时间", f"{task.elapsed_time:.1f}秒" if task.elapsed_time else "N/A")
                    with col_r3:
                        subtitle_len = len(task.subtitle_content) if task.subtitle_content else 0
                        st.metric("字幕长度", f"{subtitle_len}字符")
                    with col_r4:
                        st.metric("任务ID", task.id)
                    
                    # 文件位置信息
                    if task.task_dir:
                        st.info(f"📁 任务目录: `{task.task_dir}`")
                    
                    # 分析结果
                    if task.analysis_result:
                        st.subheader("📊 分析结果")
                        result = task.analysis_result
                        
                        col_a1, col_a2, col_a3 = st.columns(3)
                        with col_a1:
                            st.metric("总词数", result.get('total_words', 0))
                        with col_a2:
                            st.metric("不重复词数", result.get('unique_words', 0))
                        with col_a3:
                            top_words = result.get('top_words', [])
                            if top_words:
                                st.metric("最高频词", f"{top_words[0][0]} ({top_words[0][1]}次)")
                        
                        # 高频词表格
                        if top_words:
                            st.subheader("🔝 高频词 TOP20")
                            df = pd.DataFrame(top_words, columns=pd.Index(['词语', '频次']))
                            st.dataframe(df, use_container_width=True, hide_index=True)
                        
                        # 显示保存的图表
                        chart_path = task_manager.storage.get_analysis_path(task_id, 'word_frequency_chart.png')
                        if os.path.exists(chart_path):
                            st.subheader("📈 词频图表")
                            st.image(chart_path, use_container_width=True)
                    else:
                        # 没有分析结果时显示提示
                        st.warning("⚠️ 该任务尚未生成分析报告")
                        if st.button("🔄 立即生成分析报告", use_container_width=True):
                            st.session_state.reanalyze_task_id = task.id
                            st.session_state.active_tab = "📝 新建任务"
                            st.rerun()
                    
                    # 字幕内容
                    st.subheader("📝 字幕内容")
                    
                    # 从文件加载完整字幕
                    full_subtitle = task_manager.load_subtitle(task_id)
                    if full_subtitle:
                        with st.expander("点击查看完整字幕", expanded=False):
                            st.text_area("字幕内容", full_subtitle, height=300)
                        
                        # 下载字幕按钮
                        col_dl1, col_dl2 = st.columns(2)
                        with col_dl1:
                            st.download_button(
                                label="📥 下载字幕 (TXT)",
                                data=full_subtitle.encode('utf-8'),
                                file_name=f"subtitle_{task.id}.txt",
                                mime="text/plain",
                                use_container_width=True
                            )
                        with col_dl2:
                            # 下载音频按钮
                            if task.audio_file and os.path.exists(task.audio_file):
                                with open(task.audio_file, 'rb') as f:
                                    st.download_button(
                                        label="📥 下载音频 (MP3)",
                                        data=f,
                                        file_name=f"audio_{task.id}.mp3",
                                        mime="audio/mpeg",
                                        use_container_width=True
                                    )
                    
                    # 执行日志
                    with st.expander("📜 查看执行日志"):
                        log_content = task_manager.get_task_log(task_id)
                        if log_content:
                            st.code(log_content, language='text')
                        else:
                            st.info("暂无日志")
                    
                    st.markdown("</div>", unsafe_allow_html=True)
                else:
                    st.warning("该任务暂无分析报告")

# 底部说明
st.markdown("---")
st.markdown(
    """
    <div style='text-align: center; color: #888;'>
        <p>💡 提示：分析结果仅供参考，建议结合人工判断</p>
        <p>📚 技术栈：Python + Streamlit + Jieba + SiliconFlow API</p>
    </div>
    """,
    unsafe_allow_html=True
)
