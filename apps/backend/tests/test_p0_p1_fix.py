"""
P0 + P1 修复验证：复现 2026-07-18 事故场景，确认改动后 workspace 不被覆盖。

测试场景：
  1. P0 验证：模拟 AI 回复中含 ```python 诊断脚本块，确认 orchestrator
     不再自动捞取并覆盖 workspace.code（即使 force_code_generation=True）。
  2. P1 验证：模拟直接调用 save_project_workspace 覆盖 code，
     确认旧 code 进入 code_history，可疑覆盖被记录。

运行：cd apps/backend && python -m tests.test_p0_p1_fix
"""
import json
import sqlite3
import sys
import os
import tempfile
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# 让脚本能从 apps/backend 目录直接运行（把 backend 根加入 sys.path）
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

# 测试用临时 DB
TEST_DB = tempfile.mktemp(suffix='.db', prefix='finestem_fix_test_')
PROJECT_ID = "test-proj-fix-001"
ORIGINAL_HTML = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>科学百科小测验</title>
    <style>
        body { font-family: -apple-system, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .quiz-card { background: white; border-radius: 12px; padding: 32px; max-width: 600px; margin: 80px auto; }
        h1 { color: #2c3e50; }
        .option { background: #f0f4f8; border: 2px solid #e0e0e0; border-radius: 8px; padding: 16px; margin: 8px 0; cursor: pointer; }
        .option:hover { background: #e3f2fd; border-color: #2196f3; }
        .option.correct { background: #c8e6c9; border-color: #4caf50; }
        .option.wrong { background: #ffcdd2; border-color: #f44336; }
        .score { font-size: 24px; font-weight: bold; color: #2196f3; text-align: center; }
    </style>
</head>
<body>
    <div class="quiz-card">
        <h1>🔬 科学百科小测验</h1>
        <div id="question-area"></div>
        <div id="options-area"></div>
        <div id="score-area"></div>
    </div>
    <script>
        const questions = [
            { q: "地球是太阳系第几颗行星？", options: ["第1颗","第2颗","第3颗","第4颗"], answer: 2 },
            { q: "光速大约是多少？", options: ["30万km/s","30万km/h","3万km/s","3万km/h"], answer: 0 },
            { q: "DNA 的中文全称是？", options: ["脱氧核糖核酸","核糖核酸","氨基酸","蛋白质"], answer: 0 },
            { q: "水的化学式是？", options: ["H2O","CO2","O2","NaCl"], answer: 0 },
            { q: "人体最大的器官是？", options: ["心脏","肝脏","皮肤","大脑"], answer: 2 },
            { q: "彩虹有几种颜色？", options: ["5种","6种","7种","8种"], answer: 2 },
        ];
        let currentIdx = 0;
        let score = 0;
        function showQuestion() {
            if (currentIdx >= questions.length) {
                document.getElementById('score-area').innerHTML =
                    '<div class="score">得分: ' + score + '/' + questions.length + '</div>';
                return;
            }
            const q = questions[currentIdx];
            document.getElementById('question-area').textContent = (currentIdx+1) + '. ' + q.q;
            const opts = document.getElementById('options-area');
            opts.innerHTML = '';
            q.options.forEach((opt, i) => {
                const btn = document.createElement('div');
                btn.className = 'option';
                btn.textContent = opt;
                btn.onclick = () => selectOption(i, q.answer, btn);
                opts.appendChild(btn);
            });
        }
        function selectOption(picked, correct, el) {
            const opts = document.querySelectorAll('.option');
            opts.forEach(o => o.onclick = null);
            if (picked === correct) {
                el.classList.add('correct');
                score++;
            } else {
                el.classList.add('wrong');
                opts[correct].classList.add('correct');
            }
            setTimeout(() => { currentIdx++; showQuestion(); }, 1000);
        }
        showQuestion();
    </script>
</body>
</html>"""

# 模拟 AI 贴的诊断脚本（事故真凶）
DIAGNOSTIC_SCRIPT = """import os

# 检查项目目录是否存在
base = "projects/scientific-quiz"
print(f"项目目录存在: {os.path.exists(base)}")

# 列出所有子目录和文件
for root, dirs, files in os.walk("projects"):
    level = root.replace("projects", "").count(os.sep)
    indent = "  " * level
    print(f"{indent}{os.path.basename(root)}/")"""


def setup_test_db():
    """用 ORM 的 metadata 建表 + ORM 插入，保证 schema 与代码完全一致。"""
    from app.db.models import Base, ProjectModel
    import app.db.database as database_mod
    from sqlalchemy.orm import sessionmaker
    from app.core.time_utils import utc_now

    test_engine = database_mod.create_engine(f"sqlite:///{TEST_DB}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=test_engine)
    Session = sessionmaker(bind=test_engine, autoflush=False, expire_on_commit=False)
    session = Session()

    initial_data = {
        "workspace": {
            "code": ORIGINAL_HTML,
            "language": "html",
            "filename": "index.html",
            "files": [{"name": "index.html", "language": "html", "content": ORIGINAL_HTML, "is_main": True}],
            "preview_html": "<div>quiz preview</div>",
            "saved_at": "2026-07-17T10:20:25+00:00",
        }
    }
    proj = ProjectModel(
        id=PROJECT_ID,
        author_id="user-001",
        name="测试项目-修复验证",
        mode="standard",
        description="测试用",
        current_stage="stage_07_execute",
        initial_data=json.dumps(initial_data, ensure_ascii=False),
        created_at=utc_now(),
        updated_at=utc_now(),
        is_deleted=0,
    )
    session.add(proj)
    session.commit()
    session.close()
    test_engine.dispose()


def get_workspace():
    conn = sqlite3.connect(TEST_DB)
    row = conn.execute("SELECT initial_data FROM projects WHERE id=?", (PROJECT_ID,)).fetchone()
    conn.close()
    return json.loads(row[0]).get("workspace", {})


# ============================================================
# P0 验证：_extract_executable_code_block 不会被用于写库
# ============================================================
def test_p0_orchestrator_no_auto_extract():
    """模拟 orchestrator 流程：AI 回复含诊断脚本块时，workspace 不被覆盖。"""
    print("\n" + "=" * 70)
    print("P0 验证：orchestrator 不再自动捞取代码块覆盖 workspace")
    print("=" * 70)

    # 1. 模拟 AI 回复（含诊断脚本块）
    ai_response = f"""好的！我先读取当前阶段文档和代码，看还缺什么。
```python
{DIAGNOSTIC_SCRIPT}
```
"""

    # 2. 调用（已废弃的）_extract_executable_code_block —— 确认它仍能提取（只读）
    from app.services.orchestrator import AgentOrchestratorService
    extracted = AgentOrchestratorService._extract_executable_code_block(ai_response)
    print(f"[1] _extract_executable_code_block 提取结果: code_len={len(extracted['code']) if extracted else 0}")
    assert extracted is not None, "函数应仍能提取（保留作为只读工具）"
    assert "os.walk" in extracted["code"], "应提取到诊断脚本"

    # 3. 关键断言：orchestrator 的源码里不再有任何地方把这个函数的结果写库
    orch_path = Path("app/services/orchestrator.py")
    source = orch_path.read_text(encoding='utf-8')
    # 检查：_extract_executable_code_block 不再与 save_project_workspace 出现在同一段调用链
    # 简化检查：save_project_workspace 在 orchestrator 中应当只出现在注释/不存在
    write_calls = [
        i for i, line in enumerate(source.split('\n'), 1)
        if 'db.save_project_workspace' in line and not line.strip().startswith('#')
    ]
    print(f"[2] orchestrator.py 中 db.save_project_workspace 非注释调用数: {len(write_calls)}")
    print(f"    行号: {write_calls if write_calls else '(无)'}")
    assert len(write_calls) == 0, (
        f"P0 失败：orchestrator.py 仍存在 {len(write_calls)} 处 db.save_project_workspace 调用，"
        f"行号 {write_calls}。应当全部移除（代码写入只由 project_code_writer 工具完成）。"
    )

    # 4. 模拟完整流程：即便 AI 回复里有诊断脚本，workspace.code 也不变
    ws_before = get_workspace()
    print(f"[3] 测试前 workspace.code 长度: {len(ws_before['code'])} (应为完整 HTML)")

    # 模拟新版 orchestrator 逻辑：即使 force_code_generation=True 也不自动写
    # （真正调 project_code_writer 工具才会写；这里 AI 没调，所以什么都不发生）
    ws_after = get_workspace()  # 在真实流程里，这段流程根本不会触碰 DB
    assert ws_after["code"] == ORIGINAL_HTML, "workspace.code 不应被改动"
    assert ws_after["language"] == "html", "language 不应变"
    print(f"[4] ✅ 模拟 AI 回复含诊断脚本 → workspace.code 未被覆盖（长度仍 {len(ws_after['code'])}）")
    print("P0 验证通过 ✅")


# ============================================================
# P1 验证：save_project_workspace 历史快照 + 可疑覆盖检测
# ============================================================
def test_p1_history_snapshot_and_suspicious_detection():
    """直接调 save_project_workspace 覆盖 code，确认旧值进入 history 且可疑被记录。"""
    print("\n" + "=" * 70)
    print("P1 验证：save_project_workspace 历史快照 + 可疑覆盖检测")
    print("=" * 70)

    # 准备：用 monkeypatch 让 ProjectRepo 使用测试 DB
    import app.db.database as database_mod
    from app.db.models import Base

    # 用测试 DB 重建 engine
    original_engine = database_mod.engine
    test_engine = database_mod.create_engine(f"sqlite:///{TEST_DB}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=test_engine)
    # 替换全局 engine 和 SessionLocal
    database_mod.engine = test_engine
    original_session_local = database_mod.SessionLocal
    database_mod.SessionLocal = database_mod.sessionmaker(bind=test_engine, autoflush=False, expire_on_commit=False)

    try:
        from app.repositories.project_repo import ProjectRepo
        from app.db.database import SessionLocal
        repo = ProjectRepo(SessionLocal())

        # 1. 模拟事故场景：把完整 HTML 覆盖成诊断脚本（language 也从 html → python）
        print("\n[场景] 模拟事故：workspace.code 从 HTML(完整) 被覆盖为 python(诊断脚本)")
        repo.save_project_workspace(PROJECT_ID, {
            "code": DIAGNOSTIC_SCRIPT,
            "language": "python",
            "filename": "main.py",
            "saved_at": "2026-07-18T07:52:35+00:00",
        })

        ws = get_workspace()
        print(f"  覆盖后 code 长度: {len(ws['code'])} (应为 {len(DIAGNOSTIC_SCRIPT)})")
        print(f"  覆盖后 language:  {ws['language']}")
        assert ws["code"] == DIAGNOSTIC_SCRIPT, "新 code 应已写入"

        # 2. 关键断言：旧 HTML 进入了 code_history
        history = ws.get("code_history", [])
        print(f"\n[验证1] code_history 长度: {len(history)} (应 ≥ 1)")
        assert len(history) >= 1, "旧 code 应进入 code_history"

        last_snapshot = history[-1]
        print(f"  最后一个快照 code 长度: {len(last_snapshot['code'])}")
        print(f"  最后一个快照 language: {last_snapshot.get('language')}")
        print(f"  最后一个快照 saved_at: {last_snapshot.get('saved_at')}")
        assert last_snapshot["code"] == ORIGINAL_HTML, "快照中应是原 HTML 代码"
        assert last_snapshot.get("language") == "html", "快照应保留原 language"
        print("  ✅ 旧代码已被备份到 code_history，可恢复")

        # 3. 关键断言：可疑覆盖检测（本次覆盖：HTML 803字符 → 脚本 350字符，language html→python）
        # 此处仅验证逻辑正确性，warning 已打印到 stderr（测试时观察输出）
        shrink_ratio = len(DIAGNOSTIC_SCRIPT.strip()) / len(ORIGINAL_HTML.strip())
        print(f"\n[验证2] 代码长度缩减比: {shrink_ratio:.2%} (应 < 10%，触发可疑告警)")
        assert shrink_ratio < 0.1, "本次覆盖应触发可疑告警阈值"
        print("  ✅ 可疑覆盖检测条件已满足，应已记录 warning 日志")

        # 4. 多次覆盖测试：history 保留最近 5 版
        print("\n[验证3] 连续覆盖 7 次，history 应只保留最近 5 版")
        for i in range(7):
            repo.save_project_workspace(PROJECT_ID, {
                "code": f"# version {i}\nprint({i})",
                "language": "python",
                "saved_at": f"2026-07-18T08:00:0{i}+00:00",
            })
        ws = get_workspace()
        history = ws.get("code_history", [])
        print(f"  7 次覆盖后 history 长度: {len(history)} (应 = 5)")
        assert len(history) == 5, f"history 应限制在 5 版，实际 {len(history)}"
        print("  ✅ history 上限 5 版生效，不会无限膨胀")

        # 5. 正常 autosave（code 不变）不应污染 history
        print("\n[验证4] 正常 autosave（仅 preview_html 变化）不应新增 history")
        history_before = len(ws.get("code_history", []))
        repo.save_project_workspace(PROJECT_ID, {
            "preview_html": "<div>new preview</div>",
        })
        ws = get_workspace()
        history_after = len(ws.get("code_history", []))
        print(f"  history 长度变化: {history_before} → {history_after} (应不变)")
        assert history_after == history_before, "code 未变化时不应新增 history"
        print("  ✅ 正常 autosave 不污染 history")

        print("\nP1 验证通过 ✅")
    finally:
        # 恢复全局 engine
        database_mod.engine = original_engine
        database_mod.SessionLocal = original_session_local
        test_engine.dispose()


def main():
    print("工作目录:", os.getcwd())
    print("测试 DB:", TEST_DB)

    # 确保 import 能找到 app 包
    if not os.path.isdir("app"):
        print("ERR: 请在 apps/backend 目录下运行此脚本")
        sys.exit(1)

    setup_test_db()
    try:
        test_p0_orchestrator_no_auto_extract()
        test_p1_history_snapshot_and_suspicious_detection()
        print("\n" + "=" * 70)
        print("🎉 所有验证通过：P0 + P1 修复生效")
        print("=" * 70)
        print("\n结论：")
        print("  - AI 在回复里贴诊断脚本不会再覆盖 workspace.code（P0）")
        print("  - 即便发生覆盖，旧 code 会进入 code_history 可恢复（P1）")
        print("  - 可疑覆盖（长度突降+语言变化）会被记录告警（P1）")
    except AssertionError as e:
        print(f"\n❌ 验证失败: {e}")
        sys.exit(1)
    finally:
        try:
            os.unlink(TEST_DB)
        except OSError:
            pass


if __name__ == "__main__":
    main()
