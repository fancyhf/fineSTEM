import os
import httpx
import asyncio

API_KEY = "sk-mqyhprbiobyydcqxtvbipknsfkdeqtndoucaqjkduvcdespg"
BASE_URL = "https://api.siliconflow.cn/v1/chat/completions"

async def test_api():
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
        "messages": [
            {"role": "user", "content": "Hello"}
        ],
        "stream": False
    }
    
    print(f"Testing API with Key: {API_KEY[:5]}...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(BASE_URL, json=payload, headers=headers, timeout=30.0)
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_api())
