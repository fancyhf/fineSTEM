/**
 * Q-016 对话落库验证（2026-07-28）
 *
 * 验证对话内容可靠落库的 4 个互补措施：
 *   1. messagesRef + saveChatNow（可靠保存函数）
 *   2. 项目创建后补存（ensureProjectCreated → saveChatNow）
 *   3. 页面离开强制保存（visibilitychange / pagehide）
 *   4. 流式结束强制保存（handleSend finally → setTimeout saveChatNow）
 *
 * 跑法（必须有头）：
 *   set RUN_AI_E2E=1
 *   cd apps/frontend
 *   npx playwright test q016-chat-persistence --project=chromium --headed --video=retain-on-failure --screenshot=on
 *
 * 前置条件：
 * - ZeroClaw daemon 运行在 127.0.0.1:42617
 * - 后端 API 运行在 localhost:3200
 * - 前端 dev server 运行在 localhost:5184
 *
 * links: .trae/documents/问题清单_长期维护.md (Q-016)
 *        .trae/documents/testing/plans/对话系统回归测试计划_v1.0.0.md (RT-16)
 */
import { test, expect, Page } from '@playwright/test';

const FRONTEND_BASE = process.env.E2E_BASE_URL || 'http://localhost:5184';
const API_BASE = process.env.E2E_API_URL || 'http://localhost:3200/api/v1';
const CREATE_URL = `${FRONTEND_BASE}/create`;

const AI_TIMEOUT = 120000; // AI 响应超时 2 分钟
const SETUP_TIMEOUT = 30000;

// ── 工具函数 ──

/**
 * 发送消息并等待 AI 回复完成（等 loading 消失或新卡片出现）。
 */
async function sendMessage(page: Page, text: string): Promise<void> {
  const input = page.getByTestId('chat-input');
  await input.fill(text);
  await page.getByTestId('send-button').click();
}

/**
 * 等待 question-card 出现并返回其文本内容。
 */
async function waitForQuestionCard(page: Page, timeoutMs = AI_TIMEOUT): Promise<string | null> {
  try {
    const card = page.getByTestId('question-card').first();
    await expect(card).toBeVisible({ timeout: timeoutMs });
    return await card.textContent();
  } catch {
    return null;
  }
}

/**
 * 点击 question-card 的第一个选项并提交。
 */
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

/**
 * 等待 AI 回复完成（loading 状态消失）。
 */
async function waitForAIResponse(page: Page, timeoutMs = AI_TIMEOUT): Promise<void> {
  // 等 loading 出现（发送后立即出现）
  await page.waitForTimeout(500);
  // 等 loading 消失（AI 回复完成）
  await page.waitForFunction(
    () => {
      const sendBtn = document.querySelector('[data-testid="send-button"]') as HTMLButtonElement;
      return sendBtn && !sendBtn.disabled;
    },
    { timeout: timeoutMs },
  ).catch(() => {});
  // 额外等待一下让消息渲染完成
  await page.waitForTimeout(1000);
}

/**
 * 获取当前页面上的消息数量。
 */
async function getMessageCount(page: Page): Promise<number> {
  return await page.getByTestId(/message-(user|assistant)/).count();
}

/**
 * 注册测试用户并获取 token。
 */
async function registerAndLogin(page: Page): Promise<{ token: string; userId: string; email: string }> {
  const email = `e2e_q016_${Date.now()}@finestem.test`;
  const password = 'E2eTest123!';
  const name = `Q016测试学生`;

  const resp = await page.request.post(`${API_BASE}/auth/register`, {
    data: { name, email, password },
  });
  if (!resp.ok()) {
    throw new Error(`注册失败 (${resp.status()}): ${await resp.text()}`);
  }
  const body = await resp.json();
  const token = body.data.access_token;
  const userId = body.data.user.id;

  // 通过 UI 登录
  await page.goto(`${FRONTEND_BASE}/login`, { waitUntil: 'domcontentloaded', timeout: SETUP_TIMEOUT });
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(explore|dashboard|research)/, { timeout: 15000 }).catch(() => {});

  return { token, userId, email };
}

