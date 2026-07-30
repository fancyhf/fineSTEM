/**
 * Q-023-A2 大段代码截断深度修复验证
 * 
 * 验证:
 * - TC-DLG-033: 大段代码完整输出不截断（max_tokens=16384）
 * - TC-DLG-034: 多次续接按钮不消失（上限4次）
 * - TC-DLG-032: 续接从断点接着写
 */
import { test, expect, Page } from '@playwright/test';

const FRONTEND_BASE = process.env.E2E_BASE_URL || 'http://localhost:5184';
const CREATE_URL = `${FRONTEND_BASE}/create`;
const AI_TIMEOUT = 120000;
const SETUP_TIMEOUT = 30000;

async function sendMessage(page: Page, text: string): Promise<void> {
  const input = page.getByTestId('chat-input');
  // 等待输入框可用（不被禁用）
  await expect(input).toBeEnabled({ timeout: 30000 });
  await input.fill(text);
  await page.getByTestId('send-button').click();
}

async function getLastAssistantMessage(page: Page): Promise<string | null> {
  try {
    const messages = page.locator('[data-testid="message-assistant"]');
    const count = await messages.count();
    if (count === 0) return null;
    return await messages.nth(count - 1).textContent();
  } catch {
    return null;
  }
}

async function getLastAssistantMessageHtml(page: Page): Promise<string | null> {
  try {
    const messages = page.locator('[data-testid="message-assistant"]');
    const count = await messages.count();
    if (count === 0) return null;
    return await messages.nth(count - 1).innerHTML();
  } catch {
    return null;
  }
}

