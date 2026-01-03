import pytest
from httpx import AsyncClient
import os

@pytest.mark.asyncio
async def test_chat_completions_structure(api_client: AsyncClient):
    """
    测试聊天补全接口的基本结构和响应格式。
    """
    payload = {
        "messages": [
            {"role": "user", "content": "Hello, simply say 'Hi'."}
        ],
        "provider": "siliconflow" # 显式指定，或者留空测试默认
    }
    
    response = await api_client.post("/chat/completions", json=payload)
    
    # 无论走模拟还是真实接口，都应该返回 200
    assert response.status_code == 200
    data = response.json()
    
    assert "role" in data
    assert "content" in data
    assert data["role"] == "assistant"
    assert len(data["content"]) > 0

@pytest.mark.asyncio
async def test_chat_completions_simulation(api_client: AsyncClient, monkeypatch):
    """
    测试当没有 API Key 时是否正确降级到模拟响应。
    """
    # 临时移除 API KEY 以触发模拟模式
    monkeypatch.delenv("SILICONFLOW_API_KEY", raising=False)
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    payload = {
        "messages": [
            {"role": "user", "content": "Test simulation"}
        ],
        "provider": "siliconflow"
    }

    response = await api_client.post("/chat/completions", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "assistant"
    assert "[模拟响应" in data["content"]
