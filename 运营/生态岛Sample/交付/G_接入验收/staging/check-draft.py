# -*- coding: utf-8 -*-
"""
staging/check-draft.py —— Know 暂存包结构与 schema 自检脚本（G 包第二段，2026-11-03）

镜像 apps/backend/app/services/know_content.py 的磁盘解析规则（只读校验，不改任何生产文件）：
- series/<slug>/series.json + <epdir>/episode.json 解析
- status 缺省视为 "published"（loader 第 149-150 行）——draft 必须显式写非 published 值
- projects 必须有 url；videos 必须有 embed_url；docs/interactive 必须有 path
- 引用的相对文件必须在本 draft 目录内实际存在
- slug 与 content/know/series/ 现有系列不冲突
运行：python -I staging/check-draft.py
"""
import json
import sys
from pathlib import Path

STAGING = Path(__file__).resolve().parent
DRAFT = STAGING / "draft"
PROD_SERIES = Path("G:/mediaProjects/fineSTEM/content/know/series")

errors, warnings, checks = [], [], 0

def ok(msg):
    global checks
    checks += 1
    print(f"  [PASS] {msg}")

def err(msg):
    errors.append(msg)
    print(f"  [FAIL] {msg}")

def warn(msg):
    warnings.append(msg)
    print(f"  [WARN] {msg}")

print("== 1. slug 冲突检查 ==")
existing = sorted(p.name for p in PROD_SERIES.iterdir() if p.is_dir()) if PROD_SERIES.is_dir() else []
print(f"  生产现有系列: {existing}")
draft_series = sorted(p.name for p in (DRAFT / "series").iterdir() if p.is_dir())
for s in draft_series:
    if s in existing:
        err(f"系列 slug 冲突: {s}")
    else:
        ok(f"系列 slug 无冲突: {s}")

print("== 2. series.json 解析 ==")
for sdir in sorted((DRAFT / "series").iterdir()):
    sj = sdir / "series.json"
    if not sj.is_file():
        err(f"{sdir.name}: 缺 series.json")
        continue
    try:
        meta = json.load(open(sj, encoding="utf-8"))
    except Exception as e:
        err(f"{sdir.name}: series.json 解析失败 {e}")
        continue
    slug = str(meta.get("slug") or sdir.name)
    ok(f"series.json 解析成功 slug={slug} title={meta.get('title')}")
    for k in ("slug", "title", "brand", "audience"):
        if not meta.get(k):
            warn(f"series.json 缺字段 {k}（loader 有默认值，非阻断）")
    if meta.get("brand") not in ("jiwa", "finestem"):
        err(f"brand={meta.get('brand')} 不在枚举 (jiwa|finestem)")
    else:
        ok(f"brand={meta.get('brand')} 合法")

print("== 3. episode.json 解析与 loader 规则 ==")
for sdir in sorted((DRAFT / "series").iterdir()):
    for edir in sorted(sdir.iterdir()):
        ej = edir / "episode.json"
        if not ej.is_file():
            continue
        try:
            ep = json.load(open(ej, encoding="utf-8"))
        except Exception as e:
            err(f"{edir.name}: episode.json 解析失败 {e}")
            continue
        ok(f"episode.json 解析成功 slug={ep.get('slug')} ep_no={ep.get('episode_no')}")
        status = ep.get("status", "published")
        if status == "published":
            err("status 为 published——暂存包绝不可默认可发布；必须显式写 draft")
        else:
            ok(f"status={status}（loader 第149-150行：非 published 不会出现在任何公开列表/详情）")
        if ep.get("published_at"):
            warn(f"published_at={ep.get('published_at')} 已填——发布日期应由统筹在发布时确定")
        else:
            ok("published_at 为空（未虚构发布日期）")
        if ep.get("cover"):
            cov = edir / ep["cover"]
            if not cov.is_file():
                err(f"cover 文件不存在: {ep['cover']}")
            else:
                ok(f"cover 文件存在: {ep['cover']}")
        else:
            ok("cover 为空（Know 端封面未制作，发布待办，不占位）")
        res = ep.get("resources") or {}
        # interactive
        it = res.get("interactive")
        if it:
            p = edir / str(it.get("path") or "")
            if it.get("path") and p.is_file():
                ok(f"interactive 文件存在: {it['path']}（{p.stat().st_size} 字节）")
            else:
                err(f"interactive.path 缺失或文件不存在: {it}")
        else:
            warn("无 interactive 资源")
        # videos
        for i, v in enumerate(res.get("videos") or []):
            if not v.get("embed_url"):
                err(f"videos[{i}] 缺 embed_url（loader 会丢弃该条）")
        if not res.get("videos"):
            ok("videos=[]（本地视频未发布无外链，不填占位地址——符合任务书第 5 条）")
        # docs
        for i, d in enumerate(res.get("docs") or []):
            dp = d.get("path")
            if not dp:
                err(f"docs[{i}] 缺 path（loader 会丢弃该条）")
                continue
            if dp.startswith(("http://", "https://")):
                ok(f"docs[{i}] 外链: {dp}")
            elif (edir / dp).is_file():
                ok(f"docs[{i}] 文件存在: {dp}")
            else:
                err(f"docs[{i}] 文件不存在: {dp}")
        # projects
        if not res.get("projects"):
            warn("无 projects 资源")
        for i, pj in enumerate(res.get("projects") or []):
            if not pj.get("url"):
                err(f"projects[{i}] 缺 url（loader 会丢弃该条）")
            elif pj.get("url").startswith("https://wostemstudio.top/research/projects/04f835ac"):
                ok(f"projects[{i}] url=已验证的线上项目 04f835ac 地址")
            else:
                warn(f"projects[{i}] url 非 04f835ac 已验证地址，人工复核: {pj.get('url')}")

print("== 4. 汇总 ==")
print(f"检查项: {checks} PASS | FAIL {len(errors)} | WARN {len(warnings)}")
if errors:
    print("存在 FAIL，暂存包不可交付")
    sys.exit(1)
print("全部阻断项通过（WARN 为发布前待办提醒，见 staging/README.md）")
