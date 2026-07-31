# -*- coding: utf-8 -*-
"""Q-028 数据修复：英语单词学习助手项目

背景：AI 因 artifact_writer 不认 evaluation 工件名，把正确验收内容写进了
metadata.evaluate_content（截图自述），standard_step_data.evaluate_content
仍是旧垃圾内容（学生首条消息）。本脚本把 metadata 里的正确内容搬回权威位置。

用法：
  python .dbg/fix_q028_english_project.py          # 只检查（dry-run）
  python .dbg/fix_q028_english_project.py --apply  # 实际修复
"""
import json
import sqlite3
import sys

DB = r"D:/data/finestem/finestem.db"
APPLY = "--apply" in sys.argv

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row

# 1. 找项目（名字含"英语单词"）
rows = conn.execute(
    "SELECT id, name, current_stage FROM projects WHERE name LIKE '%英语单词%'"
).fetchall()
if not rows:
    # 兜底：从 skill_states.metadata 找
    rows = conn.execute(
        "SELECT p.id, p.name, p.current_stage FROM projects p "
        "JOIN skill_states s ON s.project_id = p.id "
        "WHERE s.metadata LIKE '%英语单词%'"
    ).fetchall()
print(f"候选项目 {len(rows)} 个:")
for r in rows:
    print(f"  {r['id']}  {r['name']}  stage={r['current_stage']}")

for r in rows:
    pid = r["id"]
    st = conn.execute(
        "SELECT metadata, standard_step_data FROM skill_states WHERE project_id=?",
        (pid,),
    ).fetchone()
    if not st:
        print(f"  [{pid}] 无 skill_state，跳过")
        continue
    meta = json.loads(st["metadata"] or "{}")
    ssd = json.loads(st["standard_step_data"] or "{}")
    meta_eval = (meta.get("evaluate_content") or "").strip()
    ssd_eval = (ssd.get("evaluate_content") or "").strip()
    print(f"\n  [{pid}] metadata.evaluate_content 长度={len(meta_eval)}")
    print(f"  [{pid}] standard_step_data.evaluate_content 长度={len(ssd_eval)}")
    print(f"    ssd 前80字: {ssd_eval[:80]!r}")
    print(f"    meta 前80字: {meta_eval[:80]!r}")
    step8_payload = (ssd.get("step8") or {}).get("payload") or {}
    if step8_payload:
        print(f"    step8.payload 字段: " + json.dumps(
            {k: str(v)[:60] for k, v in step8_payload.items()}, ensure_ascii=False))

    # 判定：meta 有正确内容且 ssd 是旧垃圾（空/过短/后端自动生成的模板验收，
    # 模板特征："在 AI 导师引导下完成的 <学生首条消息截断> 项目"）
    stale = (
        (not ssd_eval)
        or len(ssd_eval) < 50
        or "在 AI 导师引导下完成的" in ssd_eval
    )
    if meta_eval and stale and meta_eval != ssd_eval:
        print(f"    → 需要修复（ssd 陈旧，meta 有正确内容）")
        if APPLY:
            ssd["evaluate_content"] = meta_eval
            # step8.payload.acceptance_summary 也是模板垃圾（前端评估卡读它），一并替换
            step8 = ssd.setdefault("step8", {})
            payload = step8.setdefault("payload", {})
            if "在 AI 导师引导下完成的" in (payload.get("acceptance_summary") or ""):
                payload["acceptance_summary"] = meta_eval
            conn.execute(
                "UPDATE skill_states SET standard_step_data=? WHERE project_id=?",
                (json.dumps(ssd, ensure_ascii=False), pid),
            )
            conn.commit()
            print(f"    ✅ 已把 metadata.evaluate_content 搬入 standard_step_data")
        else:
            print(f"    （dry-run，加 --apply 执行）")
    else:
        print(f"    → 无需修复（stale={stale}, meta_eval={'有' if meta_eval else '无'}）")

conn.close()
