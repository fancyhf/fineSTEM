"""
AskQuestionTool 测试
测试 ask_question 工具的定义和参数验证
"""
import pytest
import json
from app.services.tools import AskQuestionTool, ToolResult


@pytest.mark.asyncio
async def test_ask_question_tool_basic():
    """测试基本的 ask_question 工具调用"""
    tool = AskQuestionTool()
    
    params = {
        "title": "你现在是哪个年级？",
        "multiple": False,
        "step": 1,
        "total_steps": 3,
        "options": [
            {"id": "junior", "label": "初中（7-9 年级）", "description": "适合刚接触编程的同学"},
            {"id": "senior", "label": "高中（10-12 年级）", "description": "有一定基础的同学"},
        ],
    }
    
    result = await tool.execute(params)
    
    assert result.success is True
    assert "data" in result.to_dict()
    data = result.data
    assert data["title"] == "你现在是哪个年级？"
    assert data["multiple"] is False
    assert len(data["options"]) == 2


@pytest.mark.asyncio
async def test_ask_question_tool_minimal():
    """测试最小参数的 ask_question 工具调用"""
    tool = AskQuestionTool()
    
    params = {
        "title": "选择项目类型",
        "options": [
            {"id": "web", "label": "网页应用"},
            {"id": "game", "label": "游戏开发"},
        ],
    }
    
    result = await tool.execute(params)
    
    assert result.success is True
    data = result.data
    assert data["title"] == "选择项目类型"
    # 默认单选
    assert data["multiple"] is False


@pytest.mark.asyncio
async def test_ask_question_tool_multiple():
    """测试多选的 ask_question 工具调用"""
    tool = AskQuestionTool()
    
    params = {
        "title": "你的兴趣爱好有哪些？（可多选）",
        "multiple": True,
        "options": [
            {"id": "coding", "label": "编程"},
            {"id": "reading", "label": "阅读"},
            {"id": "sports", "label": "运动"},
        ],
    }
    
    result = await tool.execute(params)
    
    assert result.success is True
    data = result.data
    assert data["multiple"] is True


@pytest.mark.asyncio
async def test_ask_question_tool_missing_title():
    """测试缺少 title 参数的错误处理"""
    tool = AskQuestionTool()
    
    params = {
        "options": [
            {"id": "a", "label": "选项A"},
        ],
    }
    
    result = await tool.execute(params)
    
    # 应该使用默认标题
    assert result.success is True
    assert result.data["title"] == "请选择"


@pytest.mark.asyncio
async def test_ask_question_tool_missing_options():
    """测试缺少 options 参数的错误处理"""
    tool = AskQuestionTool()
    
    params = {
        "title": "测试问题",
    }
    
    result = await tool.execute(params)
    
    # 应该返回错误
    assert result.success is False
    assert "error" in result.to_dict()


@pytest.mark.asyncio
async def test_ask_question_tool_too_many_options():
    """测试选项过多的处理"""
    tool = AskQuestionTool()
    
    params = {
        "title": "测试问题",
        "options": [{"id": f"opt{i}", "label": f"选项{i}"} for i in range(10)],
    }
    
    result = await tool.execute(params)
    
    # 应该截断到 8 个选项
    assert result.success is True
    assert len(result.data["options"]) <= 8


def test_ask_question_tool_schema():
    """测试工具参数 schema 定义"""
    tool = AskQuestionTool()
    
    schema = tool.parameters_schema
    
    assert schema["type"] == "object"
    assert "title" in schema["properties"]
    assert "options" in schema["properties"]
    assert "multiple" in schema["properties"]
    assert "step" in schema["properties"]
    assert "total_steps" in schema["properties"]
    
    # options 应该是数组
    assert schema["properties"]["options"]["type"] == "array"
    
    # title 应该是字符串
    assert schema["properties"]["title"]["type"] == "string"


@pytest.mark.asyncio
async def test_ask_question_tool_pbl_stages():
    """测试 PBL 各阶段的标准问题"""
    tool = AskQuestionTool()
    
    # Stage 00: 年级选择
    grade_question = {
        "title": "你现在是哪个年级？",
        "step": 1,
        "total_steps": 3,
        "options": [
            {"id": "junior", "label": "初中（7-9 年级）"},
            {"id": "senior", "label": "高中（10-12 年级）"},
        ],
    }
    
    result = await tool.execute(grade_question)
    assert result.success is True
    
    # Stage 01: 兴趣方向
    interest_question = {
        "title": "你平时最喜欢做什么？",
        "multiple": True,
        "options": [
            {"id": "gaming", "label": "🎮 打游戏"},
            {"id": "video", "label": "📺 看视频/动漫"},
            {"id": "sports", "label": "⚽ 运动"},
            {"id": "diy", "label": "✂️ 手工/DIY"},
        ],
    }
    
    result = await tool.execute(interest_question)
    assert result.success is True
    assert result.data["multiple"] is True
    
    # Stage 04: 技术轨道
    track_question = {
        "title": "选择技术轨道",
        "options": [
            {"id": "web", "label": "🌐 Web 应用", "description": "HTML/CSS/JS"},
            {"id": "game", "label": "🎮 游戏开发", "description": "Canvas/Phaser.js"},
            {"id": "ai", "label": "🤖 AI/ML", "description": "Python + AI API"},
        ],
    }
    
    result = await tool.execute(track_question)
    assert result.success is True
