# 贡献指南

> 如何为 fineSTEM SKILLs 做出贡献

感谢你对 fineSTEM SKILLs 的兴趣！我们欢迎各种形式的贡献。

---

## 目录

1. [贡献方式](#贡献方式)
2. [提交 Skill](#提交-skill)
3. [代码规范](#代码规范)
4. [审查流程](#审查流程)
5. [开发环境](#开发环境)

---

## 贡献方式

### 1. 报告 Bug

如果你发现了 Bug：

1. 先搜索 [Issues](https://github.com/your-org/fineSTEM/issues) 确认是否已存在
2. 如果不存在，创建新 Issue，包含：
   - 清晰的标题
   - 问题描述
   - 复现步骤
   - 预期行为 vs 实际行为
   - 环境信息（OS, Trae IDE 版本等）

### 2. 提出改进建议

有想法让 Skill 更好？

1. 创建 Issue，标签选择 `enhancement`
2. 描述你的建议和使用场景
3. 如果可能，提供实现思路

### 3. 提交新 Skill

创建了新的 Skill？欢迎分享！

详见 [提交 Skill](#提交-skill) 部分。

### 4. 改进文档

发现文档有误或不清晰？

- 直接提交 PR 修复
- 或创建 Issue 指出问题

---

## 提交 Skill

### 步骤 1：准备你的 Skill

确保你的 Skill 包含：

```
your-skill/
├── README.md              # 必须：使用说明
├── SKILL.md               # 必须：技术规范
├── routing.yml            # 必须：触发语配置
├── artifacts/             # 可选：资源文件
│   ├── schemas/           # JSON Schema
│   └── templates/         # 模板文件
└── skills/                # 可选：子 Skill
```

### 步骤 2：遵循规范

#### 命名规范

- Skill 目录名使用小写字母和连字符
- 示例：`stem-pbl-guide`, `python-basics`, `web-crawler`

#### 文件规范

- 所有文档使用 Markdown 格式
- 所有配置文件使用 YAML 或 JSON
- 所有代码文件使用 UTF-8 编码

#### 语言规范

- 所有 Skill 必须使用中文（zh-CN）
- 代码注释可以使用中文

### 步骤 3：测试你的 Skill

在提交前，确保：

1. **功能测试**
   - 所有触发语都能正常工作
   - 核心功能运行正常
   - 边缘情况处理得当

2. **兼容性测试**
   - 在最新版 Trae IDE 测试
   - 在不同操作系统测试（如果可能）

3. **文档检查**
   - README.md 清晰完整
   - 所有链接有效
   - 示例代码可运行

### 步骤 4：提交 PR

1. **Fork 仓库**
   ```bash
   git clone https://github.com/your-username/fineSTEM.git
   cd fineSTEM
   ```

2. **创建分支**
   ```bash
   git checkout -b skill/your-skill-name
   ```

3. **复制 Skill**
   ```bash
   cp -r /path/to/your/skill SKILLs/your-skill-name
   ```

4. **提交更改**
   ```bash
   git add SKILLs/your-skill-name
   git commit -m "Add skill: your-skill-name"
   git push origin skill/your-skill-name
   ```

5. **创建 Pull Request**
   - 标题：`Add skill: your-skill-name`
   - 描述：包含 Skill 功能介绍、适用场景、测试情况

---

## 代码规范

### Markdown 规范

- 使用 ATX 风格的标题（`#` 而不是 `=`）
- 代码块指定语言
- 表格对齐使用空格

### YAML 规范

- 使用 2 空格缩进
- 字符串使用双引号
- 列表项使用 `- `

### JSON 规范

- 使用 2 空格缩进
- 键使用双引号
- 文件末尾留空行

---

## 审查流程

提交 PR 后，维护者会：

1. **功能审查**
   - Skill 功能是否符合描述
   - 触发语是否合理
   - 用户体验是否良好

2. **代码审查**
   - 是否符合规范
   - 是否有明显错误
   - 是否可维护

3. **文档审查**
   - README 是否清晰
   - 示例是否完整
   - 安装说明是否准确

审查周期通常为 3-7 天。如有修改建议，请及时更新。

---

## 开发环境

### 推荐工具

- **编辑器**: VS Code, Trae IDE
- **Markdown 预览**: VS Code 内置预览
- **YAML 验证**: yamllint, VS Code YAML 插件
- **JSON 验证**: jsonlint, VS Code JSON 插件

### 本地测试

```bash
# 复制 Skill 到本地 Trae 目录
cp -r SKILLs/your-skill ~/.trae/skills/

# 重启 Trae IDE 测试
```

---

## 社区准则

- **友善**: 尊重所有贡献者
- **耐心**: 审查需要时间
- **开放**: 接受反馈和建议
- **协作**: 共同改进

---

## 许可证

通过提交贡献，你同意你的贡献将采用与项目相同的许可证 [CC BY-NC-SA 4.0](../LICENSE)。

---

## 获取帮助

- 查看 [FAQ](./FAQ.md)
- 加入社区讨论
- 联系维护者

---

感谢你的贡献！🎉
