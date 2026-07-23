# AI 自动续接功能测试指南

## 📋 概述

本文档描述了如何对 fineSTEM 平台的 AI 自动续接功能进行全面自动化测试。

## 🎯 测试范围

### 1. 后端 API 测试
- **文件**: `apps/backend/tests/test_auto_continue_api.py`
- **框架**: pytest + pytest-asyncio + pytest-timeout
- **覆盖**:
  - 截断检测逻辑验证
  - 短代码生成（不触发续接）
  - 长代码生成（触发自动续接）
  - 超长代码生成（可能触发多次续接）

### 2. 前端 E2E 测试
- **文件**: `apps/frontend/tests/specs/ai-auto-continue.spec.ts`
- **框架**: Playwright
- **覆盖**:
  - 长代码生成流程
  - "继续生成"按钮交互
  - 网络中断恢复
  - 代码流入编辑器验证

## 🚀 快速开始

### 环境准备

1. **安装后端依赖**:
```bash
cd apps/backend
pip install -r requirements.txt
pip install pytest pytest-asyncio pytest-timeout
```

2. **安装前端依赖**:
```bash
cd apps/frontend
npm install
npx playwright install
```

3. **启动服务**:
```bash
# 终端 1: 启动后端
cd apps/backend
python -m app.main

# 终端 2: 启动前端
cd apps/frontend
npm run dev
```

### 运行测试

#### 后端测试

```bash
cd apps/backend

# 运行所有自动续接测试
python -m pytest tests/test_auto_continue_api.py -v

# 运行特定测试
python -m pytest tests/test_auto_continue_api.py::TestAutoContinueAPI::test_truncation_detection -v

# 带超时运行
python -m pytest tests/test_auto_continue_api.py -v --timeout=300
```

#### 前端测试

```bash
cd apps/frontend

# 使用 PowerShell 脚本运行（推荐）
.\tests\run-auto-continue-tests.ps1

# 带界面运行（调试用）
.\tests\run-auto-continue-tests.ps1 -Headed

# 运行特定测试
npx playwright test ai-auto-continue.spec.ts -g "长代码生成"

# 调试模式
npx playwright test ai-auto-continue.spec.ts --debug
```

## 📊 测试用例详情

### 后端测试用例

| 用例 ID | 名称 | 描述 | 预期结果 | 超时 |
|---------|------|------|----------|------|
| BAC-001 | 截断检测逻辑 | 验证 `_is_output_truncated` 方法 | 正确识别各种截断情况 | 10s |
| BAC-002 | 短代码生成 | 生成简单函数（阶乘） | 不触发续接，< 1000 tokens | 60s |
| BAC-003 | 长代码自动续接 | 生成贪吃蛇游戏 | 触发续接，完整输出 | 180s |
| BAC-004 | 超长代码多次续接 | 生成 3D 游戏引擎 | 可能触发多次续接 | 600s |

### 前端测试用例

| 用例 ID | 名称 | 描述 | 预期结果 | 超时 |
|---------|------|------|----------|------|
| FEC-001 | 完整长代码生成 | 用户请求生成长代码 | 自动续接或显示按钮 | 180s |
| FEC-002 | 超长代码多次续接 | 生成 3D 游戏引擎 | 正确处理多次续接 | 300s |
| FEC-003 | 网络中断恢复 | 模拟网络中断 | 显示继续按钮，可恢复 | 120s |

## 🔍 关键验证点

### 1. 截断检测
- ✅ 未闭合代码块（``` 数量为奇数）
- ✅ 未闭合 XML/HTML 标签
- ✅ 以编程语言名结尾（python, javascript 等）
- ✅ 正常结束的文本不应误判

### 2. 自动续接
- ✅ 检测到截断后自动触发续接
- ✅ 最多尝试 2 次续接
- ✅ 续接内容无缝拼接
- ✅ 最终输出完整（代码块闭合）

### 3. 前端交互
- ✅ 超时/错误时显示"继续生成"按钮
- ✅ 点击按钮后发送"继续"消息
- ✅ 加载状态正确显示
- ✅ 代码正确流入编辑器

## 📈 性能指标

### 测试通过标准

| 指标 | 通过标准 | 说明 |
|------|----------|------|
| Token 生成速度 | > 50 tokens/秒 | 正常生成速度 |
| 续接延迟 | < 5 秒 | 检测到截断到开始续接 |
| 总耗时（长代码） | < 180 秒 | 包含续接时间 |
| 代码完整性 | 100% | 代码块正确闭合 |

### 实际测试数据（参考）

```
测试场景: 贪吃蛇游戏（长代码）
Token 数量: 3656
内容长度: 14,231 字符
耗时: 141.5 秒
代码块: 3 个（全部闭合）
续接次数: 1 次
```

## 🐛 常见问题排查

### 测试超时

**问题**: 测试超过设定的超时时间

**解决**:
1. 检查网络连接稳定性
2. 增加超时时间：`--timeout=600`
3. 检查 LLM 服务是否正常

### 续接未触发

**问题**: 长代码生成但未触发续接

**排查**:
1. 检查 `orchestrator.py` 日志是否有 `output_truncated_detected`
2. 检查 `active_gateway` 和 `active_model` 是否正确设置
3. 检查超时配置 `ZEROCLAW_TIMEOUT_SECONDS`

### 前端按钮不显示

**问题**: 超时后未显示"继续生成"按钮

**排查**:
1. 检查错误消息是否包含"超时"或"连接"
2. 检查 `showContinueButton` 状态是否正确更新
3. 检查组件是否正确渲染

## 📝 测试报告

测试完成后，报告将生成在：
- **前端**: `apps/frontend/test-results/auto-continue/`
- **后端**: 控制台输出 + pytest-html（如安装）

### 报告内容
- 测试用例执行结果
- 截图证据
- 性能指标
- 错误日志

## 🔄 CI/CD 集成

### GitHub Actions 示例

```yaml
name: AI Auto-Continue Tests

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          cd apps/backend
          pip install -r requirements.txt
          pip install pytest pytest-asyncio pytest-timeout
      - name: Run tests
        run: |
          cd apps/backend
          python -m pytest tests/test_auto_continue_api.py -v --timeout=300

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd apps/frontend
          npm install
          npx playwright install
      - name: Run tests
        run: |
          cd apps/frontend
          npx playwright test ai-auto-continue.spec.ts
```

## 📞 支持

如有问题，请联系：
- 技术负责人: [姓名]
- 测试负责人: [姓名]
- 相关文档: `AUTO_CONTINUE_SOLUTION.md`
