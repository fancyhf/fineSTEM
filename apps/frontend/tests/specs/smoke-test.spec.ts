/**
 * 简单的冒烟测试 - 验证 Playwright 基本功能
 */

import { test, expect } from '@playwright/test';

test('简单测试: 页面加载', async ({ page }) => {
  await page.goto('http://localhost:5174/finestem');
  await page.waitForLoadState('networkidle');
  
  const title = await page.title();
  console.log('页面标题:', title);
  
  expect(title).toBeTruthy();
});
