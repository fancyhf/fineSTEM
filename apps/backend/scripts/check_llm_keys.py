"""
LLM API Key 自检脚本 —— 验证「唯一设置点」里的 key 是否配置正确、能否真实调用。

用法（仓库任意位置均可）：
  python apps/backend/scripts/check_llm_keys.py          # 只查配置（不发请求）
  python apps/backend/scripts/check_llm_keys.py --live   # 真实调用 GLM / DeepSeek 各 1 次

key 唯一设置点：apps/backend/.env
  GLM_API_KEY      智谱 GLM（GLM-4V 截图识别 / CogView 封面图 / GLM 直连对话）
  DEEPSEEK_API_KEY DeepSeek（直连对话回退链路）
AI 聊天主链路的模型 key 在 ZeroClaw daemon 的 config.toml（keyring 加密），
不在本脚本检查范围。

退出码：0 = 全部通过；1 = 有 key 未配置或验证失败。
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)          # config.py 的 env_file=".env" 相对 CWD
sys.path.insert(0, str(BACKEND_DIR))

try:
    import httpx
except ImportError:
    print("需要 httpx: pip install httpx", file=sys.stderr)
    sys.exit(1)

from app.core.config import settings  # noqa: E402  (需先完成 sys.path 注入)


def _mask(value: str) -> str:
    if not value:
        return "(未配置)"
    if len(value) <= 10:
        return value[:2] + "***"
    return f"{value[:6]}...{value[-4:]} (len={len(value)})"


def _live_check(name: str, url: str, model: str, api_key: str) -> bool:
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": "只回复两个字母：OK"}],
        "max_tokens": 16,
        "temperature": 0,
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        resp = httpx.post(url, json=payload, headers=headers, timeout=30)
    except Exception as e:
        print(f"  [FAIL] {name} 请求异常: {e}")
        return False
    if resp.status_code == 200:
        try:
            content = resp.json()["choices"][0]["message"]["content"]
        except Exception:
            content = "(无法解析响应)"
        print(f"  [OK]   {name} 调用成功，模型回复: {str(content).strip()[:40]!r}")
        return True
    print(f"  [FAIL] {name} HTTP {resp.status_code}: {resp.text[:200]}")
    return False


def main() -> int:
    live = "--live" in sys.argv

    print("=" * 62)
    print("fineSTEM LLM API Key 自检")
    print("=" * 62)
    print(f"配置文件（唯一设置点）: {BACKEND_DIR / '.env'}")
    print()

    glm = settings.GLM_API_KEY or ""
    ds = settings.DEEPSEEK_API_KEY or ""
    ok = True

    print("[1] 智谱 GLM  GLM_API_KEY")
    print(f"  值: {_mask(glm)}")
    if settings.GLM_API_KEY and settings.glm_key and settings.GLM_API_KEY == settings.glm_key:
        print("  来源: 旧命名 glm_key 自动映射（建议改用 GLM_API_KEY）")
    if not glm:
        print("  [WARN] 未配置：截图识别 / 封面图生成 / GLM 直连将不可用")
        ok = False
    print()

    print("[2] DeepSeek  DEEPSEEK_API_KEY")
    print(f"  值: {_mask(ds)}")
    if settings.DEEPSEEK_API_KEY and settings.deepseek_key and settings.DEEPSEEK_API_KEY == settings.deepseek_key:
        print("  来源: 旧命名 deepseek_key 自动映射（建议改用 DEEPSEEK_API_KEY）")
    if not ds:
        print("  [WARN] 未配置：DeepSeek 直连回退链路将不可用")
    print()

    print("[3] 直连回退链路解析（ZEROCLAW_API_KEY）")
    if settings.ZEROCLAW_API_KEY:
        src = "DEEPSEEK_API_KEY" if settings.ZEROCLAW_API_KEY == ds and ds else "GLM_API_KEY"
        print(f"  生效 key 来自: {src} → 端点 {settings.ZEROCLAW_GATEWAY_URL}")
    else:
        print("  (无直连 key，聊天走 ZeroClaw daemon 时不影响)")
    print()

    if not live:
        print("仅配置检查（加 --live 发起真实调用验证 key 有效性）")
        return 0 if ok else 1

    print("── 真实调用验证 ──")
    if glm:
        if not _live_check(
            "GLM",
            "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            "glm-4-flash",
            glm,
        ):
            ok = False
    if ds:
        if not _live_check(
            "DeepSeek",
            "https://api.deepseek.com/v1/chat/completions",
            "deepseek-chat",
            ds,
        ):
            ok = False
    print()
    print("结论: " + ("全部通过 ✅" if ok else "存在问题 ❌（按上面 FAIL 项排查 key）"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
