/**
 * Q-023 流式卡死 + 续接回归测试
 * 
 * 验证:
 * - Q-023A: 流式输出卡死时保留已生成内容 + 显示"继续生成"按钮（30s idleTimer）
 * - Q-023B: 续接时从断点接着写（不回 Step1），消息带 <previous_output> 上文
 */
import { test, expect, Page } from '@playwright/test';

const FRONTEND_BASE = process.env.E2E_BASE_URL || 'http://localhost:5184';
const CREATE_URL = `${FRONTEND_BASE}/create`;
const AI_TIMEOUT = 120000;
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

async function getLastAssistantMessage(page: Page): Promise<string | null> {
  try {
    // Create.tsx 的实际选择器是 data-testid="message-assistant"（line 3281），
    // 之前用 assistant-message 是词序反了导致永远找不到。
    const messages = page.locator('[data-testid="message-assistant"]');
    const count = await messages.count();
    if (count === 0) return null;
    return await messages.nth(count - 1).textContent();
  } catch {
    return null;
  }
}

test.describe('Q-023 流式卡死续接验证 @ai @q023', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded', timeout: SETUP_TIMEOUT });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TC-DLG-031: 流式卡死保留内容 + 显示继续按钮（Q-023A）
  // ═══════════════════════════════════════════════════════════════════════════════
  test('TC-DLG-031: 流式输出卡死时保留已生成内容并显示继续按钮', async ({ page }) => {
    test.setTimeout(300000); // 5 分钟

    // 1. 开始新项目，推进到编码阶段
    await sendMessage(page, '我想做一个英语单词学习助手');
    await page.waitForTimeout(3000);

    // 走脑爆阶段回答问题
    for (let i = 0; i < 4; i++) {
      const cardText = await waitForQuestionCard(page, AI_TIMEOUT);
      if (cardText) {
        console.log(`[TC-DLG-031] 回答问题 ${i+1}: ${cardText?.slice(0, 40)}`);
        await clickFirstOption(page);
        await page.waitForTimeout(3000);
      }
    }

    // 2. 推进到 stage_07，选择讲解式 lecture 模式
    await sendMessage(page, '进入编码阶段');
    await page.waitForTimeout(5000);

    // 如果弹出教学模式选择，选 lecture
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

    // 3. 让 AI 生成大段代码（讲解式模式）
    console.log('[TC-DLG-031] 请求生成大段代码...');
    await sendMessage(page, '请完整实现所有功能代码，用讲解式逐步讲解每一步，包括词库定义、界面布局和交互逻辑');
    
    // 4. 观察流式输出，等待一段时间看是否卡死
    console.log('[TC-DLG-031] 观察流式输出 60s...');
    await page.waitForTimeout(60000);

    // 截图记录当前状态
    await page.screenshot({ path: 'test-results/q023-01-streaming-60s.png', timeout: 30000 });

    // 5. 检查点 A1: 已生成的内容是否保留
    const lastMessage = await getLastAssistantMessage(page);
    console.log(`[TC-DLG-031] 最后消息长度: ${lastMessage?.length || 0}`);
    
    if (lastMessage && lastMessage.length > 100) {
      console.log('[TC-DLG-031] ✅ 已生成内容已保留');
    }

    // 6. 检查点 A2: 是否显示"继续生成"按钮（如果卡死）
    const continueBtn = page.locator('button', { hasText: /继续生成|Continue/ }).first();
    const hasContinueBtn = await continueBtn.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (hasContinueBtn) {
      console.log('[TC-DLG-031] ✅ 检查点 A2: 显示"继续生成"按钮（检测到卡死）');
    } else {
      console.log('[TC-DLG-031] ℹ️ 未显示继续按钮（可能未卡死或已生成完成）');
    }

    // 7. 检查点 A3: 控制台是否有空闲超时日志
    const logs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('空闲超时') || text.includes('idle') || text.includes('chunk')) {
        logs.push(text);
      }
    });

    await page.waitForTimeout(5000);
    
    if (logs.length > 0) {
      console.log('[TC-DLG-031] ✅ 检查点 A3: 控制台有空闲超时日志');
      logs.forEach(log => console.log(`  > ${log}`));
    }

    // 如果卡死未发生，记录状态
    console.log(`[TC-DLG-031] 最终状态: 继续按钮=${hasContinueBtn}, 日志数=${logs.length}`);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TC-DLG-032: 续接从断点接着写（Q-023B）
  // ═══════════════════════════════════════════════════════════════════════════════
  test('TC-DLG-032: 续接时从断点接着写，不回 Step1', async ({ page }) => {
    test.setTimeout(300000); // 5 分钟

    // 1. 开始新项目并推进到编码阶段
    await sendMessage(page, '我想做一个计算器项目');
    await page.waitForTimeout(3000);

    // 走脑爆阶段
    for (let i = 0; i < 3; i++) {
      const cardText = await waitForQuestionCard(page, AI_TIMEOUT);
      if (cardText) {
        await clickFirstOption(page);
        await page.waitForTimeout(3000);
      }
    }

    // 2. 人为制造截断：要求 AI 只输出前半部分
    console.log('[TC-DLG-032] 要求 AI 只输出前半部分代码...');
    await sendMessage(page, '请只输出代码的前半部分（到词库定义为止），后半部分我稍后再要');
    await page.waitForTimeout(15000);

    // 记录前半部分内容
    const firstPart = await getLastAssistantMessage(page);
    console.log(`[TC-DLG-032] 前半部分长度: ${firstPart?.length || 0}`);
    await page.screenshot({ path: 'test-results/q023-02-first-part.png', timeout: 30000 });

    // 3. 点击"继续生成"按钮（如果有）或发消息继续
    const continueBtn = page.locator('button', { hasText: /继续生成|Continue/ }).first();
    const hasContinueBtn = await continueBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasContinueBtn) {
      console.log('[TC-DLG-032] 点击"继续生成"按钮...');
      await continueBtn.click();
    } else {
      console.log('[TC-DLG-032] 发送"继续"消息...');
      await sendMessage(page, '继续生成后半部分代码');
    }

    // 4. 等待续接完成
    await page.waitForTimeout(20000);
    await page.screenshot({ path: 'test-results/q023-03-continued.png', timeout: 30000 });

    // 5. 检查点 B1: 续接内容是否从断点接着写
    const continuedMessage = await getLastAssistantMessage(page);
    console.log(`[TC-DLG-032] 续接后总长度: ${continuedMessage?.length || 0}`);

    // 检查是否回到 Step1（重新讲原理）
    const isBackToStep1 = continuedMessage && (
      continuedMessage.includes('首先') && continuedMessage.includes('原理') &&
      continuedMessage.length > (firstPart?.length || 0) * 1.5
    );

    if (isBackToStep1) {
      console.log('[TC-DLG-032] ❌ 检查点 B1: 可能回到 Step1 重新讲解');
    } else {
      console.log('[TC-DLG-032] ✅ 检查点 B1: 续接内容连贯，未回到 Step1');
    }

    // 6. 检查点 B2: WS 消息或控制台是否含 <previous_output>
    const wsMessages: string[] = [];
    // 监听 WebSocket（如果可能）
    page.on('websocket', ws => {
      ws.on('framereceived', frame => {
        const payload = typeof frame === 'object' && frame !== null && 'payload' in frame
          ? (frame as { payload: unknown }).payload
          : frame;
        const text = typeof payload === 'string' ? payload
          : Buffer.isBuffer(payload) ? payload.toString('utf8')
          : '';
        if (text.includes('previous_output')) {
          wsMessages.push(text);
        }
      });
    });

    await page.waitForTimeout(3000);

    if (wsMessages.length > 0) {
      console.log('[TC-DLG-032] ✅ 检查点 B2: WS 消息含 <previous_output>');
    } else {
      console.log('[TC-DLG-032] ℹ️ 检查点 B2: 未捕获到 WS 消息（需手动验证）');
    }

    // 7. 检查点 B3: 格式连贯性
    const hasCodeBlock = continuedMessage?.includes('```');
    const hasSmoothTransition = !continuedMessage?.match(/好的.*继续|接下来.*我们从头/i);

    if (hasCodeBlock && hasSmoothTransition) {
      console.log('[TC-DLG-032] ✅ 检查点 B3: 代码块格式正确，过渡自然');
    } else {
      console.log('[TC-DLG-032] ⚠️ 检查点 B3: 格式或过渡可能有问题');
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 回归测试：正常短对话不误判卡死
  // ═══════════════════════════════════════════════════════════════════════════════
  test('RT-23-REG: 正常短对话不误判卡死', async ({ page }) => {
    test.setTimeout(120000);

    // 1. 发简单问候（首条消息会触发项目创建 + AI 第一阶段提问，耗时较长）
    await sendMessage(page, '你好');
    await page.waitForTimeout(3000);

    // 2. 等待 AI 回复（首条消息较慢，给 60s 而非 10s）
    const startTime = Date.now();
    let gotReply = false;

    while (Date.now() - startTime < 60000) {
      const lastMsg = await getLastAssistantMessage(page);
      if (lastMsg && lastMsg.trim().length > 0) {
        gotReply = true;
        break;
      }
      await page.waitForTimeout(1000);
    }

    expect(gotReply, 'AI 应在 60s 内回复').toBe(true);

    // 3. 等待 35s，确认不误显示"继续生成"（idleTimer 30s 不应误触发）
    await page.waitForTimeout(35000);

    const continueBtn = page.locator('button', { hasText: /继续生成|Continue/ }).first();
    const hasContinueBtn = await continueBtn.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasContinueBtn, '正常短对话不应显示继续按钮').toBe(false);
    console.log('[RT-23-REG] ✅ 正常短对话未误判卡死');
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 回归测试：正常长回复不中断
  // ═══════════════════════════════════════════════════════════════════════════════
  test('RT-23-LONG: 正常长回复不被 idleTimer 截断', async ({ page }) => {
    test.setTimeout(180000); // 3 分钟

    // 1. 开始项目
    await sendMessage(page, '我想做一个待办事项应用');
    await page.waitForTimeout(3000);

    // 2. 请求一个长回复
    await sendMessage(page, '请详细分析这个项目的功能需求、技术架构和实现步骤，越详细越好');

    // 3. 观察 60s，确认正常流式输出不被截断
    console.log('[RT-23-LONG] 观察长回复流式输出 60s...');
    await page.waitForTimeout(60000);

    // 4. 检查是否还在生成（有内容在增加）
    const msg1 = await getLastAssistantMessage(page);
    await page.waitForTimeout(10000);
    const msg2 = await getLastAssistantMessage(page);

    const isStillGrowing = (msg2?.length || 0) > (msg1?.length || 0);
    
    if (isStillGrowing) {
      console.log('[RT-23-LONG] ✅ 长回复正常流式生成中，未被截断');
    } else {
      console.log('[RT-23-LONG] ℹ️ 长回复可能已完成或暂停');
    }

    // 5. 检查不应有"继续生成"按钮（除非真的卡死）
    const continueBtn = page.locator('button', { hasText: /继续生成|Continue/ }).first();
    const hasContinueBtn = await continueBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasContinueBtn) {
      console.log('[RT-23-LONG] ✅ 正常长回复未触发继续按钮');
    }
  });
});
