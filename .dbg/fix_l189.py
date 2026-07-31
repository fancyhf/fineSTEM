# -*- coding: utf-8 -*-
"""修复 SearchReplace 工具破坏的 Create.tsx L189 正则字面量（历史累计 11 次）"""
import io

p = r'apps/frontend/src/pages/Create.tsx'
s = io.open(p, encoding='utf-8').read()
broken = "  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').replace(/^\\s*\n/gm, '');"
fixed = "  cleaned = cleaned.replace(/\\n{3,}/g, '\\n\\n').replace(/^\\s*\\n/gm, '');"
if fixed in s:
    print('already fixed, nothing to do')
elif broken in s:
    s = s.replace(broken, fixed, 1)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    print('fixed OK')
else:
    raise SystemExit('broken pattern NOT found - manual inspection needed')
