"""
项目配置
"""

PROJECT_NAME = "UP 主视频内容分析器"
PROJECT_SLUG = "up-video-analyzer"
VERSION = "1.0.0"

# 功能开关
ENABLE_UPLOAD = True
ENABLE_ANALYSIS = True
ENABLE_EXPORT = True
ENABLE_AI_SUMMARY = True

# 样式配置
STYLE = "科技感 + 简约"
PRIMARY_COLOR = "#4CAF50"
SECONDARY_COLOR = "#2196F3"
BACKGROUND_COLOR = "#0e1117"

# 分析配置
MAX_WORDS = 100
MIN_WORD_LENGTH = 2
STOPWORDS = {
    '的', '了', '是', '在', '我', '有', '和', '就', '不', '人',
    '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去',
    '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '他'
}

# 导出配置
EXPORT_FORMATS = ['png', 'csv']
DEFAULT_FILENAME = 'wordcloud'
