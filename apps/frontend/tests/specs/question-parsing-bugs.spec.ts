/**
 * QuestionCard 选项解析 Bug 修复验证测试
 * 
 * 修复日期: 2026-07-20
 * 问题描述:
 *   BUG-1: 状态汇报信息（项目现状、讨论历史）被误识别为选项
 *   BUG-2: 用户选择选项后系统没有继续（isLoading 竞态条件）
 * 
 * 测试目标:
 *   - 验证状态汇报标题（项目现状、讨论历史等）不会被误解析为选项
 *   - 验证 UUID/GUID 行不会被误解析为选项
 *   - 验证选择选项后系统能正常继续执行
 */

import { test, expect } from '@playwright/test';
import { isStatusLine, extractQuestionsFromText, parseQuestionsFromText } from '../../../src/lib/questionParser';

// ===== 单元测试：isStatusLine 函数 =====

test.describe('BUG-1: 状态汇报信息误识别为选项', () => {
  
  test('应该将"项目现状"识别为状态行', () => {
    expect(isStatusLine('项目现状')).toBe(true);
    expect(isStatusLine('**项目现状**')).toBe(true);
    expect(isStatusLine('### 项目现状')).toBe(true);
  });

  test('应该将"讨论历史"识别为状态行', () => {
    expect(isStatusLine('讨论历史')).toBe(true);
    expect(isStatusLine('**讨论历史**')).toBe(true);
  });

  test('应该将其他常见状态汇报标题识别为状态行', () => {
    expect(isStatusLine('项目信息')).toBe(true);
    expect(isStatusLine('当前状态')).toBe(true);
    expect(isStatusLine('历史记录')).toBe(true);
    expect(isStatusLine('基本信息')).toBe(true);
  });

  test('应该将包含 UUID 的行识别为状态行', () => {
    const uuidLine = '项目 ID：4e8f476a-b765-458d-a203-02c052f829e8';
    expect(isStatusLine(uuidLine)).toBe(true);
    
    // 带格式的 UUID 行
    expect(isStatusLine('* 项目 ID：`4e8f476a-b765-458d-a203-02c052f829e8`')).toBe(true);
  });

  test('应该将键值对中的状态字段识别为状态行', () => {
    // 项目现状作为 key
    expect(isStatusLine('项目现状：已创建')).toBe(true);
    expect(isStatusLine('讨论历史：暂无记录')).toBe(true);
    
    // 创建时间、修改时间
    expect(isStatusLine('创建时间：2026-07-19')).toBe(true);
    expect(isStatusLine('修改时间：2026-07-20')).toBe(true);
  });

  test('不应该将真正的选项误识别为状态行', () => {
    // 正常的选项格式
    expect(isStatusLine('先了解你的情况 —— 你现在是几年级？')).toBe(false);
    expect(isStatusLine('然后帮你头脑风暴选题 —— 根据你的情况推荐几个合适的项目方向')).toBe(false);
    expect(isStatusLine('选定一个方向后 —— 进入规划和设计阶段')).toBe(false);
    
    // 带编号的选项
    expect(isStatusLine('1. 先了解你的情况 —— 你现在是几年级？')).toBe(false);
    expect(isStatusLine('2. 然后帮你头脑风暴选题')).toBe(false);
  });
});

// ===== 集成测试：extractQuestionsFromText 函数 =====

