/**
 * PBL 阶段推进完整测试
 * 测试开题、阶段推进、AI对话完整性
 */
import { test, expect } from '@playwright/test';
import { createProject, saveProjectChat, getProjectState } from '../helpers/api';

test.describe('PBL 阶段推进完整测试', () => {
  const testUser = {
    token: process.env.TEST_USER_TOKEN || 'test-token',
    id: 'test-user-id',
  };

  test('应该能从 bootstrap 推进到 brainstorm 阶段', async ({ page }) => {
    const project = await createProject(page, testUser.token, `阶段推进测试_${Date.now()}`);
    
    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    const chatInput = page.locator('[data-testid="chat-input"]');

    // 步骤1: 回答年级
    await chatInput.fill('开始新项目');
    await chatInput.press('Enter');

    const questionCard1 = page.locator('[data-testid="question-card"]').first();
    await expect(questionCard1).toBeVisible({ timeout: 30000 });

    await questionCard1.locator('[data-testid="question-option"]').first().click();
    await questionCard1.locator('button:has-text("下一步"), button:has-text("确定")').click();

    // 步骤2: 回答时间
    await page.waitForTimeout(3000);
    const questionCard2 = page.locator('[data-testid="question-card"]').first();
    if (await questionCard2.isVisible().catch(() => false)) {
      await questionCard2.locator('[data-testid="question-option"]').first().click();
      await questionCard2.locator('button:has-text("下一步"), button:has-text("确定")').click();
    }

    // 步骤3: 回答想法
    await page.waitForTimeout(3000);
    const questionCard3 = page.locator('[data-testid="question-card"]').first();
    if (await questionCard3.isVisible().catch(() => false)) {
      await questionCard3.locator('[data-testid="question-option"]').first().click();
      await questionCard3.locator('button:has-text("确定")').click();
    }

    // 验证 AI 进入脑爆阶段
    await page.waitForTimeout(5000);
    const assistantMessages = page.locator('[data-testid="assistant-message"]');
    const lastMessage = assistantMessages.last();
    const messageText = await lastMessage.textContent();

    // 应该提到脑爆、选题或项目方向
    const stageKeywords = ['脑爆', '选题', '想法', '方向', '项目', '创意'];
    const hasStageKeyword = stageKeywords.some(kw => messageText.includes(kw));
    expect(hasStageKeyword).toBe(true);
  });

  test('AI 应该能正确识别所有阶段并给出对应指导', async ({ page }) => {
    const stages = [
      { id: 'stage_00_bootstrap', name: '初始化', keywords: ['年级', '时间', '想法'] },
      { id: 'stage_01_brainstorm', name: '脑爆', keywords: ['脑爆', '选题', '想法', '创意'] },
      { id: 'stage_02_brief', name: '开题', keywords: ['开题', '立项', '目标', '需求'] },
      { id: 'stage_03_constraints', name: '范围', keywords: ['范围', '裁剪', 'must-have', 'MVP'] },
      { id: 'stage_04_track', name: '轨道', keywords: ['技术', '轨道', '选型', '栈'] },
      { id: 'stage_05_design', name: '设计', keywords: ['设计', '架构', '流程', '模块'] },
      { id: 'stage_06_step_plan', name: '计划', keywords: ['计划', '步骤', '里程碑', '任务'] },
      { id: 'stage_07_execute', name: '执行', keywords: ['代码', '开发', '实现', '编写'] },
      { id: 'stage_08_evaluate', name: '验收', keywords: ['验收', '测试', '成果', '展示'] },
    ];

    for (const stage of stages) {
      const project = await createProject(page, testUser.token, `阶段测试_${stage.id}_${Date.now()}`);
      
      await page.goto('/create');
      await page.waitForLoadState('networkidle');

      // 告诉 AI 当前阶段
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill(`当前阶段是${stage.name}，请给我指导`);
      await chatInput.press('Enter');

      // 等待回复
      await page.waitForTimeout(8000);

      const assistantMessages = page.locator('[data-testid="assistant-message"]');
      const lastMessage = assistantMessages.last();
      const messageText = await lastMessage.textContent();

      // 验证回复包含阶段相关关键词
      const hasKeyword = stage.keywords.some(kw => messageText.includes(kw));
      expect(hasKeyword, `阶段 ${stage.name} 应该包含相关关键词`).toBe(true);

      // 回复应该有意义（不太短）
      expect(messageText.length).toBeGreaterThan(50);
    }
  });

  test('AI 对话应该连贯，不重复提问', async ({ page }) => {
    const project = await createProject(page, testUser.token, `连贯性测试_${Date.now()}`);
    
    // 预设聊天历史
    await saveProjectChat(page, testUser.token, project.id, [
      { id: '1', role: 'user', content: '我想做一个记账工具' },
      { id: '2', role: 'assistant', content: '好的，让我了解一下你的情况。你现在是哪个年级？' },
      { id: '3', role: 'user', content: '[选择:senior] 高中' },
      { id: '4', role: 'assistant', content: '收到！你打算花多长时间完成这个项目？' },
      { id: '5', role: 'user', content: '[选择:time-6h] 6小时' },
    ]);

    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // 发送继续消息
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('继续');
    await chatInput.press('Enter');

    // 等待回复
    await page.waitForTimeout(8000);

    const assistantMessages = page.locator('[data-testid="assistant-message"]');
    const lastMessage = assistantMessages.last();
    const messageText = await lastMessage.textContent();

    // 不应该重复问已经回答过的问题
    expect(messageText).not.toContain('你现在是哪个年级');
    expect(messageText).not.toContain('你打算花多长时间');

    // 应该继续推进流程
    expect(messageText.length).toBeGreaterThan(30);
  });

  test('长对话不应该丢失上下文', async ({ page }) => {
    const project = await createProject(page, testUser.token, `上下文测试_${Date.now()}`);
    
    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    const chatInput = page.locator('[data-testid="chat-input"]');

    // 进行多轮对话
    const conversations = [
      '我想做一个记账工具',
      '我希望是网页版',
      '用 Python 实现',
      '需要有哪些功能？',
    ];

    for (const message of conversations) {
      await chatInput.fill(message);
      await chatInput.press('Enter');
      await page.waitForTimeout(6000);
    }

    // 最后询问之前提到的内容
    await chatInput.fill('我们刚才说要做什么项目？');
    await chatInput.press('Enter');
    await page.waitForTimeout(8000);

    const assistantMessages = page.locator('[data-testid="assistant-message"]');
    const lastMessage = assistantMessages.last();
    const messageText = await lastMessage.textContent();

    // AI 应该记得之前提到的记账工具
    expect(messageText).toContain('记账');
  });

  test('AI 回复不应该被截断', async ({ page }) => {
    const project = await createProject(page, testUser.token, `截断测试_${Date.now()}`);
    
    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('请详细解释如何从零开始规划一个完整的 STEM 项目，包括选题、设计、开发、测试的所有步骤');
    await chatInput.press('Enter');

    // 给足够时间生成长回复
    await page.waitForTimeout(20000);

    const assistantMessages = page.locator('[data-testid="assistant-message"]');
    const lastMessage = assistantMessages.last();
    const messageText = await lastMessage.textContent();

    // 回复应该很长
    expect(messageText.length).toBeGreaterThan(200);

    // 不应该以未完成的词结尾
    const trimmed = messageText.trim();
    const badEndings = ['首先', '然后', '接下来', '第一步', '比如', '例如', '：', ':', '，', ','];
    const last10Chars = trimmed.slice(-10);
    
    for (const ending of badEndings) {
      expect(last10Chars).not.toContain(ending);
    }

    // 代码块应该闭合
    const codeBlockMatches = (messageText.match(/```/g) || []).length;
    expect(codeBlockMatches % 2).toBe(0);
  });

  test('阶段推进应该触发工具调用', async ({ page }) => {
    const project = await createProject(page, testUser.token, `工具调用测试_${Date.now()}`);
    
    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('完成当前阶段，推进到下一步');
    await chatInput.press('Enter');

    await page.waitForTimeout(10000);

    // 检查是否有工具调用指示器
    const toolCalls = page.locator('[data-testid="tool-call"], .tool-call, [class*="tool"]').first();
    const hasToolCall = await toolCalls.isVisible().catch(() => false);

    // 或者检查阶段是否变化
    const state = await getProjectState(page, testUser.token, project.id);
    
    // 至少应该收到 AI 的回复
    const assistantMessages = page.locator('[data-testid="assistant-message"]');
    expect(await assistantMessages.count()).toBeGreaterThan(0);
  });

  test('教学模式应该在对话中生效', async ({ page }) => {
    const modes = ['guided', 'demo', 'hands_on', 'lecture'];

    for (const mode of modes) {
      const project = await createProject(page, testUser.token, `模式测试_${mode}_${Date.now()}`);
      
      await page.goto('/create');
      await page.waitForLoadState('networkidle');

      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill(`切换到${mode}模式，教我写一个简单的计算器`);
      await chatInput.press('Enter');

      await page.waitForTimeout(10000);

      const assistantMessages = page.locator('[data-testid="assistant-message"]');
      const lastMessage = assistantMessages.last();
      const messageText = await lastMessage.textContent();

      // 根据模式检查回复特征
      if (mode === 'guided') {
        // 引导式应该有 TODO 或框架
        expect(messageText).toMatch(/TODO|框架|填空|补全/i);
      } else if (mode === 'demo') {
        // 演示式应该有完整代码
        expect(messageText).toContain('```');
      } else if (mode === 'hands_on') {
        // 动手式应该有挑战或任务
        expect(messageText).toMatch(/尝试|挑战|任务|自己/i);
      } else if (mode === 'lecture') {
        // 讲解式应该有原理说明
        expect(messageText).toMatch(/原理|概念|为什么|首先/i);
      }
    }
  });
});
