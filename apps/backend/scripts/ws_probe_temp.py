"""
WebSocket 调试探针

用途：验证 agent ws 在携带 skill_id 时返回的首批事件。
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

import asyncio
import json
import time

import websockets


async def main() -> None:
    uri = "ws://127.0.0.1:3200/api/v1/agent/ws"
    payload = {
        "user_id": f"probe-{int(time.time())}",
        "message": "我想做一个项目，主题是做一个可以演示行星绕太阳运动的 Python 小程序。请直接给出可运行代码，并推进到编码实现阶段。",
        "context": {"page": "create"},
        "enable_tools": True,
        "skill_id": "stem-pbl-guide",
    }

    async with websockets.connect(uri) as ws:
        await ws.send(json.dumps(payload, ensure_ascii=False))
        print(json.dumps({"sent": payload}, ensure_ascii=False))
        for _ in range(8):
            raw = await asyncio.wait_for(ws.recv(), timeout=30)
            print(raw)
            data = json.loads(raw)
            if data.get("event") == "final":
                break


if __name__ == "__main__":
    asyncio.run(main())
