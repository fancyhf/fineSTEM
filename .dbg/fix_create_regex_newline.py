# -*- coding: utf-8 -*-
"""修复 SearchReplace 工具误将 Create.tsx 正则里的 \n 转成真实换行的问题（Q-038 修复过程中的工具事故）"""
import io

p = r'g:\mediaProjects\fineSTEM\apps\frontend\src\pages\Create.tsx'
s = io.open(p, encoding='utf-8').read()

broken = "  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').replace(/^\\s*\n/gm, '');"
fixed = "  cleaned = cleaned.replace(/\\n{3,}/g, '\\n\\n').replace(/^\\s*\\n/gm, '');"

if fixed in s and broken not in s:
    print('already fixed')
else:
    assert broken in s, 'broken pattern not found'
    s = s.replace(broken, fixed, 1)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    print('fixed OK')