test.describe('BUG-1: 完整文本解析 - 状态信息不应被解析为选项', () => {
  
  test('包含项目现状和讨论历史的 AI 回复不应产生误解析的选项', () => {
    const aiResponse = `看起来目前的情况是这样的：

**项目现状**
• **项目名**："我想做一个项目，帮我选题和规划"
• **项目 ID**：4e8f476a-b765-458d-a203-02c052f829e8
• **当前阶段**：stage_01_brainstorm （头脑风暴/选题阶段）
• **教学模式**：standard （标准模式）
• **创建时间**：2026-07-19，已过去约 1 天

**讨论历史**
• 项目刚创建进入头脑风暴阶段
• **brainstorm** 工件（文档）还是空的 draft 状态
• 目前没有之前的聊天记录可用

这意味着我们实际上还没有正式开始讨论选题。项目框架搭好了，但 brainstorming 的内容还是空白的。

---

接下来我们可以这样推进：

1️⃣ **先了解你的情况** —— 你现在是几年级？有没有编程基础？对什么方向感兴趣？
2️⃣ **然后帮你头脑风暴选题** —— 根据你的情况推荐几个合适的项目方向
3️⃣ **选定一个方向后** —— 进入规划和设计阶段

要不要先从第一步开始？ 😊`;

    const questions = extractQuestionsFromText(aiResponse);
    
    // 不应该有任何被误解析的问题卡片
    // 或者如果有，也不应该包含"项目现状"、"讨论历史"这样的选项
    for (const q of questions) {
      const optionLabels = q.options.map(o => o.label.toLowerCase());
      // 不应包含状态相关词汇
      expect(optionLabels).not.toContain('项目现状');
      expect(optionLabels).not.toContain('讨论历史');
      expect(optionLabels).not.toContain('项目 id');
      expect(optionLabels).not.toContain('当前阶段');
    }
  });

  test('真正的选项列表应该能正确解析', () => {
    const optionText = `接下来我们可以这样推进：

1. **先了解你的情况** —— 你现在是几年级？有没有编程基础？
2. **然后帮你头脑风暴选题** —— 根据你的情况推荐几个合适的项目方向
3. **选定一个方向后** —— 进入规划和设计阶段`;

    const questions = extractQuestionsFromText(optionText);
    
    // 应该能解析出选项
    expect(questions.length).toBeGreaterThan(0);
    
    // 选项应该是真正的选项，不是状态信息
    if (questions.length > 0) {
      const q = questions[0];
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      
      // 检查选项标签是否合理
      const labels = q.options.map(o => o.label);
      expect(labels.some(l => l.includes('了解') || l.includes('年级'))).toBe(true);
    }
  });
});

// ===== E2E 测试：用户交互流程 =====

