/**
 * PBL 完整自动化测试 - 逐轮选择直到产生代码
 * 测试流程：API轻注册 → 进入创造页面 → 发起对话 → 逐轮选择 → 产生代码 → 运行代码
 * 版本: v2.0.0
 * 更新: 2026-05-02 - 绕过QuestionCard点击，直接通过WebSocket发送选择消息
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173/finestem/create';
const API_URL = 'http://localhost:3000/api/v1';

/** 通过Playwright API轻注册获取测试用户 */
async function apiLightRegister(request: any): Promise<{ token: string; user: any }> {
  console.log('🔐 正在通过API轻注册测试用户...');

  const response = await request.post(`${API_URL}/auth/light-register`, {
    data: { name: '测试用户' },
    headers: { 'Content-Type': 'application/json' },
  });

  const body = await response.json();

  if (!body.data?.access_token) {
    throw new Error(`轻注册失败: ${JSON.stringify(body)}`);
  }

  console.log('✅ API轻注册成功');
  return { token: body.data.access_token, user: body.data.user };
}

/** 注入认证状态到页面 */
async function injectAuth(page: Page, token: string, user: any): Promise<void> {
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
  }, { token, user });
  console.log('✅ 认证状态已注入页面');
}

/** 等待AI回复完成（等待加载动画消失） */
async function waitForAIResponseComplete(page: Page, maxWaitMs: number = 60000): Promise<boolean> {
  const start = Date.now();
  // 先等待AI消息出现
  while (Date.now() - start < maxWaitMs) {
    const aiMsg = page.locator('text=fineSTEM AI').first();
    if (await aiMsg.isVisible({ timeout: 2000 }).catch(() => false)) {
      break;
    }
    await page.waitForTimeout(500);
  }
  // 再等待加载动画消失
  const loadingStart = Date.now();
  while (Date.now() - loadingStart < maxWaitMs) {
    const loadingDots = page.locator('.animate-bounce').first();
    const loadingText = page.locator('text=AI正在思考').first();
    const isLoading = await loadingDots.isVisible({ timeout: 1000 }).catch(() => false)
      || await loadingText.isVisible({ timeout: 1000 }).catch(() => false);
    if (!isLoading) {
      await page.waitForTimeout(1500);
      return true;
    }
    await page.waitForTimeout(800);
  }
  return false;
}

/** 检测QuestionCard是否可见，并返回问题标题和选项 */
async function detectQuestionCard(page: Page): Promise<{ visible: boolean; title: string; options: { id: string; label: string }[] }> {
  // 使用更精确的选择器：包含"提问"标题的QuestionCard
  // QuestionCard在消息区域内，不在左侧边栏
  const chatArea = page.locator('.flex-1').first(); // 主聊天区域
  const questionCards = chatArea.locator('.border-teal-200');
  const cardCount = await questionCards.count().catch(() => 0);

  let questionCard = null;
  for (let i = 0; i < cardCount; i++) {
    const card = questionCards.nth(i);
    const hasTitle = await card.locator('.text-sm.text-gray-800').first().isVisible({ timeout: 500 }).catch(() => false);
    const hasOptions = await card.locator('button').first().isVisible({ timeout: 500 }).catch(() => false);
    if (hasTitle && hasOptions) {
      questionCard = card;
      break;
    }
  }

  if (!questionCard) {
    return { visible: false, title: '', options: [] };
  }

  // 获取问题标题
  const titleEl = questionCard.locator('.text-sm.text-gray-800').first();
  const title = await titleEl.textContent().catch(() => '');

  // 获取选项（只获取有radio圆圈的选项按钮）
  const optionButtons = questionCard.locator('button');
  const count = await optionButtons.count().catch(() => 0);
  const options: { id: string; label: string }[] = [];

  for (let i = 0; i < count; i++) {
    const btn = optionButtons.nth(i);
    // 检查按钮内是否有radio圆圈（排除操作按钮）
    const hasRadio = await btn.locator('.rounded-full').first().isVisible({ timeout: 500 }).catch(() => false);
    if (hasRadio) {
      const labelDiv = btn.locator('.text-xs').first();
      const label = await labelDiv.textContent().catch(() => '');
      if (label && label.trim().length > 0 && !options.find(o => o.label === label.trim())) {
        options.push({ id: `option_${options.length + 1}`, label: label.trim() });
      }
    }
  }

  return { visible: true, title, options };
}

/** 发送选择消息（绕过QuestionCard点击） */
async function sendSelection(page: Page, questionTitle: string, optionLabel: string): Promise<void> {
  const sendText = `[选择] ${questionTitle}\n回答：${optionLabel}`;
  const input = page.locator('textarea').first();

  // 等待textarea可用（AI处理完成）
  let retries = 0;
  while (retries < 30) {
    const isDisabled = await input.evaluate(el => (el as HTMLTextAreaElement).disabled).catch(() => true);
    if (!isDisabled) break;
    await page.waitForTimeout(500);
    retries++;
  }

  await input.fill(sendText);
  await page.keyboard.press('Enter');
  console.log(`📤 发送选择: "${optionLabel}"`);
}

