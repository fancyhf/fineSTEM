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
    provider: Optional[str] = "deepseek" # default to deepseek, could be qwen

# Mock configuration - in production use env vars
# Users should provide their own keys in a real deployment
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "sk-placeholder") 
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

@router.post("/completions")
async def chat_completions(request: ChatRequest):
    """
    Handle chat completions using DeepSeek or other compatible APIs.
    If no API key is configured, returns a simulated response for demonstration.
    """
    # Reload key from environment (in case it was set after module load)
    api_key = os.getenv("DEEPSEEK_API_KEY", DEEPSEEK_API_KEY)
    base_url = os.getenv("DEEPSEEK_BASE_URL", DEEPSEEK_BASE_URL)
    
    # 1. Check if we have a real key or should simulate
    if not api_key or api_key == "sk-placeholder":
        return simulate_response(request.messages, request.context)

    # 2. Prepare the system prompt with context
    system_prompt = "You are a helpful AI programming tutor for children. Explain code simply and clearly."
    if request.context:
        system_prompt += f"\n\nCurrent Code/Context:\n{request.context}"

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
                    "model": "deepseek-chat",
                    "messages": full_messages,
                    "stream": False
                },
                timeout=30.0
            )
            
            if response.status_code != 200:
                print(f"DeepSeek API Error: {response.text}")
                return simulate_response(request.messages, request.context)
                
            data = response.json()
            return {"role": "assistant", "content": data["choices"][0]["message"]["content"]}
            
    except Exception as e:
        print(f"Chat Error: {e}")
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
