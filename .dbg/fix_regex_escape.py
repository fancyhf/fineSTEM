# 一次性修复脚本：SearchReplace 把 Create.tsx 中正则 \n 字面量破坏成真实换行，改回去
import io

p = r"g:\mediaProjects\fineSTEM\apps\frontend\src\pages\Create.tsx"
s = io.open(p, encoding="utf-8").read()

bad = "  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').replace(/^\\s*\n/gm, '');"
good = "  cleaned = cleaned.replace(/\\n{3,}/g, '\\n\\n').replace(/^\\s*\\n/gm, '');"

assert bad in s, "bad pattern not found"
s = s.replace(bad, good, 1)
io.open(p, "w", encoding="utf-8", newline="").write(s)
print("fixed")
