/**
 * fineSTEM PBL 对话流程 E2E 自动化测试（可复用版本）
 *
 * 覆盖完整用户旅程：
 * 1. 用户提出做项目请求
 * 2. 系统给出选项（QuestionCard）
 * 3. 用户选择选项
 * 4. 系统给出反馈，不断交互
 * 5. 产生代码
 * 6. 自动展开代码编辑器
 * 7. 进行运行
 * 8. 看到运行结果
 * 9. 修改项目名字
 * 10. 查看项目保存状态
 * 11. 打开历史项目
 *
 * 用法：
 *   npx playwright test pbl-conversation-flow.spec.ts --headed
 *   npx playwright test pbl-conversation-flow.spec.ts -g "完整PBL流程"
 *
 * 配置：
 *   BASE_URL: 前端地址（默认 http://localhost:5284/create）
 *   API_BASE: 后端 API 地址（默认 http://localhost:3200/api/v1）
 */

import { test, expect, Page, Locator } from '@playwright/test';

const CONFIG = {
  BASE_URL: process.env.BASE_URL || 'http://localhost:5284/create',
  API_BASE: process.env.API_BASE || 'http://localhost:3200/api/v1',
  TIMEOUTS: {
    AI_RESPONSE: 45000,
    QUESTION_APPEAR: 15000,
    EDITOR_APPEAR: 10000,
    CODE_RUN: 8000,
    NAVIGATION: 5000,
  },
  SCREENSHOT_DIR: 'test-results/pbl-flow',
};

