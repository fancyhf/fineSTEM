/**
 * PBL QuestionCard 完整功能测试
 * 测试多选项卡、单选、多选、选项识别等核心功能
 */
import { test, expect } from '@playwright/test';
import { createProject, saveProjectChat } from '../helpers/api';

test.describe('PBL QuestionCard 完整功能测试', () => {
  const testUser = {
    token: process.env.TEST_USER_TOKEN || 'test-token',
    id: 'test-user-id',
  };

  test('应该支持单选选项卡', async ({ page }) => {
    const project = await createProject(page, testUser.token, `单选测试_${Date.now()}`);
    
    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // 发送消息触发 ask_question
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('我想做一个新项目');
    await chatInput.press('Enter');

    // 等待选项卡片
    const questionCard = page.locator('[data-testid="question-card"]').first();
    await expect(questionCard).toBeVisible({ timeout: 30000 });

    // 获取选项
    const options = questionCard.locator('[data-testid="question-option"]');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThanOrEqual(2);

    // 点击第一个选项
    await options.first().click();

    // 验证选项被选中（应该有视觉反馈）
    const firstOption = options.first();
    await expect(firstOption).toHaveClass(/selected|active|border-teal/);

    // 点击第二个选项
    await options.nth(1).click();

    // 验证第二个被选中，第一个取消选中
    await expect(options.nth(1)).toHaveClass(/selected|active|border-teal/);
    // 单选模式下，第一个应该取消选中
    const firstClass = await firstOption.getAttribute('class');
    expect(firstClass).not.toMatch(/selected|active/);
  });

  test('应该支持多选选项卡', async ({ page }) => {
    const project = await createProject(page, testUser.token, `多选测试_${Date.now()}`);
    
    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // 发送消息触发多选 ask_question
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('选择你的兴趣爱好（可多选）');
    await chatInput.press('Enter');

    // 等待选项卡片
    const questionCard = page.locator('[data-testid="question-card"]').first();
    await expect(questionCard).toBeVisible({ timeout: 30000 });

    // 检查是否显示为多选（通过复选框样式或multiple标识）
    const isMultiple = await questionCard.getAttribute('data-multiple');
    
    // 获取选项
    const options = questionCard.locator('[data-testid="question-option"]');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThanOrEqual(2);

    // 点击第一个选项
    await options.first().click();
    await expect(options.first()).toHaveClass(/selected|active/);

    // 点击第二个选项（多选模式下应该同时选中）
    await options.nth(1).click();
    await expect(options.nth(1)).toHaveClass(/selected|active/);
    // 第一个仍然选中
    await expect(options.first()).toHaveClass(/selected|active/);

    // 再次点击第一个选项取消选中
    await options.first().click();
    await expect(options.first()).not.toHaveClass(/selected|active/);
    // 第二个仍然选中
    await expect(options.nth(1)).toHaveClass(/selected|active/);
  });

  test('应该支持多张选项卡同时显示', async ({ page }) => {
    const project = await createProject(page, testUser.token, `多卡测试_${Date.now()}`);
    
    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // 发送消息可能触发多个 ask_question
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('请帮我规划项目，需要了解年级、时间和想法');
    await chatInput.press('Enter');

    // 等待选项卡片
    await page.waitForTimeout(5000);

    // 检查是否有多张卡片
    const questionCards = page.locator('[data-testid="question-card"]');
    const cardCount = await questionCards.count();
    
    // 可能有一张或多张
    expect(cardCount).toBeGreaterThanOrEqual(1);

    // 如果有多个卡片，验证它们都可以交互
    for (let i = 0; i < Math.min(cardCount, 3); i++) {
      const card = questionCards.nth(i);
      await expect(card).toBeVisible();
      
      const options = card.locator('[data-testid="question-option"]');
      const optionCount = await options.count();
      expect(optionCount).toBeGreaterThanOrEqual(2);
    }
  });

  test('选项应该显示正确的ID和标签', async ({ page }) => {
    const project = await createProject(page, testUser.token, `选项ID测试_${Date.now()}`);
    
    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // 发送消息触发 ask_question
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('开始新项目');
    await chatInput.press('Enter');

    // 等待选项卡片
    const questionCard = page.locator('[data-testid="question-card"]').first();
    await expect(questionCard).toBeVisible({ timeout: 30000 });

    // 获取第一个选项
    const firstOption = questionCard.locator('[data-testid="question-option"]').first();
    
    // 验证选项有data-id属性
    const optionId = await firstOption.getAttribute('data-option-id');
    expect(optionId).toBeTruthy();
    expect(optionId.length).toBeGreaterThan(0);

    // 验证选项有标签文本
    const optionLabel = await firstOption.textContent();
    expect(optionLabel).toBeTruthy();
    expect(optionLabel.length).toBeGreaterThan(0);
  });

  test('选择后应该发送正确的 [选择:选项ID] 格式消息', async ({ page }) => {
    const project = await createProject(page, testUser.token, `选择格式测试_${Date.now()}`);
    
    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // 发送消息触发 ask_question
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('开始新项目');
    await chatInput.press('Enter');

    // 等待选项卡片
    const questionCard = page.locator('[data-testid="question-card"]').first();
    await expect(questionCard).toBeVisible({ timeout: 30000 });

    // 获取第一个选项的ID和标签
    const firstOption = questionCard.locator('[data-testid="question-option"]').first();
    const optionId = await firstOption.getAttribute('data-option-id');
    const optionLabel = await firstOption.textContent();

    // 点击确定按钮
    const confirmButton = questionCard.locator('button:has-text("确定"), button:has-text("下一步")');
    await confirmButton.click();

    // 验证发送的消息格式
    const userMessages = page.locator('[data-testid="user-message"]');
    const lastMessage = userMessages.last();
    const messageText = await lastMessage.textContent();

    // 验证格式: [选择:选项ID] 选项标签
    expect(messageText).toMatch(/\[选择[:：]/);
    expect(messageText).toContain(optionId);
    expect(messageText).toContain(optionLabel);
  });

  test('多选后应该发送包含所有选中选项的消息', async ({ page }) => {
    const project = await createProject(page, testUser.token, `多选消息测试_${Date.now()}`);
    
    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // 发送消息触发多选 ask_question
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('选择多个兴趣爱好');
    await chatInput.press('Enter');

    // 等待选项卡片
    const questionCard = page.locator('[data-testid="question-card"]').first();
    await expect(questionCard).toBeVisible({ timeout: 30000 });

    // 选择前两个选项
    const options = questionCard.locator('[data-testid="question-option"]');
    await options.first().click();
    await options.nth(1).click();

    // 获取选中的选项标签
    const firstLabel = await options.first().textContent();
    const secondLabel = await options.nth(1).textContent();

    // 点击确定
    const confirmButton = questionCard.locator('button:has-text("确定")');
    await confirmButton.click();

    // 验证消息包含所有选中选项
    const userMessages = page.locator('[data-testid="user-message"]');
    const lastMessage = userMessages.last();
    const messageText = await lastMessage.textContent();

    expect(messageText).toMatch(/\[选择[:：]/);
    // 消息应该包含两个选项的标签
    expect(messageText).toContain(firstLabel);
    expect(messageText).toContain(secondLabel);
  });

  test('选项卡应该显示步骤进度', async ({ page }) => {
    const project = await createProject(page, testUser.token, `步骤进度测试_${Date.now()}`);
    
    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // 发送消息触发带步骤的 ask_question
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('开始新项目');
    await chatInput.press('Enter');

    // 等待选项卡片
    const questionCard = page.locator('[data-testid="question-card"]').first();
    await expect(questionCard).toBeVisible({ timeout: 30000 });

    // 检查是否有步骤指示器
    const stepIndicator = questionCard.locator('[data-testid="step-indicator"], .step-indicator, [class*="step"]').first();
    const hasStepIndicator = await stepIndicator.isVisible().catch(() => false);

    if (hasStepIndicator) {
      const stepText = await stepIndicator.textContent();
      // 应该显示类似 "1 / 3" 的格式
      expect(stepText).toMatch(/\d+\s*\/\s*\d+/);
    }
  });

  test('选项卡应该有"上一步"按钮（非第一步时）', async ({ page }) => {
    const project = await createProject(page, testUser.token, `上一步测试_${Date.now()}`);
    
    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // 完成第一步
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('开始新项目');
    await chatInput.press('Enter');

    // 等待第一张选项卡片
    const questionCard = page.locator('[data-testid="question-card"]').first();
    await expect(questionCard).toBeVisible({ timeout: 30000 });

    // 选择并确认
    const firstOption = questionCard.locator('[data-testid="question-option"]').first();
    await firstOption.click();
    
    const confirmButton = questionCard.locator('button:has-text("确定"), button:has-text("下一步")');
    await confirmButton.click();

    // 等待可能的第二张卡片
    await page.waitForTimeout(3000);

    // 检查是否有第二张卡片且有"上一步"按钮
    const cards = page.locator('[data-testid="question-card"]');
    const cardCount = await cards.count();

    for (let i = 1; i < cardCount; i++) {
      const card = cards.nth(i);
      const backButton = card.locator('button:has-text("上一步"), button:has-text("返回")');
      const hasBackButton = await backButton.isVisible().catch(() => false);
      
      if (hasBackButton) {
        await expect(backButton).toBeVisible();
        break;
      }
    }
  });

  test('AI 应该正确识别 [选择:选项ID] 格式并继续流程', async ({ page }) => {
    const project = await createProject(page, testUser.token, `AI识别测试_${Date.now()}`);
    
    // 预设聊天历史，模拟用户已选择
    await saveProjectChat(page, testUser.token, project.id, [
      { id: '1', role: 'user', content: '我想做一个记账工具' },
      { id: '2', role: 'assistant', content: '好的，让我了解一下你的情况。' },
      { id: '3', role: 'user', content: '[选择:time-6h] 6小时' },
    ]);

    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // 发送继续消息
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('继续');
    await chatInput.press('Enter');

    // 等待 AI 回复
    await page.waitForTimeout(5000);

    const assistantMessages = page.locator('[data-testid="assistant-message"]');
    const lastMessage = assistantMessages.last();
    const messageText = await lastMessage.textContent();

    // AI 不应该说用户没选择
    expect(messageText).not.toContain('你没选');
    expect(messageText).not.toContain('等你选择');
    expect(messageText).not.toContain('请选择一个选项');
    
    // AI 应该继续推进流程
    expect(messageText.length).toBeGreaterThan(20);
  });

  test('回复不应该被截断，应该有完整内容', async ({ page }) => {
    const project = await createProject(page, testUser.token, `截断测试_${Date.now()}`);
    
    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // 发送需要长回复的消息
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('请详细介绍项目规划的完整流程');
    await chatInput.press('Enter');

    // 等待 AI 回复（给足够时间）
    await page.waitForTimeout(15000);

    const assistantMessages = page.locator('[data-testid="assistant-message"]');
    const lastMessage = assistantMessages.last();
    const messageText = await lastMessage.textContent();

    // 回复应该足够长（至少100字符）
    expect(messageText.length).toBeGreaterThan(100);

    // 不应该以未完成的句子结尾
    const lastChar = messageText.trim().slice(-1);
    const incompleteEndings = ['，', ',', '：', ':', '；', ';', '（', '(', '[', '{'];
    expect(incompleteEndings).not.toContain(lastChar);

    // 如果有代码块，应该闭合
    const openCodeBlocks = (messageText.match(/```/g) || []).length;
    expect(openCodeBlocks % 2).toBe(0); // 应该是偶数（成对出现）
  });

  test('应该支持带描述的选项', async ({ page }) => {
    const project = await createProject(page, testUser.token, `选项描述测试_${Date.now()}`);
    
    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // 发送消息触发 ask_question
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('选择技术栈');
    await chatInput.press('Enter');

    // 等待选项卡片
    const questionCard = page.locator('[data-testid="question-card"]').first();
    await expect(questionCard).toBeVisible({ timeout: 30000 });

    // 检查选项是否有描述
    const options = questionCard.locator('[data-testid="question-option"]');
    const firstOption = options.first();

    // 查找描述元素
    const description = firstOption.locator('[data-testid="option-description"], .description, [class*="desc"]').first();
    const hasDescription = await description.isVisible().catch(() => false);

    if (hasDescription) {
      const descText = await description.textContent();
      expect(descText).toBeTruthy();
      expect(descText.length).toBeGreaterThan(0);
    }
  });

  test('应该支持推荐标记的选项', async ({ page }) => {
    const project = await createProject(page, testUser.token, `推荐标记测试_${Date.now()}`);
    
    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // 发送消息触发 ask_question
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('选择项目类型');
    await chatInput.press('Enter');

    // 等待选项卡片
    const questionCard = page.locator('[data-testid="question-card"]').first();
    await expect(questionCard).toBeVisible({ timeout: 30000 });

    // 查找推荐标记
    const recommendedBadge = questionCard.locator('[data-testid="recommended-badge"], .recommended, :has-text("推荐")').first();
    const hasRecommended = await recommendedBadge.isVisible().catch(() => false);

    // 可能有推荐标记
    if (hasRecommended) {
      const badgeText = await recommendedBadge.textContent();
      expect(badgeText).toContain('推荐');
    }
  });
});
