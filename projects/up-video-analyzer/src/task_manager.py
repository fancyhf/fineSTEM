"""
任务管理模块 - 管理视频字幕提取任务的历史记录和状态
存储结构规范：
  data/tasks/
  ├── task_index.json              # 任务索引
  └── {task_id}/                   # 每个任务的独立目录
      ├── task.json                # 任务元数据
      ├── audio/                   # 音频文件
      ├── video/                   # 视频文件
      ├── subtitles/               # 字幕文件
      ├── analysis/                # 分析结果
      └── logs/                    # 执行日志
"""

import json
import os
import time
import uuid
import shutil
from datetime import datetime
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass, asdict, field
from enum import Enum
import threading


class TaskStatus(Enum):
    """任务状态枚举"""
    PENDING = "pending"           # 等待中
    DOWNLOADING = "downloading"   # 下载中
    EXTRACTING = "extracting"     # 提取中
    ANALYZING = "analyzing"       # 分析中
    COMPLETED = "completed"       # 已完成
    FAILED = "failed"             # 失败
    CANCELLED = "cancelled"       # 已取消


@dataclass
class Task:
    """任务数据类"""
    id: str                       # 任务唯一ID
    url: str                      # 视频URL
    platform: str                 # 平台名称
    status: str                   # 状态
    created_at: str               # 创建时间
    updated_at: str               # 更新时间
    subtitle_content: Optional[str] = None  # 字幕内容（大内容存文件，这里存路径或摘要）
    subtitle_file: Optional[str] = None     # 字幕文件路径
    error_message: Optional[str] = None     # 错误信息
    progress: int = 0             # 进度百分比
    download_size: Optional[str] = None     # 下载文件大小
    elapsed_time: Optional[float] = None    # 耗时（秒）
    analysis_result: Optional[Dict] = None  # 分析结果
    audio_file: Optional[str] = None        # 音频文件路径
    video_file: Optional[str] = None        # 视频文件路径
    task_dir: Optional[str] = None          # 任务目录路径
    
    def to_dict(self) -> Dict:
        """转换为字典"""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'Task':
        """从字典创建"""
        # 过滤掉类中不存在的字段
        valid_fields = {k: v for k, v in data.items() if k in cls.__dataclass_fields__}
        return cls(**valid_fields)


