/**
 * Playwright 测试辅助函数
 */

import { Page } from '@playwright/test';

/**
 * 发送消息到聊天输入框
 */
export async function sendMessage(page: Page, message: string): Promise<void> {
  const input = page.locator('[data-testid="chat-input"]');
  await input.fill(message);

  const sendButton = page.locator('[data-testid="send-button"]');
  await sendButton.click();
}

/**
 * 等待 AI 响应完成
 */
export async function waitForAIResponse(page: Page, timeout: number = 60000): Promise<string> {
  // Wait for AI message to appear
  await page.waitForSelector('[data-testid="ai-message"]', { timeout });

  // Wait for loading to complete
  await page.waitForSelector('[data-testid="ai-loading"]', { state: 'detached', timeout }).catch(() => {
    // Loading indicator might not exist
  });

  // Get the last AI message content
  const messages = await page.locator('[data-testid="ai-message"]').all();
  if (messages.length === 0) {
    throw new Error('No AI message found');
  }

  const lastMessage = messages[messages.length - 1];
  return await lastMessage.textContent() || '';
}

/**
 * 创建测试项目
 */
export async function createTestProject(page: Page, name: string): Promise<string> {
  // Click create project button
  const createButton = page.locator('[data-testid="create-project-button"]');
  await createButton.click();

  // Fill project name
  const nameInput = page.locator('[data-testid="project-name-input"]');
  await nameInput.fill(name);

  // Submit
  const submitButton = page.locator('[data-testid="submit-project-button"]');
  await submitButton.click();

  // Wait for project to be created and return ID from URL
  await page.waitForURL(/\/create\?projectId=/, { timeout: 10000 });

  const url = page.url();
  const match = url.match(/projectId=([^&]+)/);
  return match ? match[1] : '';
}

/**
 * 启用流式日志记录
 */
export async function enableStreamLog(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('FINESTEM_STREAM_LOG_ENABLED', 'true');
  });
}

/**
 * 禁用流式日志记录
 */
export async function disableStreamLog(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('FINESTEM_STREAM_LOG_ENABLED', 'false');
  });
}

/**
 * 获取流式日志
 */
export async function getStreamLogs(page: Page): Promise<any[]> {
  return await page.evaluate(() => {
    // Access the streamLogger from the window object
    const logger = (window as any).streamLogger;
    if (logger && logger.getLogs) {
      return logger.getLogs();
    }
    return [];
  });
}

/**
 * 清除流式日志
 */
export async function clearStreamLogs(page: Page): Promise<void> {
  await page.evaluate(() => {
    const logger = (window as any).streamLogger;
    if (logger && logger.clear) {
      logger.clear();
    }
  });
}

/**
 * 等待指定时间
 */
export async function waitForTimeout(page: Page, ms: number): Promise<void> {
  await page.waitForTimeout(ms);
}

/**
 * 检查是否存在继续按钮
 */
export async function hasContinueButton(page: Page): Promise<boolean> {
  const button = page.locator('[data-testid="continue-button"]').first();
  return await button.isVisible().catch(() => false);
}

/**
 * 点击继续按钮
 */
export async function clickContinueButton(page: Page): Promise<void> {
  const button = page.locator('[data-testid="continue-button"]').first();
  await button.click();
}

/**
 * 获取最后一条 AI 消息的内容
 */
export async function getLastAIMessageContent(page: Page): Promise<string> {
  const messages = await page.locator('[data-testid="ai-message"]').all();
  if (messages.length === 0) {
    return '';
  }
  const lastMessage = messages[messages.length - 1];
  return await lastMessage.textContent() || '';
}

/**
 * 获取所有 AI 消息的数量
 */
export async function getAIMessageCount(page: Page): Promise<number> {
  return await page.locator('[data-testid="ai-message"]').count();
}

/**
 * 检查是否存在问题卡片
 */
export async function hasQuestionCard(page: Page): Promise<boolean> {
  const card = page.locator('[data-testid="question-card"]').first();
  return await card.isVisible().catch(() => false);
}

/**
 * 选择问题卡片的选项
 */
export async function selectQuestionOption(page: Page, optionId: string): Promise<void> {
  const option = page.locator(`[data-testid="question-option-${optionId}"]`);
  await option.click();
}

/**
 * 导出日志到文件（用于调试）
 */
export async function exportLogs(page: Page): Promise<void> {
  await page.evaluate(() => {
    const logger = (window as any).streamLogger;
    if (logger && logger.exportToFile) {
      logger.exportToFile();
    }
  });
}

/**
 * 模拟网络延迟
 */
export async function simulateNetworkDelay(page: Page, delayMs: number): Promise<void> {
  await page.route('**/*', async (route) => {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    await route.continue();
  });
}

/**
 * 恢复网络
 */
export async function restoreNetwork(page: Page): Promise<void> {
  await page.unroute('**/*');
}

/**
 * 检查页面是否有错误
 */
export async function hasErrors(page: Page): Promise<boolean> {
  const errorCount = await page.locator('[data-testid="error-message"]').count();
  return errorCount > 0;
}

/**
 * 获取页面错误信息
 */
export async function getErrorMessages(page: Page): Promise<string[]> {
  const errors = await page.locator('[data-testid="error-message"]').all();
  const messages: string[] = [];
  for (const error of errors) {
    const text = await error.textContent();
    if (text) {
      messages.push(text);
    }
  }
  return messages;
}