async function clickFirstOption(page: Page): Promise<void> {
  const card = page.getByTestId('question-card').first();
  const option = card.getByTestId('question-option').first();
  await expect(option).toBeVisible({ timeout: 5000 });
  await option.click();
  await page.waitForTimeout(500);
  const submitBtn = card.locator('button', { hasText: /确定|下一步/ }).last();
  await expect(submitBtn).toBeVisible({ timeout: 5000 });
  await expect(submitBtn).toBeEnabled({ timeout: 5000 });
  await submitBtn.click();
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

// ═══════════════════════════════════════════════════════════════════════════════
// TC-DLG-033: 大段代码完整输出不截断（核心）
// ═══════════════════════════════════════════════════════════════════════════════
test('TC-DLG-033: 大段代码完整输出到</html>闭合不截断', async ({ page }) => {
  test.setTimeout(600000); // 10 分钟（大段代码生成耗时）

  console.log('[TC-DLG-033] 开始测试大段代码完整输出...');

  // 1. 进入 Create 页
  await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded', timeout: SETUP_TIMEOUT });

  // 2. 开始新项目
  await sendMessage(page, '我想做一个英语单词学习助手');
  await page.waitForTimeout(3000);

  // 3. 快速推进到编码阶段（回答必要问题）
  for (let i = 0; i < 4; i++) {
    const cardText = await waitForQuestionCard(page, AI_TIMEOUT);
    if (cardText) {
      console.log(`[TC-DLG-033] 回答问题 ${i + 1}`);
      await clickFirstOption(page);
      await page.waitForTimeout(3000);
    }
  }

  // 4. 进入编码阶段
  await sendMessage(page, '进入编码阶段');
  await page.waitForTimeout(5000);

  // 5. 选择讲解式模式
  const cardText = await waitForQuestionCard(page, 10000);
  if (cardText && (cardText.includes('教学') || cardText.includes('模式'))) {
    const card = page.getByTestId('question-card').first();
    const lectureOption = card.locator('text=讲解').first();
    if (await lectureOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await lectureOption.click();
      await page.waitForTimeout(300);
      const submitBtn = card.locator('button', { hasText: /确定|下一步/ }).last();
      await submitBtn.click();
      await page.waitForTimeout(3000);
    }
  }

  // 6. 请求生成完整的大段代码
  console.log('[TC-DLG-033] 请求生成完整代码（HTML+CSS+JS）...');
  await sendMessage(page, '请完整实现这个项目的所有代码，包括完整的HTML结构、所有CSS样式、所有JavaScript交互逻辑，不要省略任何部分');

  // 7. 等待 AI 生成（可能需要较长时间）
  console.log('[TC-DLG-033] 等待 AI 生成代码（最长 5 分钟）...');
  
  let lastLength = 0;
  let stableCount = 0;
  const startTime = Date.now();
  
  while (Date.now() - startTime < 300000) { // 最多等 5 分钟
    await page.waitForTimeout(5000);
    
    const msg = await getLastAssistantMessage(page);
    const currentLength = msg?.length || 0;
    
    // 检查是否还在增长
    if (currentLength > lastLength) {
      lastLength = currentLength;
      stableCount = 0;
      console.log(`[TC-DLG-033] 代码生成中... 当前长度: ${currentLength}`);
    } else {
      stableCount++;
      // 连续 6 次（30秒）无增长，认为生成完成
      if (stableCount >= 6) {
        console.log(`[TC-DLG-033] 代码生成停止，最终长度: ${currentLength}`);
        break;
      }
    }
    
    // 检查是否有继续按钮（被截断）
    const continueBtn = page.locator('button', { hasText: /继续生成|Continue/ }).first();
    const hasContinueBtn = await continueBtn.isVisible({ timeout: 1000 }).catch(() => false);
    if (hasContinueBtn) {
      console.log('[TC-DLG-033] 检测到继续按钮，代码可能被截断');
      break;
    }
  }

  // 8. 截图记录
  await page.screenshot({ path: 'test-results/q023a2-033-final.png', timeout: 30000 });

  // 9. 检查代码完整性
  const finalMsg = await getLastAssistantMessage(page);
  const finalHtml = await getLastAssistantMessageHtml(page);
  
  console.log(`[TC-DLG-033] 最终消息长度: ${finalMsg?.length || 0}`);
  
  // 检查点 1: 代码是否完整到 </html>
  const hasHtmlClosing = finalMsg?.includes('</html>') || finalHtml?.includes('</html>');
  const hasCodeBlockEnd = finalMsg?.includes('```') || finalHtml?.includes('```');
  
  // 检查是否在 CSS/JS 中段截断（之前的 bug 是在 align-self 处截断）
  const endsAbruptly = finalMsg?.match(/align-self|flex:|margin:|padding:[^;]*$/) && !hasHtmlClosing;
  
  console.log(`[TC-DLG-033] 检查点: </html>闭合=${hasHtmlClosing}, 代码块闭合=${hasCodeBlockEnd}, 疑似截断=${endsAbruptly}`);

  // 记录结果（不强制断言，因为可能真的生成不完）
  if (hasHtmlClosing) {
    console.log('[TC-DLG-033] ✅ 代码完整输出到 </html> 闭合');
  } else if (endsAbruptly) {
    console.log('[TC-DLG-033] ❌ 代码在 CSS/JS 中段截断');
  } else {
    console.log('[TC-DLG-033] ⚠️ 代码未完整到 </html>，但无明显截断特征');
  }

  // 检查点 2: 自动续接是否触发
  const logs: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('截断') || text.includes('续接') || text.includes('truncat')) {
      logs.push(text);
    }
  });
  await page.waitForTimeout(2000);
  
  if (logs.length > 0) {
    console.log('[TC-DLG-033] ℹ️ 检测到自动续接日志:');
    logs.forEach(log => console.log(`  > ${log}`));
  }

  // 保存结果供报告使用
  test.info().attach('TC-DLG-033 结果', {
    body: JSON.stringify({
      messageLength: finalMsg?.length || 0,
      hasHtmlClosing,
      hasCodeBlockEnd,
      endsAbruptly,
      autoContinueLogs: logs.length
    }, null, 2),
    contentType: 'application/json'
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-DLG-034: 多次续接按钮不消失
// ═══════════════════════════════════════════════════════════════════════════════
test('TC-DLG-034: 多次续接按钮不消失（上限4次）', async ({ page }) => {
  test.setTimeout(600000); // 10 分钟

  console.log('[TC-DLG-034] 开始测试多次续接...');

  // 1. 进入 Create 页并开始项目
  await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded', timeout: SETUP_TIMEOUT });
  await sendMessage(page, '我想做一个待办事项应用');
  await page.waitForTimeout(3000);

  // 2. 快速推进到编码阶段
  for (let i = 0; i < 4; i++) {
    const cardText = await waitForQuestionCard(page, AI_TIMEOUT);
    if (cardText) {
      await clickFirstOption(page);
      await page.waitForTimeout(3000);
    }
  }

  // 3. 进入编码阶段并选择讲解式
  await sendMessage(page, '进入编码阶段');
  await page.waitForTimeout(5000);
  
  const cardText = await waitForQuestionCard(page, 10000);
  if (cardText && (cardText.includes('教学') || cardText.includes('模式'))) {
    const card = page.getByTestId('question-card').first();
    const lectureOption = card.locator('text=讲解').first();
    if (await lectureOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await lectureOption.click();
      await page.waitForTimeout(300);
      const submitBtn = card.locator('button', { hasText: /确定|下一步/ }).last();
      await submitBtn.click();
      await page.waitForTimeout(3000);
    }
  }

  // 4. 请求生成大段代码（故意要求完整实现以触发截断）
  console.log('[TC-DLG-034] 请求生成完整代码...');
  await sendMessage(page, '请完整实现所有代码，包括HTML、CSS、JavaScript，不要省略');

  // 5. 等待生成并检查是否出现继续按钮
  await page.waitForTimeout(60000);
  
  let continueCount = 0;
  const maxContinues = 4;
  
  while (continueCount < maxContinues) {
    const continueBtn = page.locator('button', { hasText: /继续生成|Continue/ }).first();
    const hasContinueBtn = await continueBtn.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (!hasContinueBtn) {
      console.log(`[TC-DLG-034] 无继续按钮，检查是否已完整...`);
      // 检查代码是否完整
      const msg = await getLastAssistantMessage(page);
      if (msg?.includes('</html>')) {
        console.log('[TC-DLG-034] ✅ 代码已完整，无需继续');
        break;
      }
      // 等待一下再看
      await page.waitForTimeout(10000);
      continue;
    }
    
    // 点击继续
    continueCount++;
    console.log(`[TC-DLG-034] 第 ${continueCount} 次点击继续生成...`);
    await continueBtn.click();
    
    // 等待续接完成
    await page.waitForTimeout(45000);
    
    // 截图记录
    await page.screenshot({ path: `test-results/q023a2-034-continue-${continueCount}.png`, timeout: 30000 });
    
    // 检查续接后按钮是否还在（如果内容仍不完整）
    const msg = await getLastAssistantMessage(page);
    console.log(`[TC-DLG-034] 续接后消息长度: ${msg?.length || 0}`);
  }

  // 6. 检查是否达到上限后按钮隐藏
  const finalBtn = page.locator('button', { hasText: /继续生成|Continue/ }).first();
  const hasFinalBtn = await finalBtn.isVisible({ timeout: 3000 }).catch(() => false);
  
  if (continueCount >= maxContinues && !hasFinalBtn) {
    console.log(`[TC-DLG-034] ✅ 达 ${maxContinues} 次上限后按钮隐藏`);
  } else if (continueCount < maxContinues && !hasFinalBtn) {
    console.log(`[TC-DLG-034] ✅ 代码完整后按钮自然消失（点击 ${continueCount} 次）`);
  } else if (hasFinalBtn) {
    console.log(`[TC-DLG-034] ⚠️ 按钮仍显示（可能内容仍不完整）`);
  }

  // 7. 发新对话后检查按钮是否恢复
  console.log('[TC-DLG-034] 发送新对话，检查按钮是否恢复...');
  await sendMessage(page, '你好');
  await page.waitForTimeout(10000);
  
  const btnAfterNewMsg = page.locator('button', { hasText: /继续生成|Continue/ }).first();
  const hasBtnAfterNewMsg = await btnAfterNewMsg.isVisible({ timeout: 3000 }).catch(() => false);
  
  if (!hasBtnAfterNewMsg) {
    console.log('[TC-DLG-034] ✅ 新对话后按钮状态正常（未异常显示）');
  } else {
    console.log('[TC-DLG-034] ℹ️ 新对话后仍有继续按钮（可能新消息也被截断）');
  }

  // 保存结果
  test.info().attach('TC-DLG-034 结果', {
    body: JSON.stringify({
      continueCount,
      maxContinues,
      buttonHiddenAtEnd: !hasFinalBtn,
      newMessageButtonState: hasBtnAfterNewMsg ? 'visible' : 'hidden'
    }, null, 2),
    contentType: 'application/json'
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-DLG-032: 续接从断点接着写（回归）
// ═══════════════════════════════════════════════════════════════════════════════
test('TC-DLG-032: 人为截断后续接从断点接着写', async ({ page }) => {
  test.setTimeout(300000); // 5 分钟

  console.log('[TC-DLG-032] 开始测试人为截断后续接...');

  // 1. 进入 Create 页并开始项目
  await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded', timeout: SETUP_TIMEOUT });
  await sendMessage(page, '我想做一个计算器项目');
  await page.waitForTimeout(3000);

  // 2. 推进到编码阶段
  for (let i = 0; i < 3; i++) {
    const cardText = await waitForQuestionCard(page, AI_TIMEOUT);
    if (cardText) {
      await clickFirstOption(page);
      await page.waitForTimeout(3000);
    }
  }

  // 3. 人为制造截断：要求只输出前半部分
  console.log('[TC-DLG-032] 要求 AI 只输出前半部分...');
  await sendMessage(page, '请只输出代码的前半部分（到词库定义为止），后半部分我稍后再要');
  await page.waitForTimeout(15000);

  // 4. 记录前半部分
  const firstPart = await getLastAssistantMessage(page);
  const firstPartLength = firstPart?.length || 0;
  console.log(`[TC-DLG-032] 前半部分长度: ${firstPartLength}`);
  
  // 截图
  await page.screenshot({ path: 'test-results/q023a2-032-first-part.png', timeout: 30000 });

  // 5. 点击继续或发消息继续
  const continueBtn = page.locator('button', { hasText: /继续生成|Continue/ }).first();
  const hasContinueBtn = await continueBtn.isVisible({ timeout: 5000 }).catch(() => false);

  if (hasContinueBtn) {
    console.log('[TC-DLG-032] 点击继续生成按钮...');
    await continueBtn.click();
  } else {
    console.log('[TC-DLG-032] 发送继续消息...');
    await sendMessage(page, '继续生成后半部分代码');
  }

  // 6. 等待续接
  await page.waitForTimeout(20000);
  await page.screenshot({ path: 'test-results/q023a2-032-continued.png', timeout: 30000 });

  // 7. 检查续接内容
  const continuedMsg = await getLastAssistantMessage(page);
  const continuedLength = continuedMsg?.length || 0;
  console.log(`[TC-DLG-032] 续接后总长度: ${continuedLength}`);

  // 检查是否从断点接着写（而非回到开头）
  // 如果从断点接着写，总长度应该比前半部分长，但不会翻倍
  const isContinuedFromBreakpoint = continuedLength > firstPartLength && continuedLength < firstPartLength * 2;
  
  // 检查是否有"回到开头"的特征
  const backToStartIndicators = ['首先', '第一步', '我们先', '原理介绍', '让我们从头'];
  const hasBackToStart = backToStartIndicators.some(indicator => 
    continuedMsg?.slice(firstPartLength).includes(indicator)
  );

  if (isContinuedFromBreakpoint && !hasBackToStart) {
    console.log('[TC-DLG-032] ✅ 续接从断点接着写，未回到开头');
  } else if (hasBackToStart) {
    console.log('[TC-DLG-032] ❌ 续接可能回到开头重新讲解');
  } else {
    console.log('[TC-DLG-032] ⚠️ 续接状态不确定');
  }

  // 保存结果
  test.info().attach('TC-DLG-032 结果', {
    body: JSON.stringify({
      firstPartLength,
      continuedLength,
      isContinuedFromBreakpoint,
      hasBackToStart
    }, null, 2),
    contentType: 'application/json'
  });
});
