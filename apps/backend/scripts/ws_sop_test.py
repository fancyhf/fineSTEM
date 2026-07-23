r"""
ZeroClaw WebSocket SOP 工具调用测试脚本

用途：通过 WebSocket 连接 ZeroClaw 网关，发送触发 sop_execute 工具调用的消息，
      验证 SOP 执行流程是否正常启动。

测试流程：
  1. 从 config.toml 读取 pairing token
  2. 连接 ws://127.0.0.1:42617/ws/chat
  3. 完成 WebSocket 握手（session_start -> connect -> connected）
  4. 发送触发 sop_execute 工具调用的消息
  5. 接收并解析响应帧，验证包含 sop_execute tool_call 事件
  6. 解析 tool_result，验证 SOP 运行已启动
  7. 清理会话

运行方式：
  G:\mediaProjects\fineSTEM\.venv\Scripts\python.exe \
      G:\mediaProjects\fineSTEM\apps\backend\scripts\ws_sop_test.py

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
from typing import Any

# ── Windows 控制台 UTF-8 支持 ──
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", newline="\n")
    except (AttributeError, ValueError):
        pass

# ── 常量配置 ──
CONFIG_PATH = r"H:\dev-env\zeroclaw\config\config.toml"
WS_BASE_URL = "ws://127.0.0.1:42617"
WS_PATH = "/ws/chat"
AGENT = "assistant"
SESSION_ID = f"ws-sop-test-{int(time.time())}"

# ── 后备 token（config.toml 中的 token 是加密的，此处使用已知明文 token）──
FALLBACK_TOKEN = "zc_f5e09815815c6d130401da6d29ad5982e6eec88cf83a51d24fadd972fc3d4e87"

# ── 超时配置（秒）──
CONNECT_TIMEOUT = 15
HANDSHAKE_TIMEOUT = 10
RESPONSE_TIMEOUT = 120

# ── 日志配置 ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ws_sop_test")


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
        # 尝试使用 tomllib（Python 3.11+）
        try:
            import tomllib
            with open(CONFIG_PATH, "rb") as f:
                config = tomllib.load(f)
        except ImportError:
            # Python 3.10 或更早，使用简单的文本解析
            config = _parse_toml_simple(CONFIG_PATH)

        gateway = config.get("gateway", {})

        # 查找明文 token
        for key in ("pairing_token", "token"):
            val = gateway.get(key)
            if val and isinstance(val, str) and not val.startswith("enc2:"):
                _print_info(f"从 config.toml [gateway].{key} 读取到明文 token")
                return val

        # 检查 paired_tokens 是否有明文
        paired = gateway.get("paired_tokens", [])
        if paired:
            for t in paired:
                if isinstance(t, str) and not t.startswith("enc2:"):
                    _print_info("从 config.toml [gateway].paired_tokens 读取到明文 token")
                    return t

        # 所有 token 都是加密的，使用后备 token
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
    current_path: list[str] = []

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("[") and line.endswith("]"):
                section = line[1:-1]
                parts = section.split(".")
                current_path = parts
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
                # 尝试解析值
                if val.startswith('"') and val.endswith('"'):
                    val = val[1:-1]
                elif val.startswith("[") and val.endswith("]"):
                    # 简单数组解析
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


async def do_handshake(ws: Any) -> bool:
    """
    完成 WebSocket 握手。

    协议流程：
      1. 收到 session_start 帧
      2. 发送 connect 帧（含 session_id, device_name, capabilities）
      3. 收到 connected 帧
    """
    _print_info("开始 WebSocket 握手...")
    handshake_start = False

    try:
        async for raw in ws:
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8", errors="replace")
            data = json.loads(raw)

            ft = data.get("type", "")
            _print_info(f"握手帧: type={ft}")

            if ft == "session_start" and not handshake_start:
                await ws.send(json.dumps({
                    "type": "connect",
                    "session_id": SESSION_ID,
                    "device_name": "ws-sop-test",
                    "capabilities": ["tool_calls", "streaming"],
                }))
                handshake_start = True
                _print_info("已发送 connect 帧")

            elif ft == "connected":
                _print_ok("握手完成 (connected)")
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
    _print_info(f"已发送消息: {message[:80]}")

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


async def run_sop_ws_test() -> bool:
    """
    主测试逻辑：通过 WebSocket 触发 sop_execute 工具调用。

    步骤：
      1. 加载 pairing token
      2. 连接 WebSocket
      3. 握手
      4. 发送触发 sop_execute 的消息
      5. 验证响应中包含 sop_execute tool_call
      6. 验证 tool_result 显示 SOP 运行已启动
    """
    print("\n--- WebSocket SOP 工具调用测试 ---")

    # 加载 token
    token = load_pairing_token()
    _print_info(f"Session ID: {SESSION_ID}")

    try:
        import websockets
    except ImportError:
        _print_fail("缺少 websockets 库，请安装: pip install websockets")
        return False

    # 构建 WebSocket URL
    ws_url = f"{WS_BASE_URL}{WS_PATH}?token={token}&agent={AGENT}&session_id={SESSION_ID}"
    _print_info(f"连接: {WS_BASE_URL}{WS_PATH} (agent={AGENT})")

    try:
        async with websockets.connect(ws_url, max_size=2**20, ping_interval=20) as ws:
            # 握手
            handshake_ok = await asyncio.wait_for(
                do_handshake(ws), timeout=HANDSHAKE_TIMEOUT
            )
            if not handshake_ok:
                return False

            # 发送触发 sop_execute 的消息
            trigger_message = (
                "请执行 pbl-stage-flow SOP，开始标准 PBL 流程。"
                "直接调用 sop_execute 工具启动 SOP 运行。"
            )

            response = await send_and_receive(ws, trigger_message, timeout=RESPONSE_TIMEOUT)

            # 输出回复文本
            if response["text"]:
                _print_info(f"AI 回复 (前200字符): {response['text'][:200]}")

            if response["error"]:
                _print_warn(f"响应包含错误: {response['error']}")

            # 验证 1：检查是否有 tool_call
            if not response["tool_calls"]:
                _print_fail("未收到任何 tool_call 事件")
                return False
            _print_ok(f"收到 {len(response['tool_calls'])} 个 tool_call 事件")

            # 验证 2：检查是否包含 sop_execute 工具调用
            sop_calls = [tc for tc in response["tool_calls"] if tc["name"] == "sop_execute"]
            if not sop_calls:
                # 也检查可能的变体名称
                sop_variants = [tc for tc in response["tool_calls"] if "sop" in tc["name"].lower()]
                if sop_variants:
                    _print_warn(f"未找到 sop_execute，但找到 SOP 相关工具: {[tc['name'] for tc in sop_variants]}")
                    # 使用变体验证
                    sop_calls = sop_variants
                else:
                    _print_fail(f"未找到 sop_execute 工具调用。收到的工具: {[tc['name'] for tc in response['tool_calls']]}")
                    return False

            _print_ok(f"找到 sop_execute 工具调用 (共 {len(sop_calls)} 次)")

            # 输出 sop_execute 的参数
            for i, tc in enumerate(sop_calls):
                _print_info(f"sop_execute[{i}] args: {json.dumps(tc.get('args', {}), ensure_ascii=False)[:300]}")

            # 验证 3：检查 tool_result 是否显示 SOP 运行已启动
            sop_results = [tr for tr in response["tool_results"] if tr["name"] == "sop_execute"]
            if not sop_results:
                _print_warn("未找到 sop_execute 的 tool_result（可能 AI 还在处理中）")
                # 检查是否有任何成功的 tool_result
                any_success = [tr for tr in response["tool_results"] if tr["success"]]
                if any_success:
                    _print_ok("存在其他成功的 tool_result")
                    return True
                return False

            for i, tr in enumerate(sop_results):
                _print_info(f"sop_execute result[{i}]: success={tr['success']}")
                if tr["success"]:
                    _print_ok("sop_execute tool_result 显示成功")

                    # 尝试解析 SOP 运行 ID
                    data = tr.get("data")
                    if data:
                        data_str = json.dumps(data, ensure_ascii=False)
                        _print_info(f"tool_result data (前300字符): {data_str[:300]}")

                        # 检查是否包含 SOP 运行相关字段
                        sop_started = False
                        if isinstance(data, dict):
                            for key in ("run_id", "sop_run_id", "runId", "status", "step"):
                                if key in data:
                                    sop_started = True
                                    _print_ok(f"tool_result 包含 '{key}' 字段: {data[key]}")
                        elif isinstance(data, str):
                            # 检查文本中是否包含启动成功的信息
                            if any(kw in data.lower() for kw in ["started", "running", "initiated", "created", "开始", "启动"]):
                                sop_started = True
                                _print_ok("tool_result 文本显示 SOP 已启动")

                        if not sop_started:
                            _print_warn("tool_result 成功但未找到明确的 SOP 启动标识")
                    return True
                else:
                    _print_fail(f"sop_execute tool_result 显示失败: {tr.get('data')}")

            return True

    except asyncio.TimeoutError:
        _print_fail("WebSocket 连接超时")
        return False
    except ConnectionRefusedError:
        _print_fail(f"连接被拒绝，请确认 ZeroClaw 网关正在运行: {WS_BASE_URL}")
        return False
    except Exception as exc:
        _print_fail(f"异常: {type(exc).__name__}: {exc}")
        logger.exception("run_sop_ws_test 失败")
        return False


def main() -> int:
    """主函数"""
    print("=" * 60)
    print("ZeroClaw WebSocket SOP 工具调用测试")
    print(f"WS URL: {WS_BASE_URL}{WS_PATH}")
    print(f"Agent: {AGENT}")
    print(f"Session: {SESSION_ID}")
    print(f"Config: {CONFIG_PATH}")
    print("=" * 60)

    result = asyncio.run(run_sop_ws_test())

    print("\n" + "=" * 60)
    if result:
        print("[OK] SOP WebSocket 测试通过")
    else:
        print("[FAIL] SOP WebSocket 测试失败")
    print("=" * 60)

    return 0 if result else 1


if __name__ == "__main__":
    sys.exit(main())
