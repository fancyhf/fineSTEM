/**
 * Q-017 AI失忆修复验证测试
 * 核心场景：刷新后 AI 不重复问已答问题
 */
import { test, expect, Page } from '@playwright/test';

const FRONTEND_BASE = process.env.E2E_BASE_URL || 'http://localhost:5185';
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
  // 点"确定"/"下一步"按钮提交答案
  const submitBtn = card.locator('button', { hasText: /确定|下一步/ }).last();
  await expect(submitBtn).toBeVisible({ timeout: 5000 });
  await submitBtn.click();
}

test.describe('Q-017 AI失忆修复验证 @ai', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded', timeout: SETUP_TIMEOUT });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TC-DLG-029: 刷新后不失忆（核心场景）
  // ═══════════════════════════════════════════════════════════════════════════════
  test('TC-DLG-029: 刷新页面后 AI 不重复问已答问题', async ({ page }) => {
    test.setTimeout(600000); // 10 分钟

    // 1. 开始新项目
    await sendMessage(page, '我想做一个项目，帮我选题和规划');
    await page.waitForTimeout(3000);

    // 2. 走完 stage_00 + stage_01 脑爆：选年级、选兴趣、选方向、选选题（共 4 次选择）
    const selections = ['年级', '兴趣', '方向', '选题'];
    for (let i = 0; i < 4; i++) {
      const cardText = await waitForQuestionCard(page, AI_TIMEOUT);
      expect(cardText, `第 ${i+1} 轮（${selections[i]}）应该显示选项卡`).not.toBeNull();
      console.log(`[TC-DLG-029] 选择 ${selections[i]}: ${cardText?.slice(0, 40)}`);
      await page.screenshot({ path: `test-results/q017-selection-${i+1}.png`, timeout: 30000 }).catch(() => {});
      await clickFirstOption(page);
      await page.waitForTimeout(3000);
    }

    console.log('[TC-DLG-029] ✅ 已完成 4 次选择（年级/兴趣/方向/选题）');

    // 3. 选完后立刻刷新页面（F5）
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    console.log('[TC-DLG-029] ✅ 页面已刷新');
    await page.screenshot({ path: 'test-results/q017-after-reload.png' });

    // 4. 检查 Network：GET /workspace 响应里 progress.student_profile 非空
    // 先等待页面完全加载，可能触发 /workspace 请求
    await page.waitForTimeout(3000);
    
    // 如果没有自动触发，手动调用 /workspace
    const workspaceResponse = await page.evaluate(async () => {
      const res = await fetch('/api/v1/projects/current/workspace');
      return res.json();
    });
    const workspaceData = workspaceResponse;
    console.log('[TC-DLG-029] Workspace 响应:', JSON.stringify(workspaceData.data?.student_profile, null, 2));
    
    // 断言：student_profile 应该存在且非空
    expect(workspaceData.data?.student_profile, '刷新后 student_profile 应该存在').toBeTruthy();
    expect(Object.keys(workspaceData.data?.student_profile || {}).length, 'student_profile 应该有内容').toBeGreaterThan(0);
    console.log('[TC-DLG-029] ✅ 刷新后 student_profile 已恢复');

    // 5. 继续发消息
    await sendMessage(page, '继续');
    await page.waitForTimeout(8000);
    await page.screenshot({ path: 'test-results/q017-after-continue.png' });

    // 6. 断言：AI 不重复问年级/兴趣/方向/选题
    const pageText = await page.textContent('body');
    const repeatedQuestions = [
      /你是哪个年级/,
      /你现在是哪个年级/,
      /你对什么感兴趣/,
      /你的兴趣/,
      /你想做什么方向/,
      /项目方向/,
      /你想做什么项目/,
      /选择.*项目/,
    ];

    for (const pattern of repeatedQuestions) {
      if (pattern.test(pageText || '')) {
        throw new Error(`Q-017 FAIL: AI 重复提问 "${pattern.source}"，失忆未修复`);
      }
    }

    console.log('[TC-DLG-029] ✅ AI 没有重复提问，失忆修复验证通过');
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 补充场景：切标签不失忆
  // ═══════════════════════════════════════════════════════════════════════════════
  test('切标签页后 AI 不重复问已答问题', async ({ page, context }) => {
    test.setTimeout(300000); // 5 分钟

    // 1. 开始新项目并走完脑爆选 4 项
    await sendMessage(page, '我想做一个项目，帮我选题和规划');
    await page.waitForTimeout(3000);

    for (let i = 0; i < 4; i++) {
      const cardText = await waitForQuestionCard(page, AI_TIMEOUT);
      expect(cardText, `第 ${i+1} 轮应该显示选项卡`).not.toBeNull();
      await clickFirstOption(page);
      await page.waitForTimeout(3000);
    }

    console.log('[切标签测试] ✅ 已完成 4 次选择');

    // 2. 切到其他标签页停 2 秒
    const newPage = await context.newPage();
    await newPage.goto('about:blank');
    await page.waitForTimeout(2000);

    // 3. 切回原标签页
    await page.bringToFront();
    await page.waitForTimeout(2000);
    console.log('[切标签测试] ✅ 已切回原标签页');
    await page.screenshot({ path: 'test-results/q017-tab-switch-back.png' });

    // 4. 发消息
    await sendMessage(page, '下一步');
    await page.waitForTimeout(8000);
    await page.screenshot({ path: 'test-results/q017-tab-switch-after-msg.png' });

    // 5. 断言：AI 不重复问
    const pageText = await page.textContent('body');
    const repeatedPatterns = [/你是哪个年级/, /你对什么感兴趣/, /你想做什么方向/, /你想做什么项目/];
    
    for (const pattern of repeatedPatterns) {
      if (pattern.test(pageText || '')) {
        throw new Error(`Q-017 FAIL: 切标签后 AI 重复提问 "${pattern.source}"`);
      }
    }

    console.log('[切标签测试] ✅ 切标签后 AI 没有重复提问');
  });
});
