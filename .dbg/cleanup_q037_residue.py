# -*- coding: utf-8 -*-
"""清理 verify_q037 残留的临时项目（走 repo API，级联清理关联数据）。"""
import sys

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, r"g:\mediaProjects\fineSTEM\apps\backend")

from app.repositories.runtime_db import db  # noqa: E402

for pid in (
    "33e3d65d-6ac0-4753-8087-0d28f4c096b1",  # Q037运动小管家复现
    "637f5b50-0e2b-4ee8-b54b-7a76b4eeefea",  # Q037纯占位项目
):
    project = db.get_project(pid)
    if not project:
        print(pid[:8], "已不存在")
        continue
    if not project.name.startswith("Q037"):
        print(pid[:8], "名称不匹配，跳过:", project.name)
        continue
    ok = db.delete_project(pid, project.author_id)
    print(pid[:8], project.name, "->", "删除成功" if ok else "删除失败")