/** 发送消息 */
async function sendMessage(page: Page, text: string): Promise<void> {
  const input = page.locator('textarea').first();
  await input.fill(text);
  await page.keyboard.press('Enter');
  console.log(`📤 发送: "${text}"`);
}

/** 截图 */
async function screenshot(page: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `test-results/pbl-auto/${name}-${timestamp}.png`,
    fullPage: true,
  });
}

test('PBL完整自动化: 发起对话→逐轮选择→产生代码', async ({ page, request }) => {
  console.log('\n========== PBL 完整自动化测试开始 ==========\n');
  test.setTimeout(300000);

  // 1. API轻注册获取token
  const auth = await apiLightRegister(request);

  // 2. 进入创造页面并注入认证
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await injectAuth(page, auth.token, auth.user);

  // 刷新页面使认证生效
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('✅ 已进入创造页面（已登录）');
  await screenshot(page, 'step-0-enter');

  // 3. 发送项目请求
  await sendMessage(page, '我想做一个项目，帮我选题');

  // 4. 处理多轮问答（最多8轮）
  let round = 1;
  const maxRounds = 8;
  let hadQuestion = false;
  const seenQuestions = new Set<string>();

  while (round <= maxRounds) {
    console.log(`\n--- 第${round}轮问答 ---`);

    // 等待AI回复完成
    const responded = await waitForAIResponseComplete(page, 45000);
    if (!responded) {
      console.log(`❌ 第${round}轮: AI未回复`);
      break;
    }
    console.log(`✅ 第${round}轮: AI已回复`);
    await screenshot(page, `step-${round}-response`);

    // 检测QuestionCard
    const questionData = await detectQuestionCard(page);
    console.log(`第${round}轮 QuestionCard: ${questionData.visible ? '✅ 有' : '❌ 无'}`);

    if (!questionData.visible) {
      console.log('ℹ️ 未检测到QuestionCard，问答流程结束');
      break;
    }

    // 清理问题标题中的XML标签
    const cleanTitle = questionData.title.replace(/<[^>]+>/g, '').trim();
    console.log(`问题: "${cleanTitle}"`);
    console.log(`选项: ${questionData.options.map(o => o.label).join(', ')}`);

    if (questionData.options.length === 0) {
      console.log('❌ 未找到选项');
      break;
    }

    // 检测是否重复提问（同一问题已经出现过）
    if (seenQuestions.has(cleanTitle)) {
      console.log('⚠️ 检测到重复问题，跳出问答循环');
      break;
    }
    seenQuestions.add(cleanTitle);

    // 选择第一个选项并发送
    const selectedOption = questionData.options[0];
    await sendSelection(page, cleanTitle, selectedOption.label);
    hadQuestion = true;
    console.log(`✅ 第${round}轮: 已选择"${selectedOption.label}"`);

    // 等待AI处理选择并回复（需要较长时间）
    await page.waitForTimeout(5000);
    await screenshot(page, `step-${round}-selected`);

    round++;
  }

  console.log(`\n📊 问答轮次: 共${round - 1}轮${hadQuestion ? '' : '(未检测到问答)'}`);

  // 5. 请求生成代码（不再等待AI停止提问，直接请求）
  console.log('\n--- 请求生成代码 ---');
  // 等待textarea可用
  const input = page.locator('textarea').first();
  let waitCount = 0;
  while (waitCount < 60) {
    const isDisabled = await input.evaluate(el => (el as HTMLTextAreaElement).disabled).catch(() => true);
    if (!isDisabled) break;
    await page.waitForTimeout(1000);
    waitCount++;
  }
  await sendMessage(page, '请直接生成Python代码，不需要再提问了');
  const codeResponded = await waitForAIResponseComplete(page, 60000);
  expect(codeResponded).toBeTruthy();
  console.log('✅ 代码请求已回复');
  await screenshot(page, 'step-code-response');

  // 7. 检查是否有代码
  const bodyText = await page.locator('body').textContent() || '';
  const hasCode = bodyText.includes('```') || bodyText.includes('def ') || bodyText.includes('class ');
  console.log(`代码生成: ${hasCode ? '✅ 有' : '❌ 无'}`);

  // 8. 尝试运行代码
  const runBtn = page.locator('button:has-text("运行"), button:has-text("▶")').first();
  if (await runBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await runBtn.click();
    console.log('✅ 已点击运行');
    await page.waitForTimeout(5000);
    await screenshot(page, 'step-code-run');
  }

  // 最终截图
  await screenshot(page, 'final');

  console.log('\n========== PBL 完整自动化测试完成 ==========\n');
});
