# fineSTEM SKILLs

> 开源的 AI 编程导师 Skill 集合
> 让每个学生都能享受个性化的 AI 编程指导

---

## 这是什么？

**fineSTEM SKILLs** 是一个开源的 AI 编程导师 Skill 集合。

每个 Skill 都是一个智能导师，能够通过对话引导学生完成特定的学习任务，从项目选题到代码实现，全程陪伴式指导。

### 兼容性

Skill 采用通用的 Markdown + YAML 格式，可在以下 AI IDE 中使用：

| AI IDE | 兼容性 | 说明 |
|--------|--------|------|
| **Trae IDE** | 完全兼容 | 原生支持 Skill 目录结构 |
| **Cursor** | 兼容 | 将 SKILL.md 内容作为系统提示 |
| **Windsurf** | 兼容 | 将 SKILL.md 内容作为系统提示 |
| **VS Code + Copilot** | 兼容 | 将 SKILL.md 内容作为上下文 |
| **Claude Desktop** | 兼容 | 将 SKILL.md 内容作为项目说明 |
| **其他 AI IDE** | 基本兼容 | 复制 SKILL.md 内容作为提示词 |

---

## 快速开始

### 方式 1：使用安装脚本（推荐）

**Windows:**
```powershell
# 下载并运行安装脚本
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/your-org/fineSTEM/main/SKILLs/install.ps1" -OutFile "install.ps1"
.\install.ps1 -Skill stem-pbl-guide
```

**macOS/Linux:**
```bash
# 一行命令安装
curl -fsSL https://raw.githubusercontent.com/your-org/fineSTEM/main/SKILLs/install.sh | bash -s stem-pbl-guide
```

详细用法请参考 [INSTALL-SCRIPTS.md](./INSTALL-SCRIPTS.md)

### 方式 2：手动安装

**步骤 1：下载 Skill**
```bash
git clone https://github.com/your-org/fineSTEM.git
cd fineSTEM/SKILLs
```

**步骤 2：根据你的 AI IDE 选择安装方式**

| AI IDE | 安装方式 |
|--------|---------|
| **Trae IDE** | 复制到 `~/.trae/skills/` 目录 |
| **Cursor** | 在项目根目录创建 `.cursorrules`，复制 SKILL.md 内容 |
| **Windsurf** | 在设置中添加 SKILL.md 内容作为系统提示 |
| **VS Code + Copilot** | 在 `.vscode/settings.json` 中配置 |
| **通用方式** | 直接将 SKILL.md 内容粘贴到 AI 对话框 |

### 方式 3：直接使用（最简单）

1. 打开 [stem-pbl-guide/SKILL.md](./stem-pbl-guide/SKILL.md)
2. 复制全部内容
3. 粘贴到你的 AI IDE 对话框
4. 开始对话

---

## 使用 Skill

安装完成后，在 AI 对话框中输入触发语：

```
"我想做一个项目"    # 启动 STEM PBL Guide
"创建新项目"        # 启动 STEM PBL Guide
"开始脑爆"          # 启动 STEM PBL Guide
```

---

## 可用的 Skills

| Skill | 名称 | 适用年龄 | 描述 | 触发语 |
|-------|------|---------|------|--------|
| [stem-pbl-guide](./stem-pbl-guide/) | STEM 项目式学习导师 | 10-18岁 | 完整的项目开发指导，从选题到结题 | "我想做一个项目" |

---

## Skill 目录结构

每个 Skill 遵循标准结构：

```
skill-name/
├── README.md              # Skill 说明文档
├── SKILL.md               # 核心：完整的技术规范和提示词
├── routing.yml            # 触发语路由配置
├── artifacts/             # 资源文件（可选）
│   ├── schemas/           # JSON Schema 定义
│   ├── templates/         # 文档模板
│   └── libraries/         # 题库资源
└── skills/                # 子 Skill 文件（可选）
```

**核心文件说明：**

- **SKILL.md** - 最重要的文件，包含完整的提示词和技术规范，可直接复制到任何 AI IDE 使用
- **README.md** - 使用说明和快速开始指南
- **routing.yml** - 触发语配置（部分 AI IDE 支持）
- **artifacts/** - 扩展资源（高级功能）

---

## 不同 AI IDE 的使用方法

### Trae IDE（原生支持）

```powershell
# 复制到 skills 目录
cp -r stem-pbl-guide ~/.trae/skills/
```

重启 Trae IDE，输入触发语即可。

### Cursor

```bash
# 在项目根目录创建 .cursorrules
echo "请参考以下 Skill 规范：" > .cursorrules
cat stem-pbl-guide/SKILL.md >> .cursorrules
```

### Windsurf

1. 打开 Windsurf 设置
2. 找到 "System Prompt" 或 "Custom Instructions"
3. 粘贴 SKILL.md 内容

### VS Code + GitHub Copilot

```json
// .vscode/settings.json
{
  "github.copilot.chat.codeGeneration.instructions": [
    {
      "file": "./stem-pbl-guide/SKILL.md"
    }
  ]
}
```

### 其他 AI IDE

直接将 SKILL.md 内容复制到对话中作为上下文。

---

## 贡献指南

我们欢迎社区贡献！无论是：

- 修复 Bug
- 新增 Skill
- 改进文档
- 翻译支持

请参考 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解详情。

---

## 许可证

本项目采用 [CC BY-NC-SA 4.0](../LICENSE) 许可证。

---

## 相关链接

- [fineSTEM 主项目](../README.md)
- [安装脚本指南](./INSTALL-SCRIPTS.md)
- [手动安装指南](./INSTALL.md)
- [问题反馈](../../issues)

---

*让 AI 编程教育触手可及*
