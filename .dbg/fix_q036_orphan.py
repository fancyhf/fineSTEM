# -*- coding: utf-8 -*-
import io
p = r"apps/frontend/src/pages/Create.tsx"
with io.open(p, "r", encoding="utf-8", newline="") as f:
    src = f.read()

# 1) 修复 L190 被破坏的正则字面量
broken = "  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').replace(/^\\s*\n/gm, '');"
fixed = "  cleaned = cleaned.replace(/\\n{3,}/g, '\\n\\n').replace(/^\\s*\\n/gm, '');"
if broken in src:
    src = src.replace(broken, fixed); print("regex fixed")
else:
    print("regex: already ok or not found")

# 2) 删除孤儿尾巴代码块
orphan = (
    "  };\n"
    "      const sections = descriptions.map((desc, idx) => `\u3010\u622a\u56fe ${idx + 1} \u8bc6\u522b\u5185\u5bb9\u3011\n"
    "${desc}`);\n"
    "      const combined = [\n"
    "        text || '\u8bf7\u5e2e\u6211\u770b\u770b\u4e0b\u9762\u622a\u56fe\u91cc\u7684\u95ee\u9898\u3002',\n"
    "        '\uff08\u4ee5\u4e0b\u662f\u6211\u53d1\u9001\u7684\u622a\u56fe\u7ecf\u89c6\u89c9\u6a21\u578b\u8bc6\u522b\u51fa\u7684\u6587\u5b57\u5185\u5bb9\uff0c\u8bf7\u636e\u6b64\u5e2e\u6211\u8bca\u65ad\u548c\u56de\u7b54\uff09',\n"
    "        ...sections,\n"
    "      ].join(`\n"
    "\n"
    "`);\n"
    "      const displayContent = text ? `${text}\n"
    "[\u9644 ${images.length} \u5f20\u622a\u56fe]` : `[\u9644 ${images.length} \u5f20\u622a\u56fe]`;\n"
    "      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));\n"
    "      setPendingImages([]);\n"
    "      await handleSend(combined, undefined, { displayContent, displayImages });\n"
    "    } finally {\n"
    "      setIsAnalyzingImages(false);\n"
    "    }\n"
    "  };\n"
)
replacement = "  };\n"
if orphan in src:
    src = src.replace(orphan, replacement, 1); print("orphan removed")
else:
    print("orphan NOT FOUND")

with io.open(p, "w", encoding="utf-8", newline="") as f:
    f.write(src)
