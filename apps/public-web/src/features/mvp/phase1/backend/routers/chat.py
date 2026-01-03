from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
import os
import httpx
from typing import List, Optional

router = APIRouter(prefix="/chat", tags=["Chat"])

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    context: Optional[str] = None
    provider: Optional[str] = None # 如果为 None，则使用 env 中的 AI_PROVIDER

def get_provider_config(requested_provider: Optional[str] = None):
    """
    获取指定或默认 AI 服务提供商的配置。
    """
    # 1. 确定提供商: 请求参数 > 环境变量 > 默认(deepseek)
    provider = requested_provider
    if not provider:
        provider = os.getenv("AI_PROVIDER", "deepseek")
    
    provider = provider.lower()
    
    config = {
        "api_key": None,
        "base_url": None,
        "model": None,
        "name": provider
    }

    if provider == "siliconflow":
        config["api_key"] = os.getenv("SILICONFLOW_API_KEY")
        config["base_url"] = os.getenv("SILICONFLOW_BASE_URL", "https://api.siliconflow.cn/v1")
        config["model"] = os.getenv("SILICONFLOW_MODEL", "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B")
    elif provider == "deepseek":
        config["api_key"] = os.getenv("DEEPSEEK_API_KEY")
        config["base_url"] = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
        config["model"] = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
    elif provider == "openai":
        config["api_key"] = os.getenv("OPENAI_API_KEY")
        config["base_url"] = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        config["model"] = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
    
    return config

@router.post("/completions")
async def chat_completions(request: ChatRequest):
    """
    处理聊天补全请求，支持动态切换 AI 提供商。
    """
    config = get_provider_config(request.provider)
    
    # 系统提示词工程
    system_prompt = "You are a helpful STEM education assistant."
    if request.context:
        system_prompt += f"\nContext: {request.context}"
    
    # 构造完整的消息列表
    full_messages = [{"role": "system", "content": system_prompt}] + [m.model_dump() for m in request.messages]

    # 检查是否有 API Key，如果没有则使用模拟模式
    if not config["api_key"]:
        print(f"[警告] 未找到提供商 {config['name']} 的 API Key。使用模拟响应。")
        return {
            "role": "assistant",
            "content": f"[模拟响应 ({config['name']})] 这是一个模拟的 AI 回复。请在 .env 文件中配置 {config['name'].upper()}_API_KEY 以获得真实回复。"
        }

    headers = {
        "Authorization": f"Bearer {config['api_key']}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": config["model"],
        "messages": full_messages,
        "temperature": 0.7
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{config['base_url']}/chat/completions",
                headers=headers,
                json=payload,
                timeout=60.0
            )
            
            if response.status_code != 200:
                print(f"AI 服务提供商 ({config['name']}) 错误: {response.text}")
                raise HTTPException(status_code=response.status_code, detail=f"AI 提供商错误: {response.text}")
                
            data = response.json()
            # 适配 OpenAI 格式的响应
            return data["choices"][0]["message"]
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"聊天补全异常: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def simulate_response(messages: List[Message], context: Optional[str]):
    """
    Fallback simulation when no API key is present.
    """
    last_user_msg = messages[-1].content.lower()
    
    if "双摆" in last_user_msg or "double pendulum" in last_user_msg:
        return {
            "role": "assistant",
            "content": "双摆是一个非常有趣的物理系统！它的运动是'混沌'的，意思是说，哪怕你只是改变一点点初始位置，最后的样子都会完全不一样。这就像是'蝴蝶效应'哦！🦋"
        }
    elif "重力" in last_user_msg or "gravity" in last_user_msg:
        return {
            "role": "assistant",
            "content": "重力就像是地球的一只大手，一直把所有东西往下拉。在我们的代码里，`engine.world.gravity.y` 就控制着这个力量的大小。如果你把它设为 0，小球就会飘起来，像在太空中一样！🚀"
        }
    elif "python" in last_user_msg:
        return {
            "role": "assistant",
            "content": "Python 是一种非常流行的编程语言，特别适合做数据分析和人工智能。在 Track E 里，我们可以看到 Python 在 2012 年之后突然变得超级受欢迎，这都多亏了 AI 的发展呢！🐍"
        }
    else:
        return {
            "role": "assistant",
            "content": "这是一个很好的问题！作为你的 AI 编程助手，我可以帮你解释这段代码是如何工作的。你可以试着问我关于'重力'、'摩擦力'或者'排序算法'的问题哦！(注意：当前未配置 DeepSeek API Key，仅为模拟回复)"
        }
