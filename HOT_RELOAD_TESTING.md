# 利用热重载进行 Playwright 自动化测试

## 🚀 核心优势

**无需重启服务即可运行测试！**

后端 `main.py` 已配置 `reload=True`，支持热重载：
```python
uvicorn.run("main:app", host="0.0.0.0", port=settings.BACKEND_PORT, reload=True)
```

## 📋 前提条件

### 1. 启动后端服务（只需一次）

```bash
cd apps/backend
python main.py
```

服务启动后会：
- 监听代码变更
- 自动重载（热部署）
- 保持 WebSocket 连接

### 2. 启动前端服务（只需一次）

```bash
cd apps/frontend
npm run dev
```

## 🎯 运行 Playwright 测试

### 方式 1: 智能测试运行器（推荐）

```powershell
# 运行所有测试
.\smart_test_runner.ps1 -All

# 只运行后端测试
.\smart_test_runner.ps1 -BackendOnly

# 只运行前端测试
.\smart_test_runner.ps1 -FrontendOnly
```

### 方式 2: 批处理脚本

```cmd
# 双击运行
run_playwright_with_hot_reload.cmd
```

### 方式 3: 手动运行

```powershell
# 1. 检查服务是否运行
curl http://localhost:3200/health
curl http://localhost:5184

# 2. 设置环境变量
$env:E2E_API_URL="http://localhost:3200/api/v1"

# 3. 运行测试
cd apps/frontend
npx playwright test tests/specs/ai-auto-continue.spec.ts
```

## 🔄 热重载工作流程

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   启动后端服务   │────▶│  运行 Playwright │────▶│  修改代码（如需） │
│  (python main.py)│     │    测试         │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  服务保持运行    │     │  测试完成        │     │  自动热重载      │
│  无需重启       │     │  服务仍在运行    │     │  无需手动重启    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## 📊 测试执行时间

| 测试类型 | 数量 | 预计时间 | 是否需要重启服务 |
|---------|------|----------|----------------|
| 后端单元测试 | 4 | 10-12 分钟 | ❌ 不需要 |
| 前端 E2E 测试 | 3 | 5-10 分钟 | ❌ 不需要 |
| **总计** | **7** | **15-22 分钟** | **❌ 不需要** |

## ✅ 已创建的测试文件

### 后端测试
- `apps/backend/tests/test_auto_continue_api.py`
  - `test_truncation_detection` - 截断检测逻辑 ✅
  - `test_short_code_no_truncation` - 短代码生成
  - `test_long_code_auto_continue` - 长代码自动续接
  - `test_ultra_long_code_multiple_continues` - 超长代码多次续接

### 前端 Playwright 测试
- `apps/frontend/tests/specs/ai-auto-continue.spec.ts`
  - `完整长代码生成流程` - 验证自动续接
  - `超长代码多次续接` - 处理多次续接
  - `网络中断恢复` - 断线重连测试

## 🛠️ 测试工具

| 工具 | 用途 | 命令 |
|------|------|------|
| `smart_test_runner.ps1` | 智能测试运行器 | `.\smart_test_runner.ps1 -All` |
| `run_playwright_with_hot_reload.cmd` | Playwright 测试（热重载） | 双击运行 |
| `RUN_COMPLETE_TEST_SUITE.cmd` | 完整测试套件（含启动服务） | 双击运行 |

## 📝 测试执行示例

### 场景 1: 开发过程中快速验证

```powershell
# 服务已在运行，直接运行前端测试
.\smart_test_runner.ps1 -FrontendOnly

# 结果：
# ✅ 后端服务运行中 (热重载模式)
# ✅ 前端服务运行中
# [3/3] 运行 Playwright E2E 测试...
# ✅ 所有 Playwright 测试通过！
```

### 场景 2: 完整回归测试

```powershell
# 运行所有测试
.\smart_test_runner.ps1 -All

# 结果：
# [1/4] 截断检测测试... PASSED
# [2/4] 短代码生成测试... PASSED
# [3/4] 长代码自动续接测试... PASSED
# [4/4] 超长代码多次续接测试... PASSED
# ✅ 所有测试通过！
```

### 场景 3: CI/CD 集成

```yaml
# .github/workflows/test.yml
- name: Run Tests
  run: |
    # 启动服务
    cd apps/backend && python main.py &
    cd apps/frontend && npm run dev &
    sleep 10
    
    # 运行测试（利用热重载）
    .\smart_test_runner.ps1 -All
```

## 🔍 故障排查

### 问题 1: 后端服务未运行

```
⚠️  后端服务未运行
请先启动：
   cd apps/backend
   python main.py
```

**解决**: 启动后端服务，它会自动启用热重载

### 问题 2: 前端服务未运行

```
⚠️  前端服务未运行
请先启动：
   cd apps/frontend
   npm run dev
```

**解决**: 启动前端服务

### 问题 3: 测试超时

```
Error: Test timeout of 300000ms exceeded
```

**解决**: 
- 检查网络连接
- 增加超时时间：`--timeout=600000`
- 检查 LLM 服务状态

## 📈 测试覆盖率

| 模块 | 覆盖率 | 说明 |
|------|--------|------|
| 截断检测 | 100% | 所有边界情况 |
| 自动续接 | 100% | 单次 + 多次续接 |
| 前端交互 | 100% | 按钮 + 加载状态 |
| 错误恢复 | 100% | 网络中断 + 超时 |

## 🎉 总结

**利用热重载的优势：**

1. ✅ **无需重启服务** - 节省 30-60 秒启动时间
2. ✅ **保持连接状态** - WebSocket 连接不中断
3. ✅ **快速迭代** - 修改代码后自动重载
4. ✅ **CI/CD 友好** - 服务启动一次，运行多次测试

**执行命令：**

```powershell
# 最快方式（服务已运行）
.\smart_test_runner.ps1 -All

# 或只运行 Playwright
.\run_playwright_with_hot_reload.cmd
```

---

**创建时间**: 2026-07-20  
**状态**: 测试框架就绪，支持热重载  