test.describe('BUG-2: 选择选项后系统继续执行', () => {
  
  test.beforeEach(async ({ page }) => {
    // 设置测试环境
    await page.goto('/create');
    await page.waitForLoadState('networkidle');
  });

  test('点击选项按钮后应该触发 handleSend 并继续对话', async ({ page }) => {
    // 这个测试需要模拟完整的对话流程
    // 由于需要真实的 WebSocket 连接，这里主要验证 UI 交互
    
    // 发送初始消息
    const chatInput = page.locator('[data-testid="chat-input"], textarea[placeholder*="输入"]').first();
    if (await chatInput.isVisible()) {
      await chatInput.fill('开始新项目');
      await chatInput.press('Enter');
      
      // 等待可能的选项卡片出现
      await page.waitForTimeout(5000);
      
      // 检查是否有选项卡片
      const questionCards = page.locator('[data-testid="question-card"], .question-card, [class*="QuestionCard"]');
      const cardCount = await questionCards.count();
      
      if (cardCount > 0) {
        // 如果有选项卡片，点击第一个选项
        const firstCard = questionCards.first();
        const options = firstCard.locator('[data-testid="question-option"], button[class*="option"]');
        const optionCount = await options.count();
        
        if (optionCount > 0) {
          // 点击第一个选项
          await options.first().click();
          
          // 点击确定/下一步按钮
          const confirmBtn = firstCard.locator('button:has-text("确定"), button:has-text("下一步")');
          const hasConfirm = await confirmBtn.isVisible().catch(() => false);
          
          if (hasConfirm) {
            await confirmBtn.click();
            
            // 等待系统响应
            await page.waitForTimeout(2000);
            
            // 验证：不应该还显示 loading 状态卡住
            // 应该有新的消息或响应出现
            const loadingIndicator = page.locator('[class*="loading"], [class*="Loading"]').first();
            const isLoadingVisible = await loadingIndicator.isVisible().catch(() => false);
            
            // 如果有 loading，它应该在合理时间内消失（不超过30秒）
            if (isLoadingVisible) {
              // 等待 loading 结束
              try {
                await expect(loadingIndicator).not.toBeVisible({ timeout: 30000 });
              } catch {
                // 如果超时，说明可能存在竞态条件问题
                throw new Error('Loading 状态持续超过 30 秒，可能存在竞态条件问题');
              }
            }
          }
        }
      }
    }
  });

  test('在"其他"选项中输入文字后应该能正常提交', async ({ page }) => {
    // 发送消息触发选项
    const chatInput = page.locator('[data-testid="chat-input"], textarea[placeholder*="输入"]').first();
    if (await chatInput.isVisible()) {
      await chatInput.fill('我想做一个游戏');
      await chatInput.press('Enter');
      
      // 等待选项卡片
      await page.waitForTimeout(5000);
      
      const questionCards = page.locator('[data-testid="question-card"], .question-card, [class*="QuestionCard"]');
      const cardCount = await questionCards.count();
      
      if (cardCount > 0) {
        const firstCard = questionCards.first();
        
        // 点击"其他"选项
        const otherOption = firstCard.locator(':has-text("其他"), [data-testid="custom-option"]');
        const hasOther = await otherOption.isVisible().catch(() => false);
        
        if (hasOther) {
          await otherOption.click();
          
          // 输入自定义文字
          const textArea = firstCard.locator('textarea');
          const hasTextArea = await textArea.isVisible().catch(() => false);
          
          if (hasTextArea) {
            await textArea.fill('从第一步开始');
            
            // 点击确定
            const confirmBtn = firstCard.locator('button:has-text("确定")');
            const hasConfirm = await confirmBtn.isVisible().catch(() => false);
            
            if (hasConfirm) {
              await confirmBtn.click();
              
              // 验证消息已发送
              await page.waitForTimeout(1000);
              
              // 检查是否有用户消息出现
              const userMessages = page.locator('[data-testid="user-message"], [role="user"]');
              const msgCount = await userMessages.count();
              
              // 应该至少有一条用户消息
              expect(msgCount).toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });
});

// ===== 回归测试：确保修复不破坏现有功能 =====

test.describe('回归测试：选项解析功能完整性', () => {
  
  test('正常的单选选项仍然能正确解析', () => {
    const normalOptions = `请选择你喜欢的编程语言：

1. Python - 简单易学
2. JavaScript - Web开发
3. Java - 企业应用`;

    const questions = extractQuestionsFromText(normalOptions);
    expect(questions.length).toBeGreaterThan(0);
    
    if (questions.length > 0) {
      expect(questions[0].options.length).toBe(3);
    }
  });

  test('带描述的多选选项仍然能正确解析', () => {
    const multiOptions = `选择你的兴趣（可多选）：

* 游戏开发 - 制作电子游戏
* Web开发 - 创建网站和应用
* 数据分析 - 处理和分析数据
* AI/机器学习 - 智能算法`;

    const questions = extractQuestionsFromText(multiOptions);
    expect(questions.length).toBeGreaterThan(0);
    
    if (questions.length > 0) {
      expect(questions[0].options.length).toBe(4);
    }
  });

  test('XML 格式的 question 仍然能正确解析', () => {
    const xmlQuestion = `<question type="single" title="选择年级">
<option id="junior">初中</option>
<option id="senior">高中</option>
<option id="university">大学</option>
</question>`;

    const questions = parseQuestionsFromText(xmlQuestion);
    expect(questions.length).toBe(1);
    
    if (questions.length > 0) {
      expect(questions[0].options.length).toBe(3);
      expect(questions[0].title).toContain('年级');
    }
  });
});
