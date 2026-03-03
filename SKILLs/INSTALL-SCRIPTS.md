# 安装脚本快速参考

> 使用安装脚本快速安装 fineSTEM SKILLs

---

## 快速开始

### Windows (PowerShell)

```powershell
# 下载安装脚本
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/your-org/fineSTEM/main/SKILLs/install.ps1" -OutFile "install.ps1"

# 安装 Skill
.\install.ps1 -Skill stem-pbl-guide
```

### macOS/Linux (Bash)

```bash
# 使用 curl 安装
curl -fsSL https://raw.githubusercontent.com/your-org/fineSTEM/main/SKILLs/install.sh | bash -s stem-pbl-guide

# 或使用 wget
wget -qO- https://raw.githubusercontent.com/your-org/fineSTEM/main/SKILLs/install.sh | bash -s stem-pbl-guide
```

---

## 命令选项

### Windows (install.ps1)

| 选项 | 说明 | 示例 |
|------|------|------|
| `-Skill <name>` | 指定 Skill 名称 | `-Skill stem-pbl-guide` |
| `-Source <source>` | 指定源: github, gitee | `-Source gitee` |
| `-Branch <branch>` | 指定分支 | `-Branch develop` |
| `-List` | 列出所有可用 Skills | `-List` |
| `-Update` | 更新已安装的 Skill | `-Update` |
| `-Uninstall` | 卸载指定的 Skill | `-Uninstall` |
| `-Force` | 强制安装，覆盖现有文件 | `-Force` |
| `-Help` | 显示帮助信息 | `-Help` |

### macOS/Linux (install.sh)

| 选项 | 说明 | 示例 |
|------|------|------|
| `-s <name>` | 指定 Skill 名称 | `-s stem-pbl-guide` |
| `-S <source>` | 指定源: github, gitee | `-S gitee` |
| `-b <branch>` | 指定分支 | `-b develop` |
| `-l` | 列出所有可用 Skills | `-l` |
| `-u` | 更新已安装的 Skill | `-u` |
| `-U` | 卸载指定的 Skill | `-U` |
| `-f` | 强制安装，覆盖现有文件 | `-f` |
| `-h` | 显示帮助信息 | `-h` |

---

## 使用示例

### 1. 列出可用 Skills

**Windows:**
```powershell
.\install.ps1 -List
```

**macOS/Linux:**
```bash
./install.sh -l
```

输出示例：
```
可用 Skills:
------------
  - stem-pbl-guide
    STEM 项目式学习导师
```

### 2. 安装 Skill

**Windows:**
```powershell
.\install.ps1 -Skill stem-pbl-guide
```

**macOS/Linux:**
```bash
./install.sh -s stem-pbl-guide
```

### 3. 从 Gitee 安装（国内用户推荐）

**Windows:**
```powershell
.\install.ps1 -Skill stem-pbl-guide -Source gitee
```

**macOS/Linux:**
```bash
./install.sh -s stem-pbl-guide -S gitee
```

### 4. 更新 Skill

**Windows:**
```powershell
.\install.ps1 -Skill stem-pbl-guide -Update
```

**macOS/Linux:**
```bash
./install.sh -s stem-pbl-guide -u
```

### 5. 卸载 Skill

**Windows:**
```powershell
.\install.ps1 -Skill stem-pbl-guide -Uninstall
```

**macOS/Linux:**
```bash
./install.sh -s stem-pbl-guide -U
```

### 6. 强制重新安装

**Windows:**
```powershell
.\install.ps1 -Skill stem-pbl-guide -Force
```

**macOS/Linux:**
```bash
./install.sh -s stem-pbl-guide -f
```

---

## 本地安装

如果你已经下载了 fineSTEM 仓库，可以使用本地安装：

### Windows:
```powershell
# 进入 SKILLs 目录
cd fineSTEM/SKILLs

# 直接运行安装脚本
.\install.ps1 -Skill stem-pbl-guide
```

### macOS/Linux:
```bash
# 进入 SKILLs 目录
cd fineSTEM/SKILLs

# 给脚本添加执行权限
chmod +x install.sh

# 运行安装脚本
./install.sh -s stem-pbl-guide
```

---

## 故障排除

### 问题 1：无法运行脚本（Windows）

**错误：**
```
无法加载文件，因为在此系统上禁止运行脚本
```

**解决：**
```powershell
# 临时允许运行脚本
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process

# 然后运行安装脚本
.\install.ps1 -Skill stem-pbl-guide
```

### 问题 2：权限 denied（macOS/Linux）

**错误：**
```
bash: ./install.sh: Permission denied
```

**解决：**
```bash
# 添加执行权限
chmod +x install.sh

# 然后运行
./install.sh -s stem-pbl-guide
```

### 问题 3：找不到 Git

**错误：**
```
未找到 Git，请先安装 Git
```

**解决：**

**Windows:**
- 下载安装 Git: https://git-scm.com/download/win

**macOS:**
```bash
brew install git
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt-get install git

# CentOS/RHEL
sudo yum install git
```

### 问题 4：找不到 Trae IDE 目录

**解决：**
脚本会自动创建默认目录 `~/.trae/skills/`，安装完成后请重启 Trae IDE。

---

## 注意事项

1. **重启 Trae IDE** - 安装完成后必须重启 Trae IDE 才能加载新 Skill
2. **备份** - 更新或卸载时会自动备份旧版本
3. **网络** - 需要从 GitHub/Gitee 下载，请确保网络连接正常
4. **权限** - Windows 可能需要管理员权限，macOS/Linux 需要执行权限

---

## 高级用法

### 批量安装

**Windows:**
```powershell
$skills = @("stem-pbl-guide", "python-basics", "web-crawler")
foreach ($skill in $skills) {
    .\install.ps1 -Skill $skill -Force
}
```

**macOS/Linux:**
```bash
for skill in stem-pbl-guide python-basics web-crawler; do
    ./install.sh -s $skill -f
done
```

### 安装特定版本

**Windows:**
```powershell
.\install.ps1 -Skill stem-pbl-guide -Branch v1.2.0
```

**macOS/Linux:**
```bash
./install.sh -s stem-pbl-guide -b v1.2.0
```

---

## 相关链接

- [详细安装指南](./INSTALL.md)
- [SKILLs 主页面](./README.md)
- [贡献指南](./CONTRIBUTING.md)