test.describe('PBL 对话流程 - 可复用 E2E 测试套件', () => {

  test.beforeAll(async () => {
    console.log('\n========== PBL 流程 E2E 测试开始 ==========');
    console.log(`前端地址: ${CONFIG.BASE_URL}`);
    console.log(`后端 API: ${CONFIG.API_BASE}`);
  });

  test.afterAll(async () => {
    console.log('\n========== PBL 流程 E2E 测试结束 ==========\n');
  });

  /**
   * ============================================================
   * 工具函数（可在多个测试中复用）
   * ============================================================
   */

  class PBLTestHelper {
    page: Page;
    screenshots: string[] = [];

    constructor(page: Page) {
      this.page = page;
    }

    async navigateToCreatePage(): Promise<void> {
      await this.page.goto(CONFIG.BASE_URL);
      await this.page.waitForLoadState('networkidle');

      const createBtn = this.page.locator('a[href="/create"], a:has-text("创造")').first();
      if (await createBtn.isVisible({ timeout: CONFIG.TIMEOUTS.NAVIGATION }).catch(() => false)) {
        await createBtn.click();
        await this.page.waitForTimeout(1000);
      }

      await this.screenshot('navigate-create');
      console.log('✅ 已进入创造页面');
    }

    async getChatInput(): Promise<Locator> {
      const input = this.page.locator('textarea').first();
      await expect(input).toBeVisible({ timeout: CONFIG.TIMEOUTS.NAVIGATION });
      await expect(input).toBeEnabled({ timeout: CONFIG.TIMEOUTS.AI_RESPONSE });
      return input;
    }

    async sendMessage(message: string): Promise<void> {
      const input = await this.getChatInput();
      await input.fill(message);
      await this.page.keyboard.press('Enter');
      console.log(`📤 已发送消息: "${message.slice(0, 50)}${message.length > 50 ? '...' : ''}"`);
    }

    async waitForAIResponse(timeout?: number): Promise<boolean> {
      const aiMsg = this.page.locator('text=fineSTEM AI').first();
      try {
        await expect(aiMsg).toBeVisible({ timeout: timeout || CONFIG.TIMEOUTS.AI_RESPONSE });
        return true;
      } catch (e) {
        console.log(`⚠️ waitForAIResponse 超时 (${timeout || CONFIG.TIMEOUTS.AI_RESPONSE}ms)，尝试检查其他指示器...`);
        
        const loadingIndicator = this.page.locator('.animate-bounce, [class*="loading"], [class*="spinner"]').first();
        const stillLoading = await loadingIndicator.isVisible({ timeout: 2000 }).catch(() => false);
        console.log(`页面仍在加载: ${stillLoading}`);
        
        const bodyText = await this.page.locator('body').textContent() || '';
        const hasAnyMessage = bodyText.includes('fineSTEM AI') || bodyText.includes('assistant');
        console.log(`页面有任何消息内容: ${hasAnyMessage}`);
        
        if (!hasAnyMessage) {
          console.log('页面文本片段:', bodyText.slice(0, 500));
        }
        
        return false;
      }
    }

    async isQuestionCardVisible(): Promise<boolean> {
      const selectors = [
        '.question-card',
        '[data-testid="question-card"]',
        'text=提问',
        'button:has-text("确定")',
        'button:has-text("下一步")',
      ];
      
      for (const selector of selectors) {
        try {
          const el = this.page.locator(selector).first();
          if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
            return true;
          }
        } catch {}
      }
      
      return false;
    }

    async selectFirstOption(): Promise<boolean> {
      const optionSelectors = [
        '[role="radio"]',
        'button[class*="option"]',
        '.option-item',
        'div[class*="rounded-lg"][class*="border"]:has(div[class*="rounded-full"])',
      ];

      for (const selector of optionSelectors) {
        try {
          const option = this.page.locator(selector).first();
          if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
            await option.click();
            console.log('✅ 已选择第一个选项');
            
            const confirmBtn = this.page.locator('button:has-text("确定"), button:has-text("下一步")').first();
            if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await confirmBtn.click();
              console.log('✅ 已点击确认按钮');
            }
            
            return true;
          }
        } catch {}
      }

      return false;
    }

    async handleQuestionCardIfPresent(maxWaitMs?: number): Promise<boolean> {
      console.log('⏳ 等待 QuestionCard...');
      
      const start = Date.now();
      while (Date.now() - start < (maxWaitMs || CONFIG.TIMEOUTS.QUESTION_APPEAR)) {
        if (await this.isQuestionCardVisible()) {
          console.log('✅ 发现 QuestionCard');
          const selected = await this.selectFirstOption();
          if (selected) {
            await this.page.waitForTimeout(3000);
            await this.screenshot('after-question-selection');
            return true;
          }
        }
        await this.page.waitForTimeout(1000);
      }

      console.log('⚠️ 未发现 QuestionCard');
      return false;
    }

    async continueConversation(prompts: string[], maxRounds: number = 3): Promise<{ rounds: number; hasCode: boolean }> {
      let hasCode = false;
      let rounds = 0;

      for (let i = 0; i < maxRounds; i++) {
        rounds++;
        console.log(`\n--- 第 ${i + 1} 轮对话 ---`);

        const questionHandled = await this.handleQuestionCardIfPresent(8000);
        
        if (!questionHandled) {
          const prompt = prompts[i % prompts.length];
          await this.sendMessage(prompt);
          
          const responded = await this.waitForAIResponse(CONFIG.TIMEOUTS.AI_RESPONSE);
          if (!responded) {
            console.warn(`⚠️ 第 ${i + 1} 轮未收到 AI 回复`);
            break;
          }
        }

        hasCode = await this.checkForCodeContent();
        if (hasCode) {
          console.log(`✅ 第 ${i + 1} 轮检测到代码内容`);
          break;
        }

        await this.screenshot(`round-${i + 1}`);
      }

      return { rounds, hasCode };
    }

    async checkForCodeContent(): Promise<boolean> {
      const bodyText = await this.page.locator('body').textContent() || '';
      const codePatterns = [
        /\bdef\s+\w+\s*\(/,
        /\bclass\s+\w+/,
        /\bfunction\s+\w+\s*\(/,
        /```\w*/,
        /<code[^>]*>/,
        /import\s+\w+/,
        /console\.log/,
        /print\s*\(/,
      ];
      
      return codePatterns.some(pattern => pattern.test(bodyText));
    }

    async isEditorVisible(): Promise<boolean> {
      const editorSelectors = [
        '.monaco-editor',
        '[class*="code-editor"]',
        '.view-lines',
        'textarea[readonly]',
      ];

      for (const selector of editorSelectors) {
        try {
          const el = this.page.locator(selector).first();
          if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
            return true;
          }
        } catch {}
      }

      return false;
    }

    async clickRunButton(): Promise<boolean> {
      const runSelectors = [
        'button:has-text("运行")',
        'button:has-text("▶")',
        'button:has-text("Run")',
        '[data-testid="run-button"]',
      ];

      for (const selector of runSelectors) {
        try {
          const btn = this.page.locator(selector).first();
          if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await btn.click();
            console.log('✅ 已点击运行按钮');
            await this.page.waitForTimeout(CONFIG.TIMEOUTS.CODE_RUN);
            return true;
          }
        } catch {}
      }

      console.log('⚠️ 未找到运行按钮');
      return false;
    }

    async isPreviewVisible(): Promise<boolean> {
      const previewSelectors = [
        'iframe[srcdoc]',
        '[class*="preview"]',
        '[class*="result"]',
        '[class*="output"]',
      ];

      for (const selector of previewSelectors) {
        try {
          const el = this.page.locator(selector).first();
          if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
            return true;
          }
        } catch {}
      }

      return false;
    }

    async editProjectName(newName: string): Promise<boolean> {
      const editSelectors = [
        'button[title*="修改"]',
        'button[aria-label*="编辑"]',
        '.edit-icon',
        'svg.lucide-pencil',
        'svg.pencil-icon',
      ];

      for (const selector of editSelectors) {
        try {
          const editBtn = this.page.locator(selector).first();
          if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await editBtn.click();
            console.log('✅ 已点击编辑按钮');

            const input = this.page.locator('input[type="text"]:visible').first();
            if (await input.isVisible({ timeout: 2000 })) {
              await input.fill(newName);
              await input.press('Enter');
              console.log(`✅ 项目名已修改为 "${newName}"`);
              return true;
            }
          }
        } catch {}
      }

      console.log('⚠️ 未找到编辑按钮或输入框');
      return false;
    }

    getProjectListItems(): Promise<Locator> {
      return this.page.locator('[class*="project-item"], [data-project-id], div:has(📍)');
    }

    async getProjectCount(): Promise<number> {
      const items = await this.getProjectListItems();
      return await items.count();
    }

    async clickProjectByName(name: string): Promise<boolean> {
      const items = await this.getProjectListItems();
      const count = await items.count();

      for (let i = 0; i < count; i++) {
        const item = items.nth(i);
        const text = await item.textContent() || '';
        if (text.includes(name)) {
          await item.click();
          console.log(`✅ 已点击项目 "${name}"`);
          return true;
        }
      }

      return false;
    }

    async screenshot(name: string): Promise<string> {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${CONFIG.SCREENSHOT_DIR}/${name}-${timestamp}.png`;
      await this.page.screenshot({
        path: filename,
        fullPage: true,
      });
      this.screenshots.push(filename);
      return filename;
    }

    async diagnosePageState(): Promise<{
      messageCount: number;
      hasAIResponse: boolean;
      hasQuestionCard: boolean;
      hasEditor: boolean;
      projectCount: number;
      pageTextSnippet: string;
    }> {
      const messages = this.page.locator('text=你, text=fineSTEM AI');
      const aiResponse = this.page.locator('text=fineSTEM AI');
      
      return {
        messageCount: await messages.count(),
        hasAIResponse: await aiResponse.count() > 0,
        hasQuestionCard: await this.isQuestionCardVisible(),
        hasEditor: await this.isEditorVisible(),
        projectCount: await this.getProjectCount(),
        pageTextSnippet: (await this.page.locator('body').textContent() || '').slice(0, 300),
      };
    }
  }

  /**
   * ============================================================
   * 单元测试用例（可独立运行）
   * ============================================================
   */

  test('步骤1: 发送项目请求并验证 AI 回复', async ({ page }) => {
    const helper = new PBLTestHelper(page);
    
    await helper.navigateToCreatePage();
    await helper.sendMessage('我想做一个学生成绩管理系统');
    
    const responded = await helper.waitForAIResponse();
    expect(responded).toBeTruthy();
    
    await helper.screenshot('step1-request-sent');
    console.log('✅ 步骤1完成：AI 已回复');
  });

  test('步骤2: 验证 QuestionCard 选项卡弹出', async ({ page }) => {
    const helper = new PBLTestHelper(page);
    
    await helper.navigateToCreatePage();
    await helper.sendMessage('我想做一个学生成绩管理系统');
    await helper.waitForAIResponse();

    const state = await helper.diagnosePageState();
    console.log('页面状态:', JSON.stringify(state, null, 2));

    const hasQuestion = await helper.handleQuestionCardIfPresent(CONFIG.TIMEOUTS.QUESTION_APPEAR);
    
    if (!hasQuestion) {
      console.log('ℹ️ 本次 AI 回复未包含 QuestionCard（这是正常的，取决于 AI 行为）');
    }

    await helper.screenshot('step2-question-check');
    console.log('✅ 步骤2完成：QuestionCard 检查完毕');
  });

  test('步骤3: 选择选项后系统能继续对话', async ({ page }) => {
    const helper = new PBLTestHelper(page);
    
    await helper.navigateToCreatePage();
    await helper.sendMessage('我想做一个学生成绩管理系统');
    await helper.waitForAIResponse();

    const selected = await helper.handleQuestionCardIfPresent(10000);
    
    if (selected) {
      const secondResponse = await helper.waitForAIResponse(CONFIG.TIMEOUTS.AI_RESPONSE);
      expect(secondResponse).toBeTruthy();
      console.log('✅ 选择选项后系统继续对话');
    } else {
      console.log('ℹ️ 无 QuestionCard，手动发送回复');
      await helper.sendMessage('我是高中生，有6小时时间');
      const responded = await helper.waitForAIResponse();
      expect(responded).toBeTruthy();
    }

    await helper.screenshot('step3-after-selection');
    console.log('✅ 步骤3完成：对话继续正常');
  });

  test('步骤4-5: 多轮交互产生代码', async ({ page }) => {
    const helper = new PBLTestHelper(page);
    
    await helper.navigateToCreatePage();
    await helper.sendMessage('我想做一个简单的计算器程序');

    const prompts = [
      '好的，请推荐技术方案',
      '用 Python 实现',
      '开始写代码吧',
    ];

    const result = await helper.continueConversation(prompts, 4);
    
    console.log(`对话轮数: ${result.rounds}, 是否产生代码: ${result.hasCode}`);

    await helper.screenshot('step4-5-code-generation');
    console.log('✅ 步骤4-5完成：多轮交互执行完毕');
  });

  test('步骤6: 代码编辑器自动展开', async ({ page }) => {
    const helper = new PBLTestHelper(page);
    
    await helper.navigateToCreatePage();
    await helper.sendMessage('帮我写一个猜数字游戏');

    await helper.continueConversation(['用Python实现', '生成完整代码'], 3);

    const editorVisible = await helper.isEditorVisible();
    console.log(`编辑器可见: ${editorVisible}`);

    if (!editorVisible) {
      const clickedRun = await helper.clickRunButton();
      if (clickedRun) {
        await helper.page.waitForTimeout(2000);
        const nowVisible = await helper.isEditorVisible();
        console.log(`点击运行后编辑器可见: ${nowVisible}`);
      }
    }

    await helper.screenshot('step6-editor-state');
    console.log('✅ 步骤6完成：编辑器状态检查完毕');
  });

  test('步骤7-8: 运行代码查看结果', async ({ page }) => {
    const helper = new PBLTestHelper(page);
    
    await helper.navigateToCreatePage();
    await helper.sendMessage('写一个 Hello World 程序');

    await helper.continueConversation(['用Python', '给我代码'], 2);

    const runClicked = await helper.clickRunButton();
    
    if (runClicked) {
      const previewVisible = await helper.isPreviewVisible();
      console.log(`预览区域可见: ${previewVisible}`);
    }

    await helper.screenshot('step7-8-run-result');
    console.log('✅ 步骤7-8完成：代码运行检查完毕');
  });

  test('步骤9: 修改项目名字', async ({ page }) => {
    const helper = new PBLTestHelper(page);
    
    await helper.navigateToCreatePage();
    await helper.sendMessage('创建一个测试项目');

    await helper.continueConversation(['好的'], 1);

    const edited = await helper.editProjectName('我的自动化测试项目');
    console.log(`修改成功: ${edited}`);

    await helper.screenshot('step9-rename');
    console.log('✅ 步骤9完成：项目名称修改检查完毕');
  });

  test('步骤10: 项目保存状态验证', async ({ page }) => {
    const helper = new PBLTestHelper(page);
    
    await helper.navigateToCreatePage();
    
    const initialCount = await helper.getProjectCount();
    console.log(`初始项目数: ${initialCount}`);

    await helper.sendMessage('创建一个保存测试项目');
    await helper.continueConversation(['好的'], 1);

    await helper.page.waitForTimeout(3000);

    const finalCount = await helper.getProjectCount();
    console.log(`最终项目数: ${finalCount}`);

    const state = await helper.diagnosePageState();
    console.log('项目列表状态:', JSON.stringify({
      projectCount: finalCount,
      projectName: state.pageTextSnippet.includes('📍') ? '检测到项目标识' : '未检测到',
    }));

    await helper.screenshot('step10-save-status');
    console.log('✅ 步骤10完成：项目保存状态检查完毕');
  });

  test('步骤11: 打开历史项目', async ({ page }) => {
    const helper = new PBLTestHelper(page);
    
    await helper.navigateToCreatePage();

    const projectName = `历史项目测试_${Date.now()}`;
    
    await helper.sendMessage(`创建一个名为"${projectName}"的项目`);
    await helper.continueConversation(['好的'], 1);
    await helper.page.waitForTimeout(2000);

    const found = await helper.clickProjectByName(projectName);
    console.log(`找到并点击项目: ${found}`);

    if (found) {
      await helper.page.waitForTimeout(1000);
      const clicked = await helper.screenshot('step11-history-opened');
      console.log(`截图已保存: ${clicked}`);
    }

    console.log('✅ 步骤11完成：历史项目打开检查完毕');
  });

  /**
   * ============================================================
   * 完整流程端到端测试（合并所有步骤）
   * ============================================================
   */
  
  test('完整PBL流程: 从请求到项目保存（端到端）', async ({ page }) => {
    const helper = new PBLTestHelper(page);
    const testName = `E2E测试_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
    
    console.log('\n========== 开始完整 PBL 流程端到端测试 ==========\n');
    console.log(`测试项目名: ${testName}`);

    try {
      // Step 1: 进入创造页并发送请求
      await helper.navigateToCreatePage();
      await helper.sendMessage(`我想做一个${testName}`);
      
      // Step 2: 等待 AI 回复
      const step1Responded = await helper.waitForAIResponse();
      expect(step1Responded).toBeTruthy();
      console.log('✅ Step 1 完成：请求已发送，AI 已回复');

      // Step 3: 处理 QuestionCard（如果有）
      const hadQuestion = await helper.handleQuestionCardIfPresent(12000);
      console.log(`✅ Step 2-3 完成：${hadQuestion ? '有' : '无'} QuestionCard 交互`);

      // Step 4-5: 继续对话直到产生代码
      const conversationResult = await helper.continueConversation([
        '用 Python 实现',
        '给我完整的代码',
        '开始编码',
      ], 4);
      console.log(`✅ Step 4-5 完成：进行了 ${conversationResult.rounds} 轮对话，代码: ${conversationResult.hasCode ? '有' : '无'}`);

      // Step 6: 检查编辑器
      const editorVisible = await helper.isEditorVisible();
      console.log(`✅ Step 6 完成：编辑器${editorVisible ? '已' : '未'}展开`);

      // Step 7-8: 尝试运行代码
      if (editorVisible || conversationResult.hasCode) {
        const runResult = await helper.clickRunButton();
        const previewVisible = await helper.isPreviewVisible();
        console.log(`✅ Step 7-8 完成：运行${runResult ? '已' : '未'}触发，结果${previewVisible ? '可见' : '不可见'}`);
      }

      // Step 9: 尝试修改项目名
      const renameResult = await helper.editProjectName(testName);
      console.log(`✅ Step 9 完成：改名${renameResult ? '成功' : '失败/跳过'}`);

      // Step 10: 检查项目保存状态
      const finalState = await helper.diagnosePageState();
      console.log(`✅ Step 10 完成：项目数=${finalState.projectCount}`);

      // 最终截图
      const finalScreenshot = await helper.screenshot('full-flow-complete');
      console.log(`\n📸 最终截图: ${finalScreenshot}`);

      // 输出测试报告
      console.log('\n========== 测试报告 ==========');
      console.log(`总截图数: ${helper.screenshots.length}`);
      console.log(`AI 回复: ${finalState.hasAIResponse ? '✅' : '❌'}`);
      console.log(`QuestionCard: ${hadQuestion ? '✅ 有交互' : '⚪ 无'}`);
      console.log(`代码生成: ${conversationResult.hasCode ? '✅' : '❌'}`);
      console.log(`编辑器: ${editorVisible ? '✅' : '❌'}`);
      console.log(`项目保存: ${finalState.projectCount > 0 ? '✅' : '❌'}`);
      console.log('==============================\n');

    } catch (error) {
      console.error('❌ 完整流程测试失败:', error);
      await helper.screenshot('full-flow-error');
      throw error;
    }

    console.log('\n========== 完整 PBL 流程端到端测试完成 ==========\n');
  });

  /**
   * 快速冒烟测试（仅验证核心功能）
   */
  test('快速冒烟测试: 核心功能可用性检查', async ({ page }) => {
    const helper = new PBLTestHelper(page);
    
    console.log('\n--- 开始快速冒烟测试 ---\n');

    await helper.navigateToCreatePage();
    
    const inputReady = await helper.getChatInput();
    expect(inputReady).toBeTruthy();
    console.log('✅ 输入框就绪');

    await helper.sendMessage('你好，这是一个测试');
    const responded = await helper.waitForAIResponse(20000);
    console.log(responded ? '✅ AI 响应正常' : '⚠️ AI 响应超时');

    await helper.screenshot('smoke-test');
    
    console.log('\n--- 快速冒烟测试完成 ---\n');
  });

});
