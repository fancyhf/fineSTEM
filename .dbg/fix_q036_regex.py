# -*- coding: utf-8 -*-
"""fix Create.tsx L190 regex literal broken by SearchReplace escape bug"""
import io
p = r"apps/frontend/src/pages/Create.tsx"
with io.open(p, "r", encoding="utf-8", newline="") as f:
    src = f.read()
broken = "  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').replace(/^\\s*\n/gm, '');"
fixed = "  cleaned = cleaned.replace(/\\n{3,}/g, '\\n\\n').replace(/^\\s*\\n/gm, '');"
# 兼容 CRLF：把 broken 里的 \n 也按 \r\n 试一次
if broken in src:
    src = src.replace(broken, fixed)
    print("fixed (LF)")
else:
    broken_crlf = broken.replace("\n", "\r\n")
    if broken_crlf in src:
        src = src.replace(broken_crlf, fixed)
        print("fixed (CRLF)")
    else:
        print("NOT FOUND"); raise SystemExit(1)
with io.open(p, "w", encoding="utf-8", newline="") as f:
    f.write(src)