/**
 * 通过 API 获取项目的 chat_saved_at。
 */
async function getChatSavedAt(page: Page, token: string, projectId: string): Promise<{ saved_at: string | null; message_count: number }> {
  const resp = await page.request.get(`${API_BASE}/projects/${projectId}/chat`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok()) {
    return { saved_at: null, message_count: 0 };
  }
  const body = await resp.json();
  return {
    saved_at: body.data?.saved_at || null,
    message_count: body.data?.message_count || 0,
  };
}

/**
 * 设置项目 ID 拦截器，捕获从 API 响应中的项目 ID。
 */
function setupProjectIdInterceptor(page: Page): { getProjectId: () => string | null } {
  let capturedProjectId: string | null = null;

  page.on('response', async (response) => {
    const url = response.url();
    // 拦截 POST /api/v1/projects（创建项目）
    if (url.includes('/api/v1/projects') && response.request().method() === 'POST' && !capturedProjectId) {
      try {
        const body = await response.json();
        if (body?.data?.id) {
          capturedProjectId = body.data.id;
          console.log('[Q-016] 捕获到项目 ID:', capturedProjectId);
        }
      } catch {}
    }
    // 也拦截 POST /api/v1/projects/{id}/chat（保存对话时 URL 包含项目 ID）
    if (url.includes('/api/v1/projects/') && url.includes('/chat') && response.request().method() === 'POST') {
      const match = url.match(/\/projects\/([^/]+)\/chat/);
      if (match && !capturedProjectId) {
        capturedProjectId = match[1];
        console.log('[Q-016] 从 chat 保存请求捕获到项目 ID:', capturedProjectId);
      }
    }
  });

  return {
    getProjectId: () => capturedProjectId,
  };
}

// ── 测试用例 ──

