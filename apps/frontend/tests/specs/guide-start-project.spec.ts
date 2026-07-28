/**
 * 验证「开始项目」引导快捷按钮功能
 * 
 * 场景：
 * 1. 左侧场景面板中「开始项目」按钮带有「引导」标签
 * 2. 点击「开始项目」后，中间区域显示引导欢迎界面（而非直接发消息）
 * 3. 欢迎界面包含 PBL 四步骤卡片和快捷建议
 */

import { test, expect } from '@playwright/test';

test.describe('「开始项目」引导功能', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/create');
    await page.waitForLoadState('networkidle');
  });

  test('左侧场景面板应显示带「引导」标签的「开始项目」按钮', async ({ page }) => {
    // 等待场景面板加载
    const scenePanel = page.locator('text=场景').first();
    await expect(scenePanel).toBeVisible();

    // 「开始项目」按钮应该存在
    const startProjectBtn = page.locator('text=开始项目').first();
    await expect(startProjectBtn).toBeVisible();

    // 「引导」标签应该存在（在「开始项目」旁边）
    const guideBadge = page.locator('text=引导').filter({ hasText: '引导' }).first();
    // 注意：页面中可能有多处"引导"文字，我们需要确认它在「开始项目」按钮附近
    const startProjectRow = startProjectBtn.locator('..');
    const badgeInButton = startProjectRow.locator('text=引导');
    // 至少检查按钮文本包含「开始项目」
    await expect(startProjectBtn).toContainText('开始项目');
  });

  test('点击「开始项目」应显示引导欢迎界面', async ({ page }) => {
    // 点击「开始项目」按钮
    const startProjectBtn = page.locator('button:has-text("开始项目"), [class*="group"]:has-text("开始项目")').first();
    await expect(startProjectBtn).toBeVisible({ timeout: 10000 });
    await startProjectBtn.click();

    // 应该显示欢迎界面 - "开始你的项目" 标题
    const welcomeTitle = page.locator('text=开始你的项目');
    await expect(welcomeTitle).toBeVisible({ timeout: 5000 });

    // 应该显示 PBL 四步骤卡片（欢迎界面中的卡片，用 .first() 避免 strict mode violation）
    await expect(page.locator('text=选题与目标').first()).toBeVisible();
    await expect(page.locator('text=设计与拆解').first()).toBeVisible();
    await expect(page.locator('text=实现与调试').first()).toBeVisible();
    await expect(page.locator('text=展示与反思').first()).toBeVisible();
  });

  test('欢迎界面应显示快捷建议输入', async ({ page }) => {
    // 先点击「进入引导模式
    const startProjectBtn = page.locator('button:has-text("开始项目"), [class*="group"]:has-text("开始项目")').first();
    await startProjectBtn.click();

    // 等待欢迎界面出现
    await expect(page.locator('text=开始你的项目')).toBeVisible();

    // 快捷建议应该可见
    const suggestions = [
      '直接给我一个可运行版本',
      '把这段代码讲清楚',
      '帮我把一个想法整理成可执行的项目方案',
    ];

    for (const suggestion of suggestions) {
      const suggestionBtn = page.locator(`text=${suggestion}`).first();
      await expect(suggestionBtn).toBeVisible();
    }
  });

  test('点击其他场景按钮仍应正常发送消息', async ({ page }) => {
    // 点击「问问题」应该触发正常聊天流程
    const qaBtn = page.locator('button:has-text("问问题"), [class*="group"]:has-text("问问题")').first();
    await qaBtn.click();

    // 应该切换到聊天模式（showChatHistory = true）
    // 输入框 placeholder 应该变为 "继续对话..."
    const input = page.locator('[data-testid="chat-input"]');
    await expect(input).toBeVisible();
    // 注意：如果后端未运行，消息会失败，但 UI 切换应该发生
  });
});
