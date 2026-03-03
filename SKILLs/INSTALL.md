# Skill 安装指南

> 如何将 fineSTEM SKILLs 安装到你的 Trae IDE

---

## 目录

1. [快速安装](#快速安装)
2. [手动安装](#手动安装)
3. [验证安装](#验证安装)
4. [更新 Skill](#更新-skill)
5. [卸载 Skill](#卸载-skill)
6. [故障排除](#故障排除)

---

## 快速安装

### 方法 1：使用安装脚本（推荐）

**Windows:**
```powershell
# 下载并运行安装脚本
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/your-org/fineSTEM/main/SKILLs/install.ps1" -OutFile "install.ps1"
.\install.ps1 -Skill "stem-pbl-guide"
```

**macOS/Linux:**
```bash
# 下载并运行安装脚本
curl -fsSL https://raw.githubusercontent.com/your-org/fineSTEM/main/SKILLs/install.sh | bash -s stem-pbl-guide
```

### 方法 2：使用 Git

```bash
# 克隆仓库
git clone https://github.com/your-org/fineSTEM.git

# 运行安装脚本
cd fineSTEM/SKILLs
./install.sh stem-pbl-guide
```

---

## 手动安装

### 步骤 1：找到 Trae IDE 的 Skill 目录

**Windows:**
```
%USERPROFILE%\.trae\skills\
# 通常是:
C:\Users\你的用户名\.trae\skills\
```

**macOS:**
```
~/.trae/skills/
# 通常是:
/Users/你的用户名/.trae/skills/
```

**Linux:**
```
~/.trae/skills/
# 通常是:
/home/你的用户名/.trae/skills/
```

### 步骤 2：下载 Skill

**方式 A：下载 ZIP 文件**

1. 访问 [fineSTEM  releases](https://github.com/your-org/fineSTEM/releases)
2. 下载最新版本的 `SKILLs.zip`
3. 解压到临时目录

**方式 B：使用 Git**

```bash
# 克隆整个仓库
git clone https://github.com/your-org/fineSTEM.git

# 或者使用 sparse checkout 只下载 SKILLs 目录
git clone --filter=blob:none --sparse https://github.com/your-org/fineSTEM.git
cd fineSTEM
git sparse-checkout set SKILLs
```

### 步骤 3：复制 Skill 文件

**Windows (PowerShell):**
```powershell
# 复制单个 Skill
Copy-Item -Path "下载路径\fineSTEM\SKILLs\stem-pbl-guide" `
            -Destination "$env:USERPROFILE\.trae\skills\" `
            -Recurse -Force

# 或者复制所有 Skills
Copy-Item -Path "下载路径\fineSTEM\SKILLs\*" `
            -Destination "$env:USERPROFILE\.trae\skills\" `
            -Recurse -Force
```

**macOS/Linux (Bash):**
```bash
# 复制单个 Skill
cp -r 下载路径/fineSTEM/SKILLs/stem-pbl-guide ~/.trae/skills/

# 或者复制所有 Skills
cp -r 下载路径/fineSTEM/SKILLs/* ~/.trae/skills/
```

### 步骤 4：重启 Trae IDE

安装完成后，**完全关闭并重新打开** Trae IDE，以确保 Skill 被正确加载。

---

## 验证安装

### 方法 1：检查文件

确认 Skill 文件已正确复制：

**Windows:**
```powershell
Test-Path "$env:USERPROFILE\.trae\skills\stem-pbl-guide\SKILL.md"
# 应该返回 True
```

**macOS/Linux:**
```bash
ls ~/.trae/skills/stem-pbl-guide/SKILL.md
# 应该显示文件存在
```

### 方法 2：测试触发语

在 Trae IDE 的 AI 对话框中输入：

```
"我想做一个项目"
```

如果 Skill 安装正确，AI 应该回应并启动 STEM PBL Guide。

---

## 更新 Skill

### 自动更新

如果 Skill 支持自动更新，Trae IDE 会在启动时检查更新。

### 手动更新

**步骤 1：备份当前配置（可选）**

```bash
# 备份旧的 Skill
cp -r ~/.trae/skills/stem-pbl-guide ~/.trae/skills/stem-pbl-guide.backup
```

**步骤 2：删除旧版本**

**Windows:**
```powershell
Remove-Item -Path "$env:USERPROFILE\.trae\skills\stem-pbl-guide" -Recurse -Force
```

**macOS/Linux:**
```bash
rm -rf ~/.trae/skills/stem-pbl-guide
```

**步骤 3：安装新版本**

按照[手动安装](#手动安装)步骤安装新版本。

---

## 卸载 Skill

**Windows:**
```powershell
Remove-Item -Path "$env:USERPROFILE\.trae\skills\stem-pbl-guide" -Recurse -Force
```

**macOS/Linux:**
```bash
rm -rf ~/.trae/skills/stem-pbl-guide
```

卸载后重启 Trae IDE。

---

## 故障排除

### 问题 1：Skill 没有响应

**可能原因：**
- Skill 没有正确复制到目录
- Trae IDE 没有重启
- 触发语输入错误

**解决方案：**
1. 检查 Skill 目录是否存在
2. 完全关闭并重新打开 Trae IDE
3. 确认使用正确的触发语（参考 Skill 的 README.md）

### 问题 2：触发 Skill 但行为异常

**可能原因：**
- Skill 文件损坏
- 版本不兼容

**解决方案：**
1. 删除并重新安装 Skill
2. 检查 Trae IDE 版本是否符合要求
3. 查看 Skill 的更新日志

### 问题 3：找不到 Skill 目录

**解决方案：**

**Windows:**
```powershell
# 创建目录
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.trae\skills"
```

**macOS/Linux:**
```bash
# 创建目录
mkdir -p ~/.trae/skills
```

### 问题 4：权限错误

**Windows:**
- 以管理员身份运行 PowerShell
- 或修改目录权限：`icacls "$env:USERPROFILE\.trae" /grant "$env:USERNAME:(OI)(CI)F"`

**macOS/Linux:**
- 检查目录权限：`ls -la ~/.trae/`
- 修改权限：`chmod -R 755 ~/.trae/skills`

---

## 获取帮助

如果以上方法都无法解决问题：

1. 查看 [FAQ](./FAQ.md)
2. 提交 [Issue](https://github.com/your-org/fineSTEM/issues)
3. 加入社区讨论

---

## 相关链接

- [SKILLs 主页面](./README.md)
- [Skill 开发指南](./DEVELOPMENT.md)
- [贡献指南](./CONTRIBUTING.md)
