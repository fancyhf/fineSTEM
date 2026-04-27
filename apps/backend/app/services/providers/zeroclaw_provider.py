"""
ZeroClaw Provider 适配器

用途：对接 ZeroClaw Gateway，向编排层提供统一调用接口
维护者：AI Agent
"""

import json
from typing import Any, AsyncGenerator, Dict, Optional
import httpx


class ZeroClawProvider:
    def __init__(self, gateway_url: Optional[str], timeout_seconds: int = 30, api_key: Optional[str] = None):
        self.gateway_url = gateway_url.rstrip("/") if gateway_url else None
        self.timeout_seconds = timeout_seconds
        self.api_key = api_key

    async def complete(self, payload: Dict[str, Any], gateway_url: Optional[str] = None) -> str:
        target_gateway = gateway_url.rstrip("/") if gateway_url else self.gateway_url
        if not target_gateway or not self.api_key:
            raise RuntimeError("ZeroClaw 网关或 API 密钥未配置")

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        request_payload = self._build_request_payload(payload, target_gateway)

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(
                f"{target_gateway}/chat/completions",
                json=request_payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()

        content = self._extract_content(data, target_gateway)
        if not content:
            raise RuntimeError("ZeroClaw 返回内容为空")
        return str(content)

    async def stream_complete(self, payload: Dict[str, Any], gateway_url: Optional[str] = None) -> AsyncGenerator[str, None]:
        target_gateway = gateway_url.rstrip("/") if gateway_url else self.gateway_url
        if not target_gateway or not self.api_key:
            raise RuntimeError("ZeroClaw 网关或 API 密钥未配置")

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        request_payload = self._build_request_payload(payload, target_gateway)
        request_payload["stream"] = True

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            async with client.stream(
                "POST",
                f"{target_gateway}/chat/completions",
                json=request_payload,
                headers=headers,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        token = self._extract_stream_token(chunk, target_gateway)
                        if token:
                            yield token
                    except json.JSONDecodeError:
                        continue

    @staticmethod
    def _is_glm_gateway(gateway_url: str) -> bool:
        return "open.bigmodel.cn" in gateway_url

    def _build_request_payload(self, payload: Dict[str, Any], gateway_url: str) -> Dict[str, Any]:
        if not self._is_glm_gateway(gateway_url):
            return payload

        model = str(payload.get("model") or "glm-5-turbo")
        message = str(payload.get("message") or "")
        context = payload.get("context") or {}
        system_prompt = f"你是 fineSTEM 助教。上下文：{context}"
        return {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message},
            ],
        }

    def _extract_content(self, data: Dict[str, Any], gateway_url: str) -> str:
        if self._is_glm_gateway(gateway_url):
            choices = data.get("choices", [])
            if choices and isinstance(choices[0], dict):
                message = choices[0].get("message", {})
                if isinstance(message, dict):
                    return str(message.get("content") or "")
            return ""
        return str(data.get("data", {}).get("content") or data.get("message") or "")

    def _extract_stream_token(self, chunk: Dict[str, Any], gateway_url: str) -> str:
        if self._is_glm_gateway(gateway_url):
            choices = chunk.get("choices", [])
            if choices and isinstance(choices[0], dict):
                delta = choices[0].get("delta", {})
                if isinstance(delta, dict):
                    return str(delta.get("content") or "")
            return ""
        return str(chunk.get("data", {}).get("token") or chunk.get("token") or "")