class TaskStorage:
    """任务存储管理器 - 管理本地文件存储"""
    
    def __init__(self, base_path: Optional[str] = None):
        """
        初始化存储管理器
        
        Args:
            base_path: 数据存储根目录，默认使用项目目录下的 data/tasks
        """
        if base_path is None:
            project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            base_path = os.path.join(project_root, 'data', 'tasks')
        
        self.base_path = base_path
        self.index_file = os.path.join(base_path, 'task_index.json')
        
        # 确保基础目录存在
        os.makedirs(base_path, exist_ok=True)
    
    def create_task_directory(self, task_id: str) -> str:
        """
        创建任务目录结构
        
        Args:
            task_id: 任务ID
            
        Returns:
            任务目录路径
        """
        task_dir = os.path.join(self.base_path, task_id)
        
        # 创建子目录
        subdirs = ['audio', 'video', 'subtitles', 'analysis', 'logs']
        for subdir in subdirs:
            os.makedirs(os.path.join(task_dir, subdir), exist_ok=True)
        
        return task_dir
    
    def get_task_dir(self, task_id: str) -> str:
        """获取任务目录路径"""
        return os.path.join(self.base_path, task_id)
    
    def get_audio_path(self, task_id: str, filename: str = "audio.mp3") -> str:
        """获取音频文件路径"""
        return os.path.join(self.base_path, task_id, 'audio', filename)
    
    def get_video_path(self, task_id: str, filename: str = "video.mp4") -> str:
        """获取视频文件路径"""
        return os.path.join(self.base_path, task_id, 'video', filename)
    
    def get_subtitle_path(self, task_id: str, filename: str = "subtitle.txt") -> str:
        """获取字幕文件路径"""
        return os.path.join(self.base_path, task_id, 'subtitles', filename)
    
    def get_analysis_path(self, task_id: str, filename: str) -> str:
        """获取分析结果文件路径"""
        return os.path.join(self.base_path, task_id, 'analysis', filename)
    
    def get_log_path(self, task_id: str, filename: str = "execution.log") -> str:
        """获取日志文件路径"""
        return os.path.join(self.base_path, task_id, 'logs', filename)
    
    def get_task_json_path(self, task_id: str) -> str:
        """获取任务元数据文件路径"""
        return os.path.join(self.base_path, task_id, 'task.json')
    
    def save_task_metadata(self, task: Task):
        """保存任务元数据到 task.json"""
        task_json_path = self.get_task_json_path(task.id)
        try:
            with open(task_json_path, 'w', encoding='utf-8') as f:
                json.dump(task.to_dict(), f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"保存任务元数据失败: {e}")
    
    def load_task_metadata(self, task_id: str) -> Optional[Task]:
        """从 task.json 加载任务元数据"""
        task_json_path = self.get_task_json_path(task_id)
        if os.path.exists(task_json_path):
            try:
                with open(task_json_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return Task.from_dict(data)
            except Exception as e:
                print(f"加载任务元数据失败: {e}")
        return None
    
    def save_subtitle(self, task_id: str, content: str, filename: str = "subtitle.txt") -> str:
        """
        保存字幕内容到文件
        
        Args:
            task_id: 任务ID
            content: 字幕内容
            filename: 文件名
            
        Returns:
            保存的文件路径
        """
        subtitle_path = self.get_subtitle_path(task_id, filename)
        try:
            with open(subtitle_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return subtitle_path
        except Exception as e:
            print(f"保存字幕失败: {e}")
            return ""
    
    def load_subtitle(self, task_id: str, filename: str = "subtitle.txt") -> Optional[str]:
        """加载字幕内容"""
        subtitle_path = self.get_subtitle_path(task_id, filename)
        if os.path.exists(subtitle_path):
            try:
                with open(subtitle_path, 'r', encoding='utf-8') as f:
                    return f.read()
            except Exception as e:
                print(f"加载字幕失败: {e}")
        return None
    
    def save_analysis_result(self, task_id: str, result: Dict, filename: str = "analysis_result.json") -> str:
        """保存分析结果"""
        analysis_path = self.get_analysis_path(task_id, filename)
        try:
            with open(analysis_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            return analysis_path
        except Exception as e:
            print(f"保存分析结果失败: {e}")
            return ""
    
    def load_analysis_result(self, task_id: str, filename: str = "analysis_result.json") -> Optional[Dict]:
        """加载分析结果"""
        analysis_path = self.get_analysis_path(task_id, filename)
        if os.path.exists(analysis_path):
            try:
                with open(analysis_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"加载分析结果失败: {e}")
        return None
    
    def append_log(self, task_id: str, message: str, level: str = "INFO"):
        """追加日志"""
        log_path = self.get_log_path(task_id)
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_line = f"[{timestamp}] [{level}] {message}\n"
        try:
            with open(log_path, 'a', encoding='utf-8') as f:
                f.write(log_line)
        except Exception as e:
            print(f"写入日志失败: {e}")
    
    def read_log(self, task_id: str) -> str:
        """读取日志"""
        log_path = self.get_log_path(task_id)
        if os.path.exists(log_path):
            try:
                with open(log_path, 'r', encoding='utf-8') as f:
                    return f.read()
            except Exception as e:
                print(f"读取日志失败: {e}")
        return ""
    
    def delete_task_directory(self, task_id: str) -> bool:
        """删除任务目录"""
        task_dir = self.get_task_dir(task_id)
        if os.path.exists(task_dir):
            try:
                shutil.rmtree(task_dir)
                return True
            except Exception as e:
                print(f"删除任务目录失败: {e}")
        return False
    
    def get_all_task_ids(self) -> List[str]:
        """获取所有任务ID"""
        task_ids = []
        if os.path.exists(self.base_path):
            for item in os.listdir(self.base_path):
                item_path = os.path.join(self.base_path, item)
                if os.path.isdir(item_path) and not item.startswith('.'):
                    task_ids.append(item)
        return task_ids
    
    def get_storage_stats(self) -> Dict:
        """获取存储统计信息"""
        stats = {
            'total_tasks': 0,
            'total_size_mb': 0,
            'audio_files': 0,
            'video_files': 0,
            'subtitle_files': 0
        }
        
        for task_id in self.get_all_task_ids():
            stats['total_tasks'] += 1
            task_dir = self.get_task_dir(task_id)
            
            # 计算目录大小
            for root, dirs, files in os.walk(task_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    try:
                        stats['total_size_mb'] += os.path.getsize(file_path) / (1024 * 1024)
                    except:
                        pass
                
                # 统计文件类型
                if 'audio' in root:
                    stats['audio_files'] += len(files)
                elif 'video' in root:
                    stats['video_files'] += len(files)
                elif 'subtitles' in root:
                    stats['subtitle_files'] += len(files)
        
        stats['total_size_mb'] = round(stats['total_size_mb'], 2)
        return stats


class TaskManager:
    """任务管理器"""
    
    def __init__(self, storage_path: Optional[str] = None):
        """
        初始化任务管理器
        
        Args:
            storage_path: 数据存储根目录
        """
        self.storage = TaskStorage(storage_path)
        self.tasks: Dict[str, Task] = {}
        self._callbacks: List[Callable] = []
        self._lock = threading.Lock()
        
        # 加载已有任务
        self._load_all_tasks()
    
    def _load_all_tasks(self):
        """加载所有任务"""
        task_ids = self.storage.get_all_task_ids()
        for task_id in task_ids:
            task = self.storage.load_task_metadata(task_id)
            if task:
                self.tasks[task_id] = task
        print(f"已加载 {len(self.tasks)} 个历史任务")
    
    def _notify_callbacks(self, task: Task):
        """通知回调函数"""
        for callback in self._callbacks:
            try:
                callback(task)
            except Exception as e:
                print(f"回调函数执行失败: {e}")
    
    def create_task(self, url: str, platform: str) -> Task:
        """
        创建新任务
        
        Args:
            url: 视频URL
            platform: 平台名称
        
        Returns:
            创建的任务对象
        """
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        task_id = str(uuid.uuid4())[:8]
        
        # 创建任务目录
        task_dir = self.storage.create_task_directory(task_id)
        
        task = Task(
            id=task_id,
            url=url,
            platform=platform,
            status=TaskStatus.PENDING.value,
            created_at=now,
            updated_at=now,
            progress=0,
            task_dir=task_dir
        )
        
        with self._lock:
            self.tasks[task.id] = task
            # 保存元数据
            self.storage.save_task_metadata(task)
            # 记录日志
            self.storage.append_log(task.id, f"任务创建: {platform} - {url}")
        
        self._notify_callbacks(task)
        return task
    
    def update_task(self, task_id: str, **kwargs) -> Optional[Task]:
        """
        更新任务状态
        
        Args:
            task_id: 任务ID
            **kwargs: 要更新的字段
        
        Returns:
            更新后的任务对象，如果不存在返回 None
        """
        with self._lock:
            if task_id not in self.tasks:
                return None
            
            task = self.tasks[task_id]
            
            # 更新字段
            for key, value in kwargs.items():
                if hasattr(task, key):
                    setattr(task, key, value)
            
            # 自动更新更新时间
            task.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            # 保存元数据
            self.storage.save_task_metadata(task)
            
            # 记录状态变更日志
            if 'status' in kwargs:
                self.storage.append_log(task_id, f"状态变更: {kwargs['status']}")
            if 'progress' in kwargs:
                self.storage.append_log(task_id, f"进度更新: {kwargs['progress']}%")
        
        self._notify_callbacks(task)
        return task
    
    def save_subtitle(self, task_id: str, content: str) -> bool:
        """
        保存字幕内容
        
        Args:
            task_id: 任务ID
            content: 字幕内容
            
        Returns:
            是否成功
        """
        if task_id not in self.tasks:
            return False
        
        # 保存到文件
        subtitle_path = self.storage.save_subtitle(task_id, content)
        if subtitle_path:
            # 更新任务元数据
            self.update_task(
                task_id,
                subtitle_file=subtitle_path,
                subtitle_content=content[:500] + "..." if len(content) > 500 else content  # 只存摘要到JSON
            )
            self.storage.append_log(task_id, f"字幕已保存: {len(content)} 字符")
            return True
        return False
    
    def load_subtitle(self, task_id: str) -> Optional[str]:
        """加载字幕内容"""
        return self.storage.load_subtitle(task_id)
    
    def save_analysis_result(self, task_id: str, result: Dict) -> bool:
        """保存分析结果"""
        if task_id not in self.tasks:
            return False
        
        # 保存到文件
        analysis_path = self.storage.save_analysis_result(task_id, result)
        if analysis_path:
            # 更新任务元数据
            self.update_task(task_id, analysis_result=result)
            self.storage.append_log(task_id, "分析结果已保存")
            return True
        return False
    
    def get_task(self, task_id: str) -> Optional[Task]:
        """获取任务"""
        return self.tasks.get(task_id)
    
    def get_all_tasks(self) -> List[Task]:
        """获取所有任务，按时间倒序"""
        return sorted(
            self.tasks.values(),
            key=lambda x: x.created_at,
            reverse=True
        )
    
    def get_recent_tasks(self, limit: int = 10) -> List[Task]:
        """获取最近的任务"""
        return self.get_all_tasks()[:limit]
    
    def get_tasks_by_status(self, status: TaskStatus) -> List[Task]:
        """按状态获取任务"""
        return [
            task for task in self.tasks.values()
            if task.status == status.value
        ]
    
    def delete_task(self, task_id: str) -> bool:
        """删除任务"""
        with self._lock:
            if task_id in self.tasks:
                # 删除任务目录
                self.storage.delete_task_directory(task_id)
                # 从内存中移除
                del self.tasks[task_id]
                return True
        return False
    
    def retry_task(self, task_id: str) -> Optional[Task]:
        """
        重试任务
        
        Args:
            task_id: 任务ID
        
        Returns:
            重置后的任务对象
        """
        task = self.get_task(task_id)
        if task:
            # 重置任务状态
            updated_task = self.update_task(
                task_id,
                status=TaskStatus.PENDING.value,
                progress=0,
                error_message=None,
                elapsed_time=None
            )
            self.storage.append_log(task_id, "任务重置，准备重试")
            return updated_task
        return None
    
    def get_task_log(self, task_id: str) -> str:
        """获取任务日志"""
        return self.storage.read_log(task_id)
    
    def get_stats(self) -> Dict:
        """获取任务统计信息"""
        total = len(self.tasks)
        completed = len([t for t in self.tasks.values() if t.status == TaskStatus.COMPLETED.value])
        failed = len([t for t in self.tasks.values() if t.status == TaskStatus.FAILED.value])
        downloading = len([t for t in self.tasks.values() if t.status == TaskStatus.DOWNLOADING.value])
        extracting = len([t for t in self.tasks.values() if t.status == TaskStatus.EXTRACTING.value])
        
        success_rate = (completed / total * 100) if total > 0 else 0
        
        return {
            'total': total,
            'completed': completed,
            'failed': failed,
            'downloading': downloading,
            'extracting': extracting,
            'success_rate': success_rate
        }
    
    def get_storage_stats(self) -> Dict:
        """获取存储统计"""
        return self.storage.get_storage_stats()
    
    def register_callback(self, callback: Callable):
        """注册状态变更回调"""
        self._callbacks.append(callback)
    
    def unregister_callback(self, callback: Callable):
        """注销回调"""
        if callback in self._callbacks:
            self._callbacks.remove(callback)


# 全局任务管理器实例
_task_manager_instance: Optional[TaskManager] = None


def get_task_manager() -> TaskManager:
    """获取全局任务管理器实例"""
    global _task_manager_instance
    if _task_manager_instance is None:
        _task_manager_instance = TaskManager()
    return _task_manager_instance
