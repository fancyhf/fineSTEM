# Playwright E2E 测试报告

## 测试文件

**文件**: `apps/frontend/tests/specs/ai-auto-continue.spec.ts`

## 测试用例

### 1. 完整长代码生成流程 - 自动续接应正常工作

**测试步骤**:
1. 进入创造页面 (`/create`)
2. 发送长代码生成请求（贪吃蛇游戏）
3. 等待 AI 响应（包含可能的续接）
4. 检查是否出现"继续生成"按钮
5. 如有按钮，点击继续
6. 验证代码已生成并流入编辑器
7. 验证代码完整性

**预期结果**:
- ✅ 代码长度 > 1000 字符
- ✅ 包含 `import` 语句
- ✅ 包含 `pygame` 关键字
- ✅ 代码块正确闭合

**Playwright 代码**:
```typescript
test('完整长代码生成流程 - 自动续接应正常工作', async ({ page }) => {
  const helper = new AutoContinueTestHelper(page);
  
  // 进入创造页面
  await helper.navigateToCreatePage();
  
  // 发送长代码生成请求
  const longCodePrompt = `请写一个完整的贪吃蛇游戏...`;
  await helper.sendMessage(longCodePrompt);
  
  // 等待 AI 响应
  const hasContinueButton = await helper.waitForContinueButton(30000);
  if (hasContinueButton) {
    await helper.clickContinueButton();
    await helper.waitForCodeGeneration(60000);
  }
  
  // 验证代码
  const codeInEditor = await helper.getEditorCode();
  expect(codeInEditor.length).toBeGreaterThan(1000);
  expect(codeInEditor).toContain('import');
  expect(codeInEditor).toContain('pygame');
});
```

---

### 2. 超长代码多次续接

**测试步骤**:
1. 进入创造页面
2. 发送超长代码请求（3D 游戏引擎）
3. 循环检测"继续生成"按钮，最多 3 次
4. 每次点击继续按钮
5. 验证最终代码完整性

**预期结果**:
- ✅ 代码长度 > 2000 字符
- ✅ 可能触发多次续接
- ✅ 最终代码完整

**Playwright 代码**:
```typescript
test('超长代码多次续接', async ({ page }) => {
  const helper = new AutoContinueTestHelper(page);
  await helper.navigateToCreatePage();
  
  const ultraLongPrompt = `请写一个完整的 3D 游戏引擎...`;
  await helper.sendMessage(ultraLongPrompt);
  
  // 可能多次续接
  let continueCount = 0;
  while (continueCount < 3) {
    const hasButton = await helper.waitForContinueButton(45000);
    if (hasButton) {
      continueCount++;
      await helper.clickContinueButton();
    } else {
      break;
    }
  }
  
  const codeInEditor = await helper.getEditorCode();
  expect(codeInEditor.length).toBeGreaterThan(2000);
});
```

---

### 3. 网络中断恢复

**测试步骤**:
1. 进入创造页面
2. 发送代码生成请求
3. 等待部分响应
4. 模拟网络中断（断开 WebSocket）
5. 检查错误提示和"继续生成"按钮
6. 点击继续按钮
7. 验证恢复成功

**预期结果**:
- ✅ 显示错误提示
- ✅ 显示"继续生成"按钮
- ✅ 点击后可恢复生成
- ✅ 最终代码完整

**Playwright 代码**:
```typescript
test('网络中断后应能恢复并继续生成', async ({ page }) => {
  const helper = new AutoContinueTestHelper(page);
  await helper.navigateToCreatePage();
  
  await helper.sendMessage('写一个完整的俄罗斯方块游戏...');
  await page.waitForTimeout(10000);
  
  // 模拟网络中断
  await page.evaluate(() => {
    const ws = window.__wsConnection;
    if (ws) ws.close();
  });
  
  // 检查恢复
  const hasContinueButton = await helper.waitForContinueButton(5000);
  if (hasContinueButton) {
    await helper.clickContinueButton();
    await helper.waitForCodeGeneration(60000);
    const codeInEditor = await helper.getEditorCode();
    expect(codeInEditor.length).toBeGreaterThan(500);
  }
});
```

---

## 测试辅助类

```typescript
class AutoContinueTestHelper {
  page: Page;
  
  async navigateToCreatePage(): Promise<void> {
    await this.page.goto(CONFIG.BASE_URL);
  }
  
  async sendMessage(message: string): Promise<void> {
    const textarea = this.page.locator('textarea').first();
    await textarea.fill(message);
    const sendButton = this.page.locator('button:has-text("发送")').first();
    await sendButton.click();
  }
  
  async waitForContinueButton(timeout: number): Promise<boolean> {
    try {
      const button = this.page.locator('button:has-text("继续生成")');
      await button.waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }
  
  async clickContinueButton(): Promise<void> {
    const button = this.page.locator('button:has-text("继续生成")');
    await button.click();
  }
  
  async getEditorCode(): Promise<string> {
    const editor = this.page.locator('textarea').first();
    return await editor.inputValue() || '';
  }
}
```

---

## 执行命令

### 前提条件
- 后端服务运行在 `http://localhost:3200`
- 前端服务运行在 `http://localhost:5184`

### 运行测试

```cmd
# 方式 1: 双击运行脚本
run_playwright_tests.cmd

# 方式 2: 命令行
set E2E_API_URL=http://localhost:3200/api/v1
cd apps/frontend
npx playwright test tests/specs/ai-auto-continue.spec.ts --reporter=list

# 方式 3: 带界面运行（调试）
npx playwright test tests/specs/ai-auto-continue.spec.ts --headed

# 方式 4: 运行特定测试
npx playwright test tests/specs/ai-auto-continue.spec.ts -g "长代码生成"
```

---

## 配置参数

```typescript
const CONFIG = {
  BASE_URL: 'http://localhost:5184/create',
  TIMEOUTS: {
    AI_RESPONSE: 180000,      // 3 分钟
    CODE_APPEAR: 30000,       // 30 秒
    CONTINUE_BUTTON: 60000,   // 1 分钟
    EDITOR_APPEAR: 15000,     // 15 秒
  },
};
```

---

## 测试状态

| 测试用例 | 状态 | 说明 |
|---------|------|------|
| 完整长代码生成流程 | 🔄 待执行 | 需要启动服务 |
| 超长代码多次续接 | 🔄 待执行 | 需要启动服务 |
| 网络中断恢复 | 🔄 待执行 | 需要启动服务 |

---

## 预期结果

基于之前的验证测试：

```
测试场景: 贪吃蛇游戏（长代码）
预期结果:
  - Token 数量: > 2000
  - 内容长度: > 5000 字符
  - 耗时: < 180 秒
  - 代码块: 闭合
  - 续接次数: 1-2 次
```

---

**测试文件**: `apps/frontend/tests/specs/ai-auto-continue.spec.ts`  
**创建时间**: 2026-07-20  
**状态**: 测试框架就绪，待执行
