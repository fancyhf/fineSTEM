# 用途: 把本地 Windows 版 ZeroClaw config.toml 转换为 Linux 服务器部署版
# 输入: H:\dev-env\zeroclaw\config\config.toml (开发环境正源)
# 输出: temp 服务器版 config.toml (key 留空, 由 zeroclaw config set 设置)
# 维护: AI Agent
import re

SRC = r"H:\dev-env\zeroclaw\config\config.toml"
DST = r"G:\mediaProjects\fineSTEM\deploysettings\zeroclaw-server-config.toml"

with open(SRC, "r", encoding="utf-8") as f:
    content = f.read()

# 1. MCP server 命令: Windows pythonw -> Linux venv python
content = content.replace(
    'command = "H:\\\\dev-env\\\\dependencies\\\\fineSTEM-backend\\\\.venv\\\\Scripts\\\\pythonw.exe"',
    'command = "/opt/finestem/venv/bin/python"',
)
# 2. args server.py 路径
content = content.replace(
    'args = ["G:\\\\mediaProjects\\\\fineSTEM\\\\apps\\\\backend\\\\app\\\\mcp_server\\\\server.py"]',
    'args = ["/opt/finestem/app/app/mcp_server/server.py"]',
)
# 3. env: PYTHONPATH / FINESTEM_BACKEND_DIR
content = content.replace(
    'PYTHONPATH = "G:\\\\mediaProjects\\\\fineSTEM\\\\apps\\\\backend"',
    'PYTHONPATH = "/opt/finestem/app"',
)
content = content.replace(
    'FINESTEM_BACKEND_DIR = "G:\\\\mediaProjects\\\\fineSTEM\\\\apps\\\\backend"',
    'FINESTEM_BACKEND_DIR = "/opt/finestem/app"',
)
# 4. FINESTEM_DB_URL
content = content.replace(
    'FINESTEM_DB_URL = "sqlite:///D:/data/finestem/finestem.db"',
    'FINESTEM_DB_URL = "sqlite:////opt/finestem/data/finestem.db"',
)
# 5. gateway web_dist_dir
content = content.replace(
    'web_dist_dir = "H:\\\\dev-env\\\\zeroclaw\\\\bin\\\\web"',
    'web_dist_dir = "/opt/zeroclaw/bin/web"',
)
# 6. sops_dir
content = content.replace(
    'sops_dir = "H:\\\\dev-env\\\\zeroclaw\\\\config\\\\data\\\\sops"',
    'sops_dir = "/opt/zeroclaw/config/sops"',
)

# 7. enc2 加密 key 全部置空 (服务器上由 zeroclaw config set 重新写入, enc2 串不可跨机器解密)
content = re.sub(r'api_key = "enc2:[^"]*"', 'api_key = ""', content)
content = re.sub(r'paired_tokens = \[[^\]]*\]', 'paired_tokens = []', content)

# 8. 启用 GLM fallback 段 (取消注释, key 同样由 config set 写入)
content = content.replace(
    '# [providers.models.glm.default]\n# model = "glm-4-plus"\n# api_key = ""\n# fallback = ["deepseek.default"]',
    '[providers.models.glm.default]\nmodel = "glm-4-plus"\napi_key = ""\nfallback = ["deepseek.default"]',
)

with open(DST, "w", encoding="utf-8") as f:
    f.write(content)

print("转换完成:", DST)
# 校验
left_win = re.findall(r'[A-Z]:\\\\', content)
enc2_left = re.findall(r'enc2:', content)
glm_enabled = '[providers.models.glm.default]' in content and '# [providers.models.glm.default]' not in content
print("残留 Windows 路径:", left_win)
print("残留 enc2:", len(enc2_left))
print("GLM 段已启用:", glm_enabled)
