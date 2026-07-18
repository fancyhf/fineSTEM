"""
批次4 验证：code_runner 沙箱化效果测试。

验证场景：
  1. 正常 Python 代码能执行并返回输出
  2. 密钥环境变量被屏蔽（ZEROCLAW_API_KEY 等）
  3. 相对路径访问受限（cwd 是临时目录，不是 D:/data/finestem）
  4. 超时真生效（死循环被 10 秒限制终止）
  5. CodeRunnerTool 集成层返回结构正确

运行：cd apps/backend && python tests/test_code_sandbox.py
"""
import os
import sys
import time
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# 让脚本能从 apps/backend 目录直接运行
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def test_normal_python():
    """正常 Python 代码应能执行。"""
    from app.services.code_sandbox import run_python_sandboxed
    r = run_python_sandboxed("print(sum(range(10)))", timeout=10)
    assert r["success"], f"应成功：{r}"
    assert "45" in r["stdout"], f"应输出 45：{r['stdout']}"
    assert r["exit_code"] == 0
    print(f"[1] 正常 Python 代码: ✅ stdout={r['stdout'].strip()!r}")


def test_secret_filtered():
    """敏感环境变量应被屏蔽。"""
    from app.services.code_sandbox import run_python_sandboxed
    # 模拟密钥存在（实际环境里可能有 ZEROCLAW_API_KEY）
    os.environ["ZEROCLAW_API_KEY"] = "sk-test-secret-12345"
    os.environ["glm_key"] = "glm-secret-67890"
    os.environ["SECRET_KEY"] = "jwt-secret-abcdef"
    try:
        r = run_python_sandboxed(
            "import os; print(os.environ.get('ZEROCLAW_API_KEY','(none)')); "
            "print(os.environ.get('glm_key','(none)')); "
            "print(os.environ.get('SECRET_KEY','(none)'))",
            timeout=10,
        )
        print(f"[2] stdout = {r['stdout'].strip()!r}")
        assert "(none)" in r["stdout"], f"密钥应被屏蔽，但实际输出含密钥：{r['stdout']}"
        assert "sk-test-secret" not in r["stdout"], f"ZEROCLAW_API_KEY 泄露！"
        assert "glm-secret" not in r["stdout"], f"glm_key 泄露！"
        assert "jwt-secret" not in r["stdout"], f"SECRET_KEY 泄露！"
        print(f"[2] 密钥屏蔽: ✅ 所有密钥均返回 (none)")
    finally:
        for k in ("ZEROCLAW_API_KEY", "glm_key", "SECRET_KEY"):
            os.environ.pop(k, None)


def test_cwd_isolated():
    """脚本 cwd 应是临时目录，不能列出 D:/data/finestem 内容。"""
    from app.services.code_sandbox import run_python_sandboxed
    r = run_python_sandboxed(
        "import os; print('CWD:', os.getcwd()); print('FILES:', sorted(os.listdir('.')))",
        timeout=10,
    )
    print(f"[3] stdout = {r['stdout'].strip()!r}")
    assert r["success"]
    # cwd 应该是临时目录（finestem_sandbox_ 前缀），不含 finestem 数据目录
    assert "finestem_sandbox" in r["stdout"] or "Temp" in r["stdout"] or "tmp" in r["stdout"].lower(), \
        f"cwd 应是临时目录：{r['stdout']}"
    # listdir('.') 应该只看到 main.py（临时目录里只有脚本），不应有 finestem.db/projects 等
    assert "finestem.db" not in r["stdout"], "相对路径竟能访问到 finestem.db！"
    assert "projects" not in r["stdout"], "相对路径竟能访问到 projects/ 目录！"
    assert "main.py" in r["stdout"], "应能看到临时目录里的 main.py"
    print(f"[3] 目录隔离: ✅ cwd 是临时目录，listdir('.') 只有 main.py")


def test_absolute_path_still_works():
    """
    绝对路径仍能访问（软沙箱的已知限制，非 OS 级隔离）。
    记录此限制，验证沙箱不会"过度限制"导致正常脚本失效。
    """
    from app.services.code_sandbox import run_python_sandboxed
    r = run_python_sandboxed(
        "import os; print('EXISTS:', os.path.exists(r'D:/data/finestem'))",
        timeout=10,
    )
    print(f"[4] stdout = {r['stdout'].strip()!r}")
    # 不做断言失败处理——这是已知限制，仅记录现象
    if "EXISTS: True" in r["stdout"]:
        print(f"[4] 绝对路径访问（已知限制）: ⚠️  仍可访问 D:/data/finestem（软沙箱非 OS 级隔离）")
        print(f"    要彻底限制需叠加路径白名单或 OS 级沙箱（本次方案未含）")
    else:
        print(f"[4] 绝对路径访问: ✅ 无法访问")


