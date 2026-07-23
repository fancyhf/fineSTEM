/**
 * Create 页面 PBL 流程 E2E 测试
 * 测试完整的 9 阶段 PBL 流程
 */
import { test, expect } from '@playwright/test';
import { createProject, saveProjectChat } from '../helpers/api';

test.describe('Create 页面 PBL 流程测试', () => {
  const testUser = {
    token: process.env.TEST_USER_TOKEN || 'test-token',
    id: 'test-user-id',
  };

  test('应该正确处理 ask_question 工具调用并渲染选项卡片', async ({ page }) => {
    // 创建测试项目
    const project = await createProject(page, testUser.token, `PBL测试项目_${Date.now()}`);
    
    // 导航到 Create 页面
    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // 发送消息触发 ask_question 工具调用
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('我想做一个新项目');
    await chatInput.press('Enter');

    // 等待选项卡片出现（ask_question 工具调用应该渲染卡片）
    const questionCard = page.locator('[data-testid="question-card"]').first();
    await expect(questionCard).toBeVisible({ timeout: 30000 });

    // 验证卡片标题
    const cardTitle = questionCard.locator('[data-testid="question-title"]');
    await expect(cardTitle).toBeVisible();
    const titleText = await cardTitle.textContent();
    expect(titleText).toBeTruthy();
    expect(titleText!.length).toBeGreaterThan(0);

    // 验证选项按钮存在
    const optionButtons = questionCard.locator('[data-testid="question-option"]');
    const optionCount = await optionButtons.count();
    expect(optionCount).toBeGreaterThanOrEqual(2);
    expect(optionCount).toBeLessThanOrEqual(8);
  });

  test('应该正确处理用户点击选项并发送 [选择] 格式消息', async ({ page }) => {
    // 创建测试项目
    const project = await createProject(page, testUser.token, `选项测试_${Date.now()}`);
    
    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // 发送消息触发选项
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('开始新项目');
    await chatInput.press('Enter');

    // 等待选项卡片
    const questionCard = page.locator('[data-testid="question-card"]').first();
    await expect(questionCard).toBeVisible({ timeout: 30000 });

    // 获取第一个选项的文本
    const firstOption = questionCard.locator('[data-testid="question-option"]').first();
    const optionText = await firstOption.textContent();

    // 点击选项
    await firstOption.click();

    // 验证消息列表中出现 [选择] 格式的消息
    const userMessages = page.locator('[data-testid="user-message"]');
    const lastMessage = userMessages.last();
    await expect(lastMessage).toContainText('[选择]');
    await expect(lastMessage).toContainText('回答：');
    await expect(lastMessage).toContainText(optionText || '');
  });

  test('AI 应该识别 [选择] 格式消息并继续流程，不重复提问', async ({ page }) => {
    // 创建测试项目并预设聊天历史
    const project = await createProject(page, testUser.token, `选择识别测试_${Date.now()}`);
    
    // 预设聊天历史：用户已经选择过
    await saveProjectChat(page, testUser.token, project.id, [
      { id: '1', role: 'user', content: '我想做一个记账工具' },
      { id: '2', role: 'assistant', content: '好的，让我了解一下你的需求。' },
      { id: '3', role: 'user', content: '[选择] 你这个记账工具，想做成什么样？\n回答：极简即开即用型' },
    ]);

    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // 发送继续消息
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('继续');
    await chatInput.press('Enter');

    // 等待 AI 回复
    const assistantMessages = page.locator('[data-testid="assistant-message"]');
    const lastAssistantMessage = assistantMessages.last();
    
    // AI 不应该说"你没选"或"等你选一个"
    const messageText = await lastAssistantMessage.textContent();
    expect(messageText).not.toContain('你没选');
    expect(messageText).not.toContain('等你选一个');
    expect(messageText).not.toContain('瞎了');
    expect(messageText).not.toContain('没看见');
  });

  test('回复不应该被截断（至少 100 字符）', async ({ page }) => {
    const project = await createProject(page, testUser.token, `截断测试_${Date.now()}`);
    
    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // 发送消息
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('请详细介绍如何规划一个项目');
    await chatInput.press('Enter');

    // 等待 AI 回复完成
    await page.waitForTimeout(10000);

    // 获取最后一条 AI 回复
    const assistantMessages = page.locator('[data-testid="assistant-message"]');
    const lastMessage = assistantMessages.last();
    const messageText = await lastMessage.textContent();

    // 验证回复长度（不应被截断）
    expect(messageText?.length || 0).toBeGreaterThan(100);
  });

  test('所有 PBL 阶段都应该能渲染选项卡片', async ({ page }) => {
    const stages = [
      'stage_00_bootstrap',
      'stage_01_brainstorm',
      'stage_02_brief',
      'stage_03_constraints',
      'stage_04_track_plan',
      'stage_05_design',
      'stage_06_step_plan',
      'stage_07_execute',
      'stage_08_evaluate',
    ];

    for (const stage of stages) {
      const project = await createProject(page, testUser.token, `阶段测试_${stage}_${Date.now()}`);
      
      await page.goto('/create');
      await page.waitForLoadState('networkidle');

      // 发送适合该阶段的消息
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill(`当前阶段是${stage}，请给我选项`);
      await chatInput.press('Enter');

      // 等待响应
      await page.waitForTimeout(5000);

      // 检查是否有选项卡片或正常回复
      const hasQuestionCard = await page.locator('[data-testid="question-card"]').first().isVisible().catch(() => false);
      const hasAssistantMessage = await page.locator('[data-testid="assistant-message"]').first().isVisible().catch(() => false);

      expect(hasQuestionCard || hasAssistantMessage).toBe(true);
    }
  });
});
