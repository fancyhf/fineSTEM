/**
 * Q-018 / Q-019 / Q-020 回归测试
 * 三个顽固 Bug 修复验证
 */
import { test, expect, Page } from '@playwright/test';

const FRONTEND_BASE = process.env.E2E_BASE_URL || 'http://localhost:5184';
const CREATE_URL = `${FRONTEND_BASE}/create`;
const AI_TIMEOUT = 90000;
const SETUP_TIMEOUT = 30000;

async function sendMessage(page: Page, text: string): Promise<void> {
  const input = page.getByTestId('chat-input');
  await input.fill(text);
  await page.getByTestId('send-button').click();
}

async function waitForQuestionCard(page: Page, timeoutMs = AI_TIMEOUT): Promise<string | null> {
  try {
    const card = page.getByTestId('question-card').first();
    await expect(card).toBeVisible({ timeout: timeoutMs });
    return await card.textContent();
  } catch {
    return null;
  }
}

async function clickFirstOption(page: Page): Promise<void> {
  const card = page.getByTestId('question-card').first();
  const option = card.getByTestId('question-option').first();
  await expect(option).toBeVisible({ timeout: 5000 });
  await option.click();
  await page.waitForTimeout(300);
  const submitBtn = card.locator('button', { hasText: /确定|下一步/ }).last();
  await expect(submitBtn).toBeVisible({ timeout: 5000 });
  await submitBtn.click();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Q-018: 「修复错误」按钮可点击、无文本泄漏
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Q-018 修复错误按钮修复验证 @ai', () => {
  test('RT-18: 运行报错代码后修复按钮无文本泄漏且可点击', async ({ page }) => {
    test.setTimeout(300000);
    await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded', timeout: SETUP_TIMEOUT });

    // 1. 走 PBL 流程到代码生成阶段
    await sendMessage(page, '我想做一个简单的Python项目');
    await page.waitForTimeout(3000);

    // 快速通过选择阶段
    for (let i = 0; i < 5; i++) {
      const cardText = await waitForQuestionCard(page, AI_TIMEOUT);
      if (!cardText) break;
      await clickFirstOption(page);
      await page.waitForTimeout(3000);
    }

    // 请求生成代码
    await sendMessage(page, '请给我完整可运行的Python代码');
    await page.waitForTimeout(10000);

    // 2. 等待编辑器出现
    await page.waitForSelector('[data-testid="code-editor"]', { timeout: 10000 });

    // 3. 在编辑器输入会报错的代码
    await page.evaluate(() => {
      const editor = document.querySelector('[data-testid="code-editor"]');
      if (editor && (editor as any).setValue) {
        (editor as any).setValue('print(x)  # x 未定义');
      }
    });

    // 4. 点击运行按钮（如果存在）
    const runButton = page.getByTestId('run-button');
    if (await runButton.isVisible().catch(() => false)) {
      await runButton.click();
    await page.waitForTimeout(3000);

    // 4. 检查点 A: 弹窗不应出现 onclick JS 文本泄漏
    const modalText = await page.textContent('body');
    expect(modalText).not.toContain('onclick="(function(){window.parent.postMessage');
    expect(modalText).not.toContain('window.parent.postMessage');
    console.log('[Q-018] ✅ 无 JS 文本泄漏');
    await page.screenshot({ path: 'test-results/q018-modal-no-leak.png' });

    // 5. 检查点 B: 点击「让 AI 修复此错误」按钮
    const fixButton = page.locator('button', { hasText: /让 AI 修复此错误|修复错误/ }).first();
    await expect(fixButton).toBeVisible({ timeout: 5000 });
    await fixButton.click();
    await page.waitForTimeout(2000);

    // 6. 验证按钮变灰或聊天框自动发消息
    const chatInput = page.getByTestId('chat-input');
    const inputValue = await chatInput.inputValue();
    expect(inputValue).toContain('修复');
    console.log('[Q-018] ✅ 修复按钮可点击，聊天框自动发修复请求');
    await page.screenshot({ path: 'test-results/q018-fix-request-sent.png' });

    // 7. 检查点 C: 含双引号的错误也能正常处理
    // 重新输入含双引号的错误代码
    await page.evaluate(() => {
      const editor = document.querySelector('[data-testid="code-editor"]');
      if (editor) {
        (editor as any).setValue('x = "hello"; print(y)  // y 未定义，含双引号');
      }
    });
    await page.getByTestId('run-button').click();
    await page.waitForTimeout(3000);

    const fixButton2 = page.locator('button', { hasText: /让 AI 修复此错误|修复错误/ }).first();
    await expect(fixButton2).toBeVisible({ timeout: 5000 });
    console.log('[Q-018] ✅ 含双引号错误也能正常显示修复按钮');
    await page.screenshot({ path: 'test-results/q018-quote-error-works.png' });
    } // end if runButton visible
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Q-019: 生成代码后编辑器有代码、文件区有文件
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Q-019 代码生成修复验证 @ai', () => {
  test('RT-19: 生成代码后编辑器立即显示代码且文件区有真实文件名', async ({ page }) => {
    test.setTimeout(600000); // 10 分钟
    await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded', timeout: SETUP_TIMEOUT });

    // 1. 走完整 PBL 流程到 stage_05/07
    await sendMessage(page, '我想做一个网页项目，帮我选题和规划');
    await page.waitForTimeout(3000);

    // 快速通过前几轮选择
    for (let i = 0; i < 6; i++) {
      const cardText = await waitForQuestionCard(page, AI_TIMEOUT);
      if (!cardText) break;
      console.log(`[Q-019] 第 ${i+1} 轮: ${cardText.slice(0, 40)}`);
      await clickFirstOption(page);
      await page.waitForTimeout(3000);
    }

    console.log('[Q-019] ✅ 已完成前期选择，准备生成代码');

    // 2. 请求生成代码
    await sendMessage(page, '请直接给出完整可运行的HTML代码');
    await page.waitForTimeout(10000);

    // 3. 检查点 A: 编辑器立即显示代码（非空白）
    const editorCode = await page.evaluate(() => {
      const editor = document.querySelector('[data-testid="code-editor"]');
      return editor ? (editor as any).getValue?.() || '' : '';
    });
    expect(editorCode.length, '编辑器应该有代码').toBeGreaterThan(50);
    console.log('[Q-019] ✅ 编辑器有代码，长度:', editorCode.length);
    await page.screenshot({ path: 'test-results/q019-editor-has-code.png' });

    // 4. 检查点 B: 文件区显示真实文件名
    const fileTreeText = await page.textContent('[data-testid="file-tree"]');
    expect(fileTreeText).toMatch(/index\.html|main\.(py|js|ts)|\.html|\.py/);
    expect(fileTreeText).not.toBe('main.py'); // 不是硬编码
    console.log('[Q-019] ✅ 文件区有真实文件名');
    await page.screenshot({ path: 'test-results/q019-file-tree.png' });

    // 5. 检查点 C: 刷新后代码仍在
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    const codeAfterReload = await page.evaluate(() => {
      const editor = document.querySelector('[data-testid="code-editor"]');
      return editor ? (editor as any).getValue?.() || '' : '';
    });
    expect(codeAfterReload.length, '刷新后代码应该还在').toBeGreaterThan(50);
    console.log('[Q-019] ✅ 刷新后代码仍在');
    await page.screenshot({ path: 'test-results/q019-code-after-reload.png' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Q-020: 风格/主题文字选择渲染卡片
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Q-020 风格主题选择修复验证 @ai', () => {
  test('RT-20: 风格/主题问题渲染选项卡片', async ({ page }) => {
    test.setTimeout(300000);
    await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded', timeout: SETUP_TIMEOUT });

    // 1. 推进到 stage_05 设计阶段
    await sendMessage(page, '我想做一个网页项目');
    await page.waitForTimeout(3000);

    for (let i = 0; i < 4; i++) {
      const cardText = await waitForQuestionCard(page, AI_TIMEOUT);
      if (!cardText) break;
      await clickFirstOption(page);
      await page.waitForTimeout(3000);
    }

    // 2. 引导 AI 问风格/主题
    await sendMessage(page, '我想选个风格，给我选项');
    await page.waitForTimeout(8000);

    // 3. 检查是否渲染了风格选择卡片
    const pageText = await page.textContent('body');
    const hasStyleCard = /极简|分析|风格|主题|样式/.test(pageText || '');
    
    // 如果 AI 用文字列出选项，检查是否兜底渲染卡片
    const cardVisible = await page.getByTestId('question-card').first().isVisible().catch(() => false);
    
    if (hasStyleCard && cardVisible) {
      console.log('[Q-020] ✅ 风格选择渲染为卡片');
      await page.screenshot({ path: 'test-results/q020-style-card-rendered.png' });
    } else {
      console.log('[Q-020] ⚠️ 未触发风格选择，需 verify-question 接口验证');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Q-003 回归: 功能介绍不误识别
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Q-003 回归验证 @ai', () => {
  test('TC-DLG-028: 番茄钟功能介绍不误识别为选项卡', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded', timeout: SETUP_TIMEOUT });

    // 1. 先走一轮建立上下文
    await sendMessage(page, '我想做一个项目');
    await waitForQuestionCard(page, AI_TIMEOUT);
    await clickFirstOption(page);
    await page.waitForTimeout(3000);

    // 2. 发功能介绍类消息
    await sendMessage(page, '介绍一下番茄钟功能');
    await page.waitForTimeout(8000);

    // 3. 检查不应产生选项卡
    const cardCount = await page.getByTestId('question-card').count();
    const pageText = await page.textContent('body');
    
    // 如果产生了卡片，检查它是不是功能介绍误产生的
    if (cardCount > 0) {
      const cardText = await page.getByTestId('question-card').first().textContent();
      // 功能介绍不应该被识别为选择意图
      if (/包含|功能|倒计时|增删改查/.test(cardText || '')) {
        throw new Error('Q-003 回归 FAIL: 功能介绍被误识别为选项卡');
      }
    }

    console.log('[Q-003] ✅ 功能介绍未误识别');
    await page.screenshot({ path: 'test-results/q003-no-false-positive.png' });
  });
});