def test_timeout_works():
    """死循环应在 10 秒后被超时终止（修复原 exec() 的死代码 bug）。"""
    from app.services.code_sandbox import run_python_sandboxed
    start = time.time()
    r = run_python_sandboxed("while True: pass", timeout=3)  # 用 3 秒加速测试
    elapsed = time.time() - start
    print(f"[5] exit_code={r['exit_code']}, stderr={r['stderr']!r}, elapsed={elapsed:.1f}s")
    assert r["exit_code"] == -1, f"应返回 -1（超时）：{r}"
    assert "超时" in r["stderr"], f"stderr 应含超时信息：{r['stderr']}"
    assert elapsed < 10, f"应在超时时间内返回，实际 {elapsed:.1f}s"
    print(f"[5] 超时修复: ✅ 死循环被 {elapsed:.1f}s 终止（原 exec() 会卡死后端）")


def test_coderunner_tool_integration():
    """CodeRunnerTool 集成层应返回正确结构。"""
    import asyncio
    from app.services.tools import CodeRunnerTool

    async def _run():
        tool = CodeRunnerTool()
        result = await tool.execute({"code": "print(1+1)", "language": "python"})
        return result

    result = asyncio.run(_run())
    assert result.success, f"ToolResult.success 应为 True：{result.__dict__}"
    assert "2" in result.data.get("stdout", ""), f"应输出 2：{result.data}"
    assert result.data.get("exit_code") == 0
    assert "execution_time_ms" in result.data
    print(f"[6] CodeRunnerTool 集成: ✅ stdout={result.data['stdout'].strip()!r}, "
          f"exit={result.data['exit_code']}, time={result.data['execution_time_ms']}ms")


def test_coderunner_tool_secret_filtered():
    """通过 CodeRunnerTool 调用时密钥也应被屏蔽（端到端）。"""
    import asyncio
    from app.services.tools import CodeRunnerTool

    os.environ["ZEROCLAW_API_KEY"] = "sk-e2e-secret"
    try:
        async def _run():
            tool = CodeRunnerTool()
            return await tool.execute({
                "code": "import os; print(os.environ.get('ZEROCLAW_API_KEY','(none)'))",
                "language": "python",
            })
        result = asyncio.run(_run())
        print(f"[7] stdout = {result.data['stdout'].strip()!r}")
        assert result.success
        assert "sk-e2e-secret" not in result.data["stdout"], "端到端密钥泄露！"
        assert "(none)" in result.data["stdout"]
        print(f"[7] CodeRunnerTool 端到端密钥屏蔽: ✅")
    finally:
        os.environ.pop("ZEROCLAW_API_KEY", None)


def main():
    print(f"工作目录: {os.getcwd()}")
    if not os.path.isdir("app"):
        print("ERR: 请在 apps/backend 目录下运行")
        sys.exit(1)

    print("=" * 70)
    print("批次4 验证：code_runner 沙箱化")
    print("=" * 70)
    try:
        test_normal_python()
        test_secret_filtered()
        test_cwd_isolated()
        test_absolute_path_still_works()
        test_timeout_works()
        test_coderunner_tool_integration()
        test_coderunner_tool_secret_filtered()
        print("=" * 70)
        print("🎉 所有验证通过：沙箱化生效")
        print("=" * 70)
        print("\n结论：")
        print("  - AI 正常代码执行不受影响（正常输出）")
        print("  - 密钥不再泄露（ZEROCLAW_API_KEY/glm_key/SECRET_KEY 被屏蔽）")
        print("  - 相对路径扫描被挡（cwd 是临时目录，listdir('.') 只有 main.py）")
        print("  - 死循环超时真生效（修复 exec() 死代码 bug）")
        print("  - 已知限制：绝对路径访问仍可能（软沙箱非 OS 级隔离）")
    except AssertionError as e:
        print(f"\n❌ 验证失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
