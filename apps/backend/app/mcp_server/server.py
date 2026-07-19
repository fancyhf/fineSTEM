"""
fineSTEM MCP Server — 把 PBL 工具暴露给 ZeroClaw Agent Loop。

设计要点：
- 原生 MCP 1.0 stdio 协议（JSON-RPC 2.0 over stdin/stdout），不引入新依赖。
- 工具实现完全复用 `app.services.tools.TOOL_REGISTRY` 的 BaseTool 异步实现。
- 启动时把 11 个现有工具的 description / parameters_schema 直接转为 MCP tool spec。
- ZeroClaw 在 `config.toml` 里以 `mcp.servers.finestem` 注册，daemon spawn 本文件。

调用约定：
- ZeroClaw → MCP server：`tools/call` 请求的 `arguments` 字段直接传给 `BaseTool.execute(params)`。
- MCP server → ZeroClaw：`tools/call` 响应 content 为工具输出的 JSON 串，
  schema 里的 `name` 透传成 `finestem__<tool>`，由 ZeroClaw agent loop 据此回传 tool_result。
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import traceback
from pathlib import Path
from typing import Any

# ZeroClaw spawn MCP server 时 cwd 不一定是 `apps/backend`，这里主动注入：
# 1) 切换 cwd 到 apps/backend，让 pydantic-settings 加载 `apps/backend/.env`
# 2) sys.path 注入 apps/backend，让 `from app.services.tools import TOOL_REGISTRY` 可解析
# 3) Windows 上 Python 默认 stdout 用 cp936；ZeroClaw 按 UTF-8 解析，必须强制 UTF-8
_BACKEND_DIR = os.environ.get("FINESTEM_BACKEND_DIR")
if not _BACKEND_DIR:
    _BACKEND_DIR = str(Path(__file__).resolve().parents[2])  # apps/backend
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)
os.chdir(_BACKEND_DIR)

# 强制 stdout/stderr 走 UTF-8（ZeroClaw MCP client 严格要求 UTF-8 stdin/stdout 帧）
for _stream in (sys.stdout, sys.stderr, sys.stdin):
    try:
        _stream.reconfigure(encoding="utf-8", newline="\n")
    except (AttributeError, ValueError):
        pass

logging.basicConfig(
    level=logging.INFO,
    stream=sys.stderr,
    format="[finestem-mcp] %(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("finestem_mcp")

PROTOCOL_VERSION = "2024-11-05"
SERVER_NAME = "finestem-pbl"
SERVER_VERSION = "1.0.0"


def _load_tools():
    """延迟导入：避免在模块加载阶段就触发 app.core.config 的副作用。"""
    from app.services.tools import TOOL_REGISTRY  # noqa: WPS433
    return TOOL_REGISTRY


def _tool_to_mcp_spec(name: str, tool: Any) -> dict[str, Any]:
    """`BaseTool` → MCP tools/list 元素。"""
    return {
        "name": name,
        "description": getattr(tool, "description", name),
        "inputSchema": getattr(tool, "parameters_schema", {}) or {"type": "object", "properties": {}},
    }


async def _handle_initialize(_: dict[str, Any]) -> dict[str, Any]:
    return {
        "protocolVersion": PROTOCOL_VERSION,
        "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
        "capabilities": {
            "tools": {"listChanged": False},
        },
    }


async def _handle_tools_list(params: dict[str, Any], tools: dict[str, Any]) -> dict[str, Any]:
    return {"tools": [_tool_to_mcp_spec(name, t) for name, t in tools.items()]}


async def _handle_tools_call(params: dict[str, Any], tools: dict[str, Any]) -> dict[str, Any]:
    name = params.get("name") or ""
    arguments = params.get("arguments") or {}
    if name not in tools:
        return {
            "content": [
                {"type": "text", "text": json.dumps({"success": False, "error": f"未知工具: {name}"}, ensure_ascii=False)},
            ],
            "isError": True,
        }
    tool = tools[name]
    try:
        result = await tool.execute(arguments)
    except Exception as exc:  # noqa: BLE001
        logger.exception("tool_call_failed name=%s", name)
        return {
            "content": [
                {"type": "text", "text": json.dumps(
                    {"success": False, "error": f"{exc}", "trace": traceback.format_exc(limit=5)},
                    ensure_ascii=False,
                )},
            ],
            "isError": True,
        }
    payload = result.to_dict() if hasattr(result, "to_dict") else {"data": result, "success": True}
    return {
        "content": [{"type": "text", "text": json.dumps(payload, ensure_ascii=False)}],
        "isError": not bool(payload.get("success", True)),
    }


DISPATCH = {
    "initialize": _handle_initialize,
    "tools/list": _handle_tools_list,
    "tools/call": _handle_tools_call,
}


async def _serve() -> int:
    """主循环：读取 stdin 一行一条 JSON-RPC，回 stdout。

    Windows 上 `asyncio.connect_read_pipe(stdin)` 会触发 ProactorPipe WinError 6，
    所以用专门线程同步阻塞读 stdin，再通过 asyncio.Queue 投递到事件循环。
    """
    tools = _load_tools()
    logger.info("started with %d tools: %s", len(tools), list(tools.keys()))

    loop = asyncio.get_event_loop()
    queue: asyncio.Queue[bytes] = asyncio.Queue()
    stop_event = asyncio.Event()

    def _stdin_reader():
        try:
            while True:
                line = sys.stdin.buffer.readline()
                if not line:
                    break
                # 把同步读取转交回事件循环
                asyncio.run_coroutine_threadsafe(queue.put(line), loop).result(timeout=1)
        except Exception as exc:  # noqa: BLE001
            logger.exception("stdin_reader_failed: %s", exc)
        finally:
            # call_soon_threadsafe 是同步函数（非协程），可以直接在子线程调用
            loop.call_soon_threadsafe(stop_event.set)

    import threading
    threading.Thread(target=_stdin_reader, name="finestem-mcp-stdin", daemon=True).start()

    while not stop_event.is_set():
        try:
            line = await asyncio.wait_for(queue.get(), timeout=0.5)
        except asyncio.TimeoutError:
            continue
        if not line:
            logger.info("stdin closed; exiting")
            return 0
        try:
            msg = json.loads(line.decode("utf-8"))
        except json.JSONDecodeError:
            logger.warning("invalid json: %s", line[:200])
            continue
        if "method" not in msg:
            continue

        method = msg.get("method")
        msg_id = msg.get("id")
        params = msg.get("params") or {}

        logger.info("rpc_recv method=%s id=%s params_keys=%s", method, msg_id, list(params.keys()) if isinstance(params, dict) else "n/a")

        try:
            if method == "initialize":
                result = await DISPATCH[method](params)  # type: ignore[index]
            elif method in ("tools/list", "tools/call"):
                result = await DISPATCH[method](params, tools)  # type: ignore[index]
            elif method == "notifications/initialized":
                # 客户端握手完成通知，不需要回应
                continue
            elif method == "ping":
                result = {}
            else:
                if msg_id is None:
                    continue
                err = {"code": -32601, "message": f"method not found: {method}"}
                sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": msg_id, "error": err}) + "\n")
                sys.stdout.flush()
                continue
        except Exception as exc:  # noqa: BLE001
            logger.exception("handler_crashed method=%s", method)
            if msg_id is None:
                continue
            err = {"code": -32603, "message": f"{exc}"}
            sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": msg_id, "error": err}) + "\n")
            sys.stdout.flush()
            continue

        if msg_id is None:
            continue
        response = {"jsonrpc": "2.0", "id": msg_id, "result": result}
        sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
        sys.stdout.flush()


def main() -> int:
    try:
        return asyncio.run(_serve())
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    raise SystemExit(main())