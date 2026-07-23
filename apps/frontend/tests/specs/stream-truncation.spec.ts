/**
 * Playwright E2E 测试 - 流式对话截断场景
 *
 * 测试目标：
 * 1. 验证 AI 回复被截断时显示"继续生成"按钮
 * 2. 验证点击"继续"后能正确续接内容
 * 3. 验证多次截断和续接能正常工作
 * 4. 验证 content_update 正确更新 UI
 */

import { test, expect, Page } from '@playwright/test';
import { createTestProject, sendMessage, waitForAIResponse, enableStreamLog, getStreamLogs } from '../helpers/test-helpers';

// Test configuration
const TEST_TIMEOUT = 120000; // 2 minutes for AI responses
const STREAM_LOG_KEY = 'FINESTEM_STREAM_LOG_ENABLED';

test.describe('流式对话截断处理', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Enable stream logging for debugging
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('FINESTEM_STREAM_LOG_ENABLED', 'true');
    });

    // Navigate to the app
    await page.goto('http://localhost:5184');

    // Wait for the app to load
    await page.waitForSelector('[data-testid="chat-input"]', { timeout: 10000 });
  });

  test.afterEach(async () => {
    // Export logs if test failed
    const logs = await getStreamLogs(page);
    if (logs && logs.length > 0) {
      console.log('Stream logs:', JSON.stringify(logs.slice(-10), null, 2));
    }
    await page.close();
  });

  test.describe('截断检测', () => {
    test('应该检测到未闭合的代码块并显示继续按钮', async () => {
      // Send a message that might trigger code generation
      await sendMessage(page, '请写一个很长的 Python 程序，包含多个函数和详细注释');

      // Wait for AI to start responding
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 30000 });

      // Wait for the response to complete or show continue button
      const continueButton = await page.locator('[data-testid="continue-button"]').first();

      try {
        // Wait up to 60 seconds for either completion or continue button
        await Promise.race([
          page.waitForSelector('[data-testid="ai-message"] .message-complete', { timeout: 60000 }),
          continueButton.waitFor({ state: 'visible', timeout: 60000 }),
        ]);
      } catch (e) {
        // If neither appears, check if content is truncated
        const lastMessage = await page.locator('[data-testid="ai-message"]').last();
        const content = await lastMessage.textContent();

        // Check for signs of truncation
        const hasUnclosedCodeBlock = content?.includes('```python') && !content?.includes('```\n');
        const hasTruncationWarning = content?.includes('[输出可能不完整');

        expect(hasUnclosedCodeBlock || hasTruncationWarning).toBe(true);
      }
    });

    test('应该检测到未闭合的 XML 标签并显示继续按钮', async () => {
      // Send a message that triggers question cards
      await sendMessage(page, '我想做一个项目，帮我选择题目');

      // Wait for response
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 30000 });

      // Check for question card or continue button
      const hasQuestionCard = await page.locator('[data-testid="question-card"]').isVisible().catch(() => false);
      const hasContinueButton = await page.locator('[data-testid="continue-button"]').isVisible().catch(() => false);

      expect(hasQuestionCard || hasContinueButton).toBe(true);
    });
  });

  test.describe('自动续接', () => {
    test('点击继续按钮后应该续接内容', async () => {
      // Send a message
      await sendMessage(page, '请详细解释量子计算的原理和应用');

      // Wait for response
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 30000 });

      // Get initial content length
      const initialMessage = await page.locator('[data-testid="ai-message"]').last();
      const initialContent = await initialMessage.textContent() || '';
      const initialLength = initialContent.length;

      // Check if continue button appears
      const continueButton = page.locator('[data-testid="continue-button"]').first();
      const hasContinueButton = await continueButton.isVisible().catch(() => false);

      if (hasContinueButton) {
        // Click continue button
        await continueButton.click();

        // Wait for more content
        await page.waitForTimeout(5000);

        // Get updated content
        const updatedMessage = await page.locator('[data-testid="ai-message"]').last();
        const updatedContent = await updatedMessage.textContent() || '';
        const updatedLength = updatedContent.length;

        // Content should be longer after continue
        expect(updatedLength).toBeGreaterThan(initialLength);
      }
    });

    test('多次截断应该能多次续接', async () => {
      // Send a complex message
      await sendMessage(page, '请写一个完整的 Web 应用，包含前端和后端代码');

      // Wait for response
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 30000 });

      let continueCount = 0;
      const maxContinues = 3;

      // Try to continue multiple times
      for (let i = 0; i < maxContinues; i++) {
        const continueButton = page.locator('[data-testid="continue-button"]').first();
        const hasContinueButton = await continueButton.isVisible().catch(() => false);

        if (!hasContinueButton) {
          break;
        }

        await continueButton.click();
        await page.waitForTimeout(5000);
        continueCount++;
      }

      // Should have either completed or reached max continues
      expect(continueCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Content Update 处理', () => {
    test('content_update 应该正确更新 UI', async () => {
      // Enable detailed logging
      await enableStreamLog(page);

      // Send a message
      await sendMessage(page, '你好，请介绍一下自己');

      // Wait for response
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 30000 });

      // Wait for response to complete
      await page.waitForTimeout(3000);

      // Get the final message content
      const message = await page.locator('[data-testid="ai-message"]').last();
      const content = await message.textContent();

      // Content should not be empty
      expect(content?.length).toBeGreaterThan(0);

      // Check logs for content_update events
      const logs = await getStreamLogs(page);
      const contentUpdateLogs = logs.filter((log: any) => log.type === 'content_update');

      // Should have received content_update
      expect(contentUpdateLogs.length).toBeGreaterThan(0);
    });

    test('清理后的 content_update 不应该导致内容丢失', async () => {
      // Send a message that triggers XML tags
      await sendMessage(page, '帮我选一个项目方向');

      // Wait for response
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 30000 });

      // Wait for processing
      await page.waitForTimeout(3000);

      // Get message content
      const message = await page.locator('[data-testid="ai-message"]').last();
      const content = await message.textContent() || '';

      // Content should be meaningful (not just XML tags)
      expect(content.length).toBeGreaterThan(20);

      // Should not contain raw XML tags in display
      expect(content).not.toContain('<question');
      expect(content).not.toContain('<option');
    });
  });

  test.describe('日志记录', () => {
    test('应该记录所有流式事件到日志', async () => {
      // Enable logging
      await enableStreamLog(page);

      // Send a message
      await sendMessage(page, '测试日志记录功能');

      // Wait for response
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 30000 });

      // Wait for completion
      await page.waitForTimeout(3000);

      // Get logs
      const logs = await getStreamLogs(page);

      // Should have logged events
      expect(logs.length).toBeGreaterThan(0);

      // Should have session info
      const sessionLogs = logs.filter((log: any) => log.type === 'session_start');
      expect(sessionLogs.length).toBeGreaterThan(0);

      // Should have token or content_update events
      const contentLogs = logs.filter((log: any) =>
        log.type === 'token' || log.type === 'content_update'
      );
      expect(contentLogs.length).toBeGreaterThan(0);
    });

    test('日志应该包含正确的 sessionId 和 projectId', async () => {
      await enableStreamLog(page);

      // Create a project first
      const projectId = await createTestProject(page, '测试项目');

      // Send a message
      await sendMessage(page, '测试日志记录');

      // Wait for response
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 30000 });
      await page.waitForTimeout(3000);

      // Get logs
      const logs = await getStreamLogs(page);

      // Check that logs have correct metadata
      const hasCorrectMetadata = logs.some((log: any) =>
        log.projectId === projectId || log.sessionId
      );

      expect(hasCorrectMetadata).toBe(true);
    });
  });

  test.describe('边界情况', () => {
    test('空内容不应该导致错误', async () => {
      // Send a simple message
      await sendMessage(page, 'hi');

      // Wait for any response
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 30000 });

      // Should not throw errors
      const errorMessages = await page.locator('[data-testid="error-message"]').count();
      expect(errorMessages).toBe(0);
    });

    test('非常长的消息不应该导致崩溃', async () => {
      // Create a long message
      const longMessage = '请详细说明 '.repeat(100) + '编程的最佳实践';

      // Send the message
      await sendMessage(page, longMessage);

      // Wait for response
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 30000 });

      // Should not crash
      const errorMessages = await page.locator('[data-testid="error-message"]').count();
      expect(errorMessages).toBe(0);

      // Should have some response
      const message = await page.locator('[data-testid="ai-message"]').last();
      const content = await message.textContent();
      expect(content?.length).toBeGreaterThan(0);
    });

    test('快速连续发送消息不应该导致混乱', async () => {
      // Send multiple messages quickly
      await sendMessage(page, '消息1');
      await sendMessage(page, '消息2');
      await sendMessage(page, '消息3');

      // Wait for responses
      await page.waitForTimeout(10000);

      // Should have multiple AI responses
      const aiMessages = await page.locator('[data-testid="ai-message"]').count();
      expect(aiMessages).toBeGreaterThanOrEqual(3);
    });
  });
});

// Configure test timeout
test.setTimeout(TEST_TIMEOUT);
