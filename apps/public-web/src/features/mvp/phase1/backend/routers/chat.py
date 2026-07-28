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
    获取指定或默认 AI 提供商的配置。
    """
    # 1. 确定提供商：请求参数 > 环境变量 > 默认(deepseek)
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
        config["model"] = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-pro")
    elif provider == "openai":
        config["api_key"] = os.getenv("OPENAI_API_KEY")
        config["base_url"] = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        config["model"] = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
        
    return config

@router.post("/completions")
async def chat_completions(request: ChatRequest):
    """
    使用配置的 AI 提供商（SiliconFlow, DeepSeek 等）处理聊天补全。
    如果未配置 API 密钥，则返回用于演示的模拟响应。
    """
    # 根据提供商加载配置
    config = get_provider_config(request.provider)
    
    api_key = config.get("api_key")
    base_url = config.get("base_url")
    model = config.get("model")
    
    # 1. 检查是否有真实的密钥，或者是否应该使用模拟响应
    if not api_key or api_key == "sk-placeholder" or api_key.startswith("sk-placeholder"):
        # print(f"由于缺少 {config['name']} 的密钥，正在使用模拟响应")
        return simulate_response(request.messages, request.context)

    # 2. 准备包含上下文的系统提示词
    system_prompt = "你是一位乐于助人的少儿编程 AI 导师。请用简单清晰的语言解释代码。"
    if request.context:
        system_prompt += f"\n\n当前代码/上下文：\n{request.context}"

    full_messages = [{"role": "system", "content": system_prompt}] + [m.dict() for m in request.messages]

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": full_messages,
                    "stream": False
                },
                timeout=30.0
            )
            
            if response.status_code != 200:
                print(f"AI 提供商 ({config['name']}) 错误: {response.text}")
                return simulate_response(request.messages, request.context)
                
            data = response.json()
            return {"role": "assistant", "content": data["choices"][0]["message"]["content"]}
            
    except Exception as e:
        print(f"聊天接口错误: {e}")
        return simulate_response(request.messages, request.context)

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
