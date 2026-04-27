"""
Skill 沙箱执行器

用途：以子进程方式执行 Skill，提供更强隔离边界
维护者：AI Agent
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
import sys
from typing import Any, Dict


class SandboxExecutor:
    def __init__(self) -> None:
        self._runner = Path(__file__).resolve().parents[1] / "skill_runners" / "skill_runner.py"

    async def execute(
        self,
        skill_id: str,
        payload: Dict[str, Any],
        timeout_ms: int,
        allow_network: bool,
    ) -> tuple[str, Dict[str, Any]]:
        command = [sys.executable, "-I", str(self._runner), "--skill", skill_id]
        if allow_network:
            command.append("--allow-network")
        process = await asyncio.create_subprocess_exec(
            *command,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        raw_input = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(input=raw_input),
                timeout=timeout_ms / 1000,
            )
        except asyncio.TimeoutError as exc:
            process.kill()
            await process.wait()
            raise RuntimeError("Skill 沙箱执行超时") from exc

        if process.returncode != 0:
            err = stderr.decode("utf-8", errors="ignore").strip()
            raise RuntimeError(f"Skill 沙箱执行失败: {err or 'unknown'}")

        output_text = stdout.decode("utf-8", errors="ignore").strip()
        if not output_text:
            raise RuntimeError("Skill 沙箱执行返回为空")
        parsed = json.loads(output_text)
        summary = str(parsed.get("summary", ""))
        detail = parsed.get("payload", {})
        if not isinstance(detail, dict):
            detail = {"value": detail}
        return summary, detail


sandbox_executor = SandboxExecutor()