test.describe('Q-016 对话落库验证 @ai', () => {
  test.describe.configure({ timeout: 600000 }); // 10 分钟总超时

  test('场景1：聊 3-4 轮后刷新→对话完整恢复 + chat_saved_at 有值', async ({ page }) => {
    test.setTimeout(600000); // 10 分钟
    const { token } = await registerAndLogin(page);
    const projectIdTracker = setupProjectIdInterceptor(page);

    // 1. 导航到 create 页
    await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded', timeout: SETUP_TIMEOUT });
    await page.screenshot({ path: 'test-results/q016-sc1-start.png' });

    // 2. 发送"我想做一个项目"
    await sendMessage(page, '我想做一个项目');
    await page.screenshot({ path: 'test-results/q016-sc1-after-send.png' });

    // 3. 等待第 1 张选项卡
    const card1 = await waitForQuestionCard(page, AI_TIMEOUT);
    expect(card1, '第 1 轮应出现选项卡').not.toBeNull();
    console.log('[Q-016 场景1] 轮1卡片:', card1!.slice(0, 60));
    await page.screenshot({ path: 'test-results/q016-sc1-round1.png' });

    // 4. 点选项进入第 2 轮
    await clickFirstOption(page);
    const card2 = await waitForQuestionCard(page, AI_TIMEOUT);
    expect(card2, '第 2 轮应出现选项卡').not.toBeNull();
    console.log('[Q-016 场景1] 轮2卡片:', card2!.slice(0, 60));
    await page.screenshot({ path: 'test-results/q016-sc1-round2.png' });

    // 5. 点选项进入第 3 轮
    await clickFirstOption(page);
    const card3 = await waitForQuestionCard(page, AI_TIMEOUT);
    // 第 3 轮可能没有卡片（AI 可能用文字回复），只要有回复就行
    await waitForAIResponse(page, AI_TIMEOUT);
    await page.screenshot({ path: 'test-results/q016-sc1-round3.png' });

    // 6. 记录刷新前的消息数
    const msgCountBefore = await getMessageCount(page);
    console.log('[Q-016 场景1] 刷新前消息数:', msgCountBefore);
    expect(msgCountBefore, '至少应有 4 条消息（2 user + 2 assistant）').toBeGreaterThanOrEqual(4);

    // 7. 获取项目 ID
    const projectId = projectIdTracker.getProjectId();
    console.log('[Q-016 场景1] 项目 ID:', projectId);
    expect(projectId, '项目应该已创建').not.toBeNull();

    // 8. 等一下让 saveChatNow 完成
    await page.waitForTimeout(2000);

    // 9. 通过 API 验证 chat_saved_at 有值
    const chatInfo = await getChatSavedAt(page, token, projectId!);
    console.log('[Q-016 场景1] chat_saved_at:', chatInfo.saved_at, '消息数:', chatInfo.message_count);
    expect(chatInfo.saved_at, 'chat_saved_at 应有值（对话已落库）').not.toBeNull();
    expect(chatInfo.message_count, '后端消息数应 ≥ 4').toBeGreaterThanOrEqual(4);

    // 10. 刷新页面
    await page.reload({ waitUntil: 'domcontentloaded', timeout: SETUP_TIMEOUT });
    await page.waitForTimeout(3000); // 等恢复逻辑完成

    // 11. 在侧边栏点击项目恢复对话
    // 项目名包含"我想做一个项目"的前 20 个字符
    const projectLink = page.locator('text=我想做一个项目').first();
    if (await projectLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await projectLink.click();
      await page.waitForTimeout(3000); // 等恢复完成
    } else {
      // 尝试点击侧边栏中包含项目名的元素
      const sidebarItem = page.locator(`[class*="truncate"]:has-text("我想做一个项目")`).first();
      if (await sidebarItem.isVisible({ timeout: 5000 }).catch(() => false)) {
        await sidebarItem.click();
        await page.waitForTimeout(3000);
      }
    }

    await page.screenshot({ path: 'test-results/q016-sc1-after-refresh.png' });

    // 12. 验证对话恢复
    const msgCountAfter = await getMessageCount(page);
    console.log('[Q-016 场景1] 刷新后消息数:', msgCountAfter);
    expect(msgCountAfter, '刷新后消息数应 ≥ 刷新前（对话已恢复）').toBeGreaterThanOrEqual(msgCountBefore);
  });

  test('场景2：聊 2 轮→切标签页 2 秒→切回刷新→对话恢复', async ({ page }) => {
    test.setTimeout(600000);
    const { token } = await registerAndLogin(page);
    const projectIdTracker = setupProjectIdInterceptor(page);

    await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded', timeout: SETUP_TIMEOUT });
    await page.screenshot({ path: 'test-results/q016-sc2-start.png' });

    // 聊 2 轮
    await sendMessage(page, '我想做一个项目');
    const card1 = await waitForQuestionCard(page, AI_TIMEOUT);
    expect(card1, '第 1 轮应出现选项卡').not.toBeNull();
    console.log('[Q-016 场景2] 轮1卡片:', card1!.slice(0, 60));

    await clickFirstOption(page);
    const card2 = await waitForQuestionCard(page, AI_TIMEOUT);
    expect(card2, '第 2 轮应出现选项卡').not.toBeNull();
    console.log('[Q-016 场景2] 轮2卡片:', card2!.slice(0, 60));

    const msgCountBefore = await getMessageCount(page);
    console.log('[Q-016 场景2] 切标签前消息数:', msgCountBefore);

    const projectId = projectIdTracker.getProjectId();
    expect(projectId, '项目应该已创建').not.toBeNull();

    // 切到新标签页（模拟 visibilitychange）
    const newPage = await page.context().newPage();
    await newPage.goto('about:blank');
    await page.waitForTimeout(2000); // 停 2 秒

    // 切回
    await page.bringToFront();
    await newPage.close();
    await page.waitForTimeout(500);

    // 刷新
    await page.reload({ waitUntil: 'domcontentloaded', timeout: SETUP_TIMEOUT });
    await page.waitForTimeout(3000);

    // 通过 API 验证 chat_saved_at
    const chatInfo = await getChatSavedAt(page, token, projectId!);
    console.log('[Q-016 场景2] chat_saved_at:', chatInfo.saved_at, '消息数:', chatInfo.message_count);
    expect(chatInfo.saved_at, 'chat_saved_at 应有值（visibilitychange 触发了保存）').not.toBeNull();
    expect(chatInfo.message_count, '后端消息数应 ≥ 4').toBeGreaterThanOrEqual(4);

    // 恢复项目
    const projectLink = page.locator('text=我想做一个项目').first();
    if (await projectLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await projectLink.click();
      await page.waitForTimeout(3000);
    }

    await page.screenshot({ path: 'test-results/q016-sc2-after-refresh.png' });

    const msgCountAfter = await getMessageCount(page);
    console.log('[Q-016 场景2] 刷新后消息数:', msgCountAfter);
    expect(msgCountAfter, '刷新后消息数应 ≥ 刷新前').toBeGreaterThanOrEqual(msgCountBefore);
  });

  test('场景3：发 1 条等 AI 回复完→立刻刷新→验证这轮已保存', async ({ page }) => {
    test.setTimeout(600000);
    const { token } = await registerAndLogin(page);
    const projectIdTracker = setupProjectIdInterceptor(page);

    await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded', timeout: SETUP_TIMEOUT });
    await page.screenshot({ path: 'test-results/q016-sc3-start.png' });

    // 发 1 条消息
    await sendMessage(page, '我想做一个项目');

    // 等 AI 回复完成（等卡片或回复出现）
    const card = await waitForQuestionCard(page, AI_TIMEOUT);
    expect(card, '应出现选项卡').not.toBeNull();
    console.log('[Q-016 场景3] 卡片:', card!.slice(0, 60));

    // 等待 AI 回复完全结束（loading 消失）
    await waitForAIResponse(page, AI_TIMEOUT);

    const msgCountBefore = await getMessageCount(page);
    console.log('[Q-016 场景3] 刷新前消息数:', msgCountBefore);
    expect(msgCountBefore, '至少应有 2 条消息（1 user + 1 assistant）').toBeGreaterThanOrEqual(2);

    // 获取项目 ID：优先用拦截器捕获的，回退到 API 列表查询
    let projectId = projectIdTracker.getProjectId();
    if (!projectId) {
      console.log('[Q-016 场景3] 拦截器未捕获到项目 ID，尝试从 API 列表获取...');
      // 等一下让项目创建完成
      await page.waitForTimeout(3000);
      projectId = projectIdTracker.getProjectId();
    }
    if (!projectId) {
      // 从用户项目列表中获取最新的项目
      const listResp = await page.request.get(`${API_BASE}/projects?page=1&page_size=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (listResp.ok()) {
        const listBody = await listResp.json();
        const items = listBody.data?.items || [];
        if (items.length > 0) {
          projectId = items[0].id;
          console.log('[Q-016 场景3] 从 API 列表获取到项目 ID:', projectId);
        }
      }
    }
    console.log('[Q-016 场景3] 最终项目 ID:', projectId);
    expect(projectId, '项目应该已创建（拦截器或 API 列表）').not.toBeNull();

    // 立刻刷新（不等 3 秒防抖）
    // saveChatNow 在 finally 块中通过 setTimeout(0) 调用，应该已经保存
    await page.reload({ waitUntil: 'domcontentloaded', timeout: SETUP_TIMEOUT });
    await page.waitForTimeout(3000);

    // 通过 API 验证 chat_saved_at
    const chatInfo = await getChatSavedAt(page, token, projectId!);
    console.log('[Q-016 场景3] chat_saved_at:', chatInfo.saved_at, '消息数:', chatInfo.message_count);
    expect(chatInfo.saved_at, 'chat_saved_at 应有值（流式结束强制保存生效）').not.toBeNull();
    expect(chatInfo.message_count, '后端消息数应 ≥ 2').toBeGreaterThanOrEqual(2);

    await page.screenshot({ path: 'test-results/q016-sc3-after-refresh.png' });
  });
});
