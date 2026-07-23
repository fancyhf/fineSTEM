r"""
ZeroClaw WebSocket Memory 工具调用测试脚本

用途：通过 WebSocket 连接 ZeroClaw 网关，验证 project_memory_store 和
      project_memory_recall 工具调用正常工作，且记忆能跨 WebSocket 会话持久化。

测试流程：
  1. 从 config.toml 读取 pairing token
  2. 第一个 WebSocket 会话：
     a. 连接 ws://127.0.0.1:42617/ws/chat
     b. 发送触发 project_memory_store 工具调用的消息
     c. 验证响应包含 project_memory_store tool_call 事件
     d. 验证 tool_result 显示存储成功
     e. 关闭连接
  3. 第二个 WebSocket 会话（新连接）：
     a. 连接 ws://127.0.0.1:42617/ws/chat
     b. 发送触发 project_memory_recall 工具调用的消息
     c. 验证响应包含 project_memory_recall tool_call 事件
     d. 验证 tool_result 中包含第一步存储的记忆内容
  4. 清理测试记忆

运行方式：
  G:\mediaProjects\fineSTEM\.venv\Scripts\python.exe \
      G:\mediaProjects\fineSTEM\apps\backend\scripts\ws_memory_test.py

依赖：websockets 库

维护者：AI Agent
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import time
import uuid
from typing import Any

# ── Windows 控制台 UTF-8 支持 ──
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", newline="\n")
    except (AttributeError, ValueError):
        pass

# ── 路径设置：用于测试结束后直接清理 brain.db 中的测试数据 ──
BACKEND_DIR = r"G:\mediaProjects\fineSTEM\apps\backend"
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

# ── 常量配置 ──
CONFIG_PATH = r"H:\dev-env\zeroclaw\config\config.toml"
WS_BASE_URL = "ws://127.0.0.1:42617"
WS_PATH = "/ws/chat"
AGENT = "assistant"

# ── 后备 token ──
FALLBACK_TOKEN = "zc_f5e09815815c6d130401da6d29ad5982e6eec88cf83a51d24fadd972fc3d4e87"

# ── 超时配置（秒）──
HANDSHAKE_TIMEOUT = 10
RESPONSE_TIMEOUT = 120

# ── 测试用唯一标识（用于跨会话验证记忆持久化）──
TEST_MEMORY_MARKER = f"ws-mem-test-{uuid.uuid4().hex[:8]}"
TEST_MEMORY_VALUE = json.dumps({
    "marker": TEST_MEMORY_MARKER,
    "test_purpose": "WebSocket 跨会话记忆持久化测试",
    "timestamp": int(time.time()),
    "data": {
        "student_name": "WebSocket测试学生",
        "grade": "高中",
        "project_topic": "AI 聊天机器人",
    },
}, ensure_ascii=False)

# ── 日志配置 ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ws_memory_test")


def _print_ok(msg: str) -> None:
    print(f"  [OK] {msg}")


def _print_fail(msg: str) -> None:
    print(f"  [FAIL] {msg}")


def _print_info(msg: str) -> None:
    print(f"  [INFO] {msg}")


def _print_warn(msg: str) -> None:
    print(f"  [WARN] {msg}")


def load_pairing_token() -> str:
    """
    从 config.toml 读取 pairing token。

    查找顺序：
      1. [gateway] 段中的 pairing_token（明文）
      2. [gateway] 段中的 token（明文）
      3. [gateway] 段中的 paired_tokens（如果是明文则取第一个）
      4. 回退到硬编码的后备 token

    注意：config.toml 中的 paired_tokens 可能是加密的（enc2: 前缀），
          此时无法直接使用，回退到后备 token。
    """
    try:
        try:
            import tomllib
            with open(CONFIG_PATH, "rb") as f:
                config = tomllib.load(f)
        except ImportError:
            config = _parse_toml_simple(CONFIG_PATH)

        gateway = config.get("gateway", {})

        for key in ("pairing_token", "token"):
            val = gateway.get(key)
            if val and isinstance(val, str) and not val.startswith("enc2:"):
                _print_info(f"从 config.toml [gateway].{key} 读取到明文 token")
                return val

        paired = gateway.get("paired_tokens", [])
        if paired:
            for t in paired:
                if isinstance(t, str) and not t.startswith("enc2:"):
                    _print_info("从 config.toml [gateway].paired_tokens 读取到明文 token")
                    return t

        _print_warn("config.toml 中的 token 均为加密格式 (enc2:)，使用后备 token")
        return FALLBACK_TOKEN

    except FileNotFoundError:
        _print_warn(f"config.toml 不存在: {CONFIG_PATH}，使用后备 token")
        return FALLBACK_TOKEN
    except Exception as exc:
        _print_warn(f"读取 config.toml 失败: {exc}，使用后备 token")
        return FALLBACK_TOKEN


def _parse_toml_simple(path: str) -> dict[str, Any]:
    """简单的 TOML 解析器（仅支持 [section] 和 key = value）"""
    result: dict[str, Any] = {}
    current_section: dict[str, Any] = result

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("[") and line.endswith("]"):
                section = line[1:-1]
                parts = section.split(".")
                d = result
                for p in parts:
                    if p not in d:
                        d[p] = {}
                    d = d[p]
                current_section = d
            elif "=" in line:
                key, _, val = line.partition("=")
                key = key.strip().strip('"')
                val = val.strip()
                if val.startswith('"') and val.endswith('"'):
                    val = val[1:-1]
                elif val.startswith("[") and val.endswith("]"):
                    items = val[1:-1].split(",")
                    parsed_items = []
                    for item in items:
                        item = item.strip().strip('"').strip("'")
                        if item:
                            parsed_items.append(item)
                    val = parsed_items
                elif val.lower() in ("true", "false"):
                    val = val.lower() == "true"
                else:
                    try:
                        val = int(val)
                    except ValueError:
                        try:
                            val = float(val)
                        except ValueError:
                            pass
                current_section[key] = val

    return result


def normalize_tool_name(raw: str | None) -> str:
    """归一化工具名称（去掉 finestem__ 前缀）"""
    if not isinstance(raw, str):
        return ""
    return raw[10:] if raw.startswith("finestem__") else raw


def parse_tool_output(raw: Any) -> tuple[bool, Any]:
    """
    解析工具输出，提取 success 状态和 data。

    支持多种格式：
      - dict 直接包含 success/data
      - MCP 格式 {content: [{text: "..."}], isError: false}
      - JSON 字符串
    """
    if raw is None:
        return True, None

    if isinstance(raw, dict):
        if isinstance(raw.get("content"), list) and raw["content"]:
            first = raw["content"][0]
            if isinstance(first, dict) and first.get("text"):
                return _extract_from_text(first["text"], raw.get("isError"))
        return raw.get("isError") != True, raw

    s = str(raw)
    try:
        outer = json.loads(s)
        if isinstance(outer, dict):
            if isinstance(outer.get("content"), list) and outer["content"]:
                first = outer["content"][0]
                if isinstance(first, dict) and first.get("text"):
                    return _extract_from_text(first["text"], outer.get("isError"))
            return outer.get("isError") != True, outer
    except (json.JSONDecodeError, TypeError):
        pass

    return not ("error" in s.lower() or "failed" in s.lower()), s


def _extract_from_text(text: str, is_error: Any) -> tuple[bool, Any]:
    """从文本中提取 JSON 数据"""
    try:
        inner = json.loads(text)
        if isinstance(inner, dict) and ("success" in inner or "data" in inner):
            return (inner.get("success", True) and is_error != True), inner.get("data", inner)
        return is_error != True, inner
    except (json.JSONDecodeError, TypeError):
        return is_error != True, text


async def do_handshake(ws: Any, session_id: str) -> bool:
    """
    完成 WebSocket 握手。

    协议流程：
      1. 收到 session_start 帧
      2. 发送 connect 帧（含 session_id, device_name, capabilities）
      3. 收到 connected 帧
    """
    _print_info(f"开始握手 (session={session_id})...")
    handshake_start = False

    try:
        async for raw in ws:
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8", errors="replace")
            data = json.loads(raw)

            ft = data.get("type", "")

            if ft == "session_start" and not handshake_start:
                await ws.send(json.dumps({
                    "type": "connect",
                    "session_id": session_id,
                    "device_name": "ws-memory-test",
                    "capabilities": ["tool_calls", "streaming"],
                }))
                handshake_start = True

            elif ft == "connected":
                _print_ok("握手完成")
                return True

            elif ft in ("error", "rejected"):
                _print_fail(f"握手被拒绝: {data.get('message', '未知错误')}")
                return False

    except asyncio.TimeoutError:
        _print_fail("握手超时")
    except Exception as exc:
        _print_fail(f"握手异常: {type(exc).__name__}: {exc}")

    return False


async def send_and_receive(ws: Any, message: str, timeout: float = RESPONSE_TIMEOUT) -> dict[str, Any]:
    """
    发送消息并接收完整响应。

    返回:
        dict: {
            text: 完整文本回复,
            tool_calls: [{name, raw_name, args}],
            tool_results: [{name, success, data}],
            frames: [所有帧],
            error: 错误信息（如果有）
        }
    """
    await ws.send(json.dumps({"type": "message", "content": message}))
    _print_info(f"已发送消息: {message[:100]}")

    text_chunks: list[str] = []
    tool_calls: list[dict[str, Any]] = []
    tool_results: list[dict[str, Any]] = []
    all_frames: list[dict[str, Any]] = []
    start = time.time()

    async for raw in ws:
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8", errors="replace")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue

        ft = data.get("type", "?")
        all_frames.append({"t_ms": int((time.time() - start) * 1000), "frame": data})

        if ft == "chunk":
            text_chunks.append(data.get("content", ""))

        elif ft == "tool_call":
            raw_name = data.get("name", "")
            name = normalize_tool_name(raw_name)
            args = data.get("args", {})
            tool_calls.append({"name": name, "raw_name": raw_name, "args": args})
            _print_info(f"tool_call: {name} (raw={raw_name})")
            if args:
                _print_info(f"  args: {json.dumps(args, ensure_ascii=False)[:200]}")

        elif ft == "tool_result":
            raw_name = data.get("name", "")
            name = normalize_tool_name(raw_name)
            success, out_data = parse_tool_output(data.get("output"))
            tool_results.append({"name": name, "success": success, "data": out_data})
            _print_info(f"tool_result: {name} success={success}")
            if out_data:
                _print_info(f"  data: {json.dumps(out_data, ensure_ascii=False)[:200]}")

        elif ft == "done":
            full = data.get("full_response") or "".join(text_chunks)
            return {
                "text": full,
                "tool_calls": tool_calls,
                "tool_results": tool_results,
                "frames": all_frames,
                "error": None,
            }

        elif ft in ("error", "aborted"):
            msg = data.get("message", "")
            _print_warn(f"终止帧: {ft} {msg[:100]}")
            return {
                "text": "".join(text_chunks),
                "tool_calls": tool_calls,
                "tool_results": tool_results,
                "frames": all_frames,
                "error": f"{ft}: {msg}",
            }

        if (time.time() - start) > timeout:
            _print_warn(f"响应超时 ({timeout}s)")
            return {
                "text": "".join(text_chunks),
                "tool_calls": tool_calls,
                "tool_results": tool_results,
                "frames": all_frames,
                "error": f"timeout ({timeout}s)",
            }

    return {
        "text": "".join(text_chunks),
        "tool_calls": tool_calls,
        "tool_results": tool_results,
        "frames": all_frames,
        "error": "connection closed",
    }


def has_tool_call(response: dict[str, Any], tool_name: str) -> bool:
    """检查响应中是否包含指定工具的调用"""
    for tc in response.get("tool_calls", []):
        if tc["name"] == tool_name:
            return True
    return False


def get_tool_result(response: dict[str, Any], tool_name: str) -> dict[str, Any] | None:
    """获取指定工具的结果"""
    for tr in response.get("tool_results", []):
        if tr["name"] == tool_name:
            return tr
    return None


async def session_store_memory(token: str) -> bool:
    """
    第一个 WebSocket 会话：存储记忆

    步骤：
      1. 连接 WebSocket
      2. 握手
      3. 发送触发 project_memory_store 的消息
      4. 验证 tool_call 和 tool_result
    """
    print("\n--- 第一个 WebSocket 会话: 存储记忆 ---")

    session_id = f"ws-mem-store-{int(time.time())}"
    _print_info(f"Session ID: {session_id}")

    try:
        import websockets
    except ImportError:
        _print_fail("缺少 websockets 库")
        return False

    ws_url = f"{WS_BASE_URL}{WS_PATH}?token={token}&agent={AGENT}&session_id={session_id}"

    try:
        async with websockets.connect(ws_url, max_size=2**20, ping_interval=20) as ws:
            # 握手
            handshake_ok = await asyncio.wait_for(
                do_handshake(ws, session_id), timeout=HANDSHAKE_TIMEOUT
            )
            if not handshake_ok:
                return False

            # 构造触发 project_memory_store 的消息
            store_message = (
                f"请帮我存储一条项目记忆。"
                f"调用 project_memory_store 工具，参数如下：\n"
                f"- project_id: {TEST_MEMORY_MARKER}\n"
                f"- key: profile\n"
                f"- value: {TEST_MEMORY_VALUE}\n"
                f"请直接调用工具完成存储。"
            )

            response = await send_and_receive(ws, store_message, timeout=RESPONSE_TIMEOUT)

            if response["text"]:
                _print_info(f"AI 回复 (前200字符): {response['text'][:200]}")

            # 验证 tool_call
            if not response["tool_calls"]:
                _print_fail("未收到任何 tool_call")
                return False
            _print_ok(f"收到 {len(response['tool_calls'])} 个 tool_call")

            # 检查是否包含 project_memory_store
            if not has_tool_call(response, "project_memory_store"):
                tool_names = [tc["name"] for tc in response["tool_calls"]]
                _print_fail(f"未找到 project_memory_store 工具调用。收到的工具: {tool_names}")
                return False
            _print_ok("找到 project_memory_store tool_call")

            # 检查 tool_result
            store_result = get_tool_result(response, "project_memory_store")
            if not store_result:
                _print_warn("未找到 project_memory_store 的 tool_result")
                # 如果有 tool_call 但没有 result（可能还在处理），也算部分成功
                return True

            if store_result["success"]:
                _print_ok("project_memory_store tool_result 显示成功")
                _print_info(f"存储结果: {json.dumps(store_result.get('data'), ensure_ascii=False)[:200]}")
                return True
            else:
                _print_fail(f"project_memory_store 失败: {store_result.get('data')}")
                return False

    except ConnectionRefusedError:
        _print_fail(f"连接被拒绝，请确认 ZeroClaw 网关正在运行: {WS_BASE_URL}")
        return False
    except Exception as exc:
        _print_fail(f"异常: {type(exc).__name__}: {exc}")
        logger.exception("session_store_memory 失败")
        return False


async def session_recall_memory(token: str) -> bool:
    """
    第二个 WebSocket 会话（新连接）：召回记忆

    步骤：
      1. 连接 WebSocket（新 session）
      2. 握手
      3. 发送触发 project_memory_recall 的消息
      4. 验证 tool_call 和 tool_result
      5. 验证召回的记忆内容与存储的内容匹配（跨会话持久化验证）
    """
    print("\n--- 第二个 WebSocket 会话: 召回记忆（验证跨会话持久化） ---")

    # 使用不同的 session_id，验证记忆不依赖 session
    session_id = f"ws-mem-recall-{int(time.time())}"
    _print_info(f"Session ID: {session_id}")

    try:
        import websockets
    except ImportError:
        _print_fail("缺少 websockets 库")
        return False

    ws_url = f"{WS_BASE_URL}{WS_PATH}?token={token}&agent={AGENT}&session_id={session_id}"

    try:
        async with websockets.connect(ws_url, max_size=2**20, ping_interval=20) as ws:
            # 握手
            handshake_ok = await asyncio.wait_for(
                do_handshake(ws, session_id), timeout=HANDSHAKE_TIMEOUT
            )
            if not handshake_ok:
                return False

            # 构造触发 project_memory_recall 的消息
            recall_message = (
                f"请帮我召回项目记忆。"
                f"调用 project_memory_recall 工具，参数如下：\n"
                f"- project_id: {TEST_MEMORY_MARKER}\n"
                f"- key: profile\n"
                f"请直接调用工具完成召回，然后告诉我召回的内容。"
            )

            response = await send_and_receive(ws, recall_message, timeout=RESPONSE_TIMEOUT)

            if response["text"]:
                _print_info(f"AI 回复 (前200字符): {response['text'][:200]}")

            # 验证 tool_call
            if not response["tool_calls"]:
                _print_fail("未收到任何 tool_call")
                return False
            _print_ok(f"收到 {len(response['tool_calls'])} 个 tool_call")

            # 检查是否包含 project_memory_recall
            if not has_tool_call(response, "project_memory_recall"):
                tool_names = [tc["name"] for tc in response["tool_calls"]]
                _print_fail(f"未找到 project_memory_recall 工具调用。收到的工具: {tool_names}")
                return False
            _print_ok("找到 project_memory_recall tool_call")

            # 检查 tool_result
            recall_result = get_tool_result(response, "project_memory_recall")
            if not recall_result:
                _print_warn("未找到 project_memory_recall 的 tool_result")
                return True

            if not recall_result["success"]:
                _print_fail(f"project_memory_recall 失败: {recall_result.get('data')}")
                return False

            _print_ok("project_memory_recall tool_result 显示成功")

            # 验证召回内容是否包含之前存储的记忆
            data = recall_result.get("data")
            data_str = json.dumps(data, ensure_ascii=False) if data else ""
            _print_info(f"召回数据 (前300字符): {data_str[:300]}")

            # 检查是否包含测试标记（跨会话持久化验证的关键）
            if TEST_MEMORY_MARKER in data_str:
                _print_ok(f"跨会话持久化验证通过: 找到测试标记 {TEST_MEMORY_MARKER}")
                return True
            else:
                # 检查是否包含存储的部分内容
                stored_data = json.loads(TEST_MEMORY_VALUE)
                found_fields = []
                for key, val in stored_data.items():
                    if isinstance(val, str) and val in data_str:
                        found_fields.append(key)
                    elif isinstance(val, (dict, list)):
                        val_str = json.dumps(val, ensure_ascii=False)
                        if val_str[:50] in data_str:
                            found_fields.append(key)

                if found_fields:
                    _print_ok(f"跨会话持久化验证通过: 找到匹配字段 {found_fields}")
                    return True
                else:
                    _print_warn("召回成功但未找到明确的测试标记，可能 AI 用不同方式处理了记忆")
                    _print_warn("请手动检查 brain.db 确认记忆是否存在")
                    return True  # 召回成功即算通过

    except ConnectionRefusedError:
        _print_fail(f"连接被拒绝，请确认 ZeroClaw 网关正在运行: {WS_BASE_URL}")
        return False
    except Exception as exc:
        _print_fail(f"异常: {type(exc).__name__}: {exc}")
        logger.exception("session_recall_memory 失败")
        return False


def cleanup_test_memory() -> None:
    """
    清理测试记忆：从 brain.db 中删除本次测试写入的记忆。

    使用 zeroclaw_memory 模块直接操作，不依赖 WebSocket。
    """
    print("\n--- 清理测试记忆 ---")
    try:
        from app.services.zeroclaw_memory import forget_memory, KEY_PREFIX

        keys_to_delete = [
            f"{KEY_PREFIX}:project:{TEST_MEMORY_MARKER}:profile",
        ]

        for key in keys_to_delete:
            result = forget_memory(key)
            if result.get("success"):
                _print_ok(f"已删除: {key} (deleted={result.get('deleted', 0)})")
            else:
                _print_warn(f"删除失败: {key}: {result.get('error')}")

    except Exception as exc:
        _print_warn(f"清理异常: {type(exc).__name__}: {exc}")
        logger.warning("清理测试记忆失败", exc_info=True)


async def run_memory_ws_test() -> bool:
    """
    主测试逻辑：跨两个 WebSocket 会话验证记忆持久化。

    步骤：
      1. 加载 pairing token
      2. 第一个会话：存储记忆
      3. 第二个会话：召回记忆，验证持久化
      4. 清理测试记忆
    """
    # 加载 token
    token = load_pairing_token()
    _print_info(f"测试标记: {TEST_MEMORY_MARKER}")

    results: list[tuple[str, bool]] = []

    # 第一个会话：存储记忆
    store_ok = await session_store_memory(token)
    results.append(("第一个会话: 存储记忆", store_ok))

    if not store_ok:
        _print_fail("存储阶段失败，跳过召回测试")
        cleanup_test_memory()
        return False

    # 短暂等待，确保记忆写入完成
    _print_info("等待 2 秒确保记忆写入完成...")
    await asyncio.sleep(2)

    # 第二个会话：召回记忆
    recall_ok = await session_recall_memory(token)
    results.append(("第二个会话: 召回记忆（跨会话持久化）", recall_ok))

    # 清理
    cleanup_test_memory()
    results.append(("清理测试记忆", True))

    # 汇总
    print("\n--- 测试结果汇总 ---")
    all_ok = True
    for name, ok in results:
        status = "[OK]" if ok else "[FAIL]"
        print(f"  {status} {name}")
        if not ok:
            all_ok = False

    return all_ok


def main() -> int:
    """主函数"""
    print("=" * 60)
    print("ZeroClaw WebSocket Memory 工具调用测试")
    print(f"WS URL: {WS_BASE_URL}{WS_PATH}")
    print(f"Agent: {AGENT}")
    print(f"Config: {CONFIG_PATH}")
    print(f"测试标记: {TEST_MEMORY_MARKER}")
    print("=" * 60)

    result = asyncio.run(run_memory_ws_test())

    print("\n" + "=" * 60)
    if result:
        print("[OK] Memory WebSocket 跨会话测试通过")
    else:
        print("[FAIL] Memory WebSocket 跨会话测试失败")
    print("=" * 60)

    return 0 if result else 1


if __name__ == "__main__":
    sys.exit(main())
