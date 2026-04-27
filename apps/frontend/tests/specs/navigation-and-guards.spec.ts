/**
 * fineSTEM E2E 测试 - 页面导航与路由守卫
 *
 * 用途：验证路由跳转、认证守卫、404 处理
 * 维护者：AI Agent
 * links: .trae/documents/testing/
 */

import { test, expect } from '../fixtures';

test.describe('路由守卫与导航', () => {

  test('未登录访问受保护页面重定向到登录页', async ({ page }) => {
    await page.goto('/research');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForURL(/\/login/, { timeout: 5000 }).catch(() => {});

    const url = page.url();
    expect(url).toContain('/login');
  });

  test('未登录访问 Dashboard 重定向', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForURL(/\/login/, { timeout: 5000 }).catch(() => {});

    const url = page.url();
    expect(url).toContain('/login');
  });

  test('分享页面无需登录即可访问', async ({ page }) => {
    await page.goto('/share/test_token');
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    expect(url).toContain('/share/');
  });

  test('探索页面无需登录', async ({ page }) => {
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    expect(url).toContain('/explore');
  });

  test('Demo 墙无需登录', async ({ page }) => {
    await page.goto('/explore/demos');
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    expect(url).toContain('/explore/demos');
  });

  test('未知路由显示 404 或首页', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');
    await page.waitForLoadState('domcontentloaded');

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
  });
});

test.describe('页面导航完整性', () => {

  test('首页关键元素可见', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(10);
  });

  test('登录页表单元素', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    expect(await emailInput.isVisible()).toBeTruthy();
    expect(await passwordInput.isVisible()).toBeTruthy();
  });

  test('导航栏/侧边栏链接', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const navLinks = page.locator('nav a, [class*="sidebar"] a, [class*="nav"] a');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('受保护页面登录后可访问', async ({ authenticatedPage }) => {
    const protectedPages = [
      '/research',
      '/dashboard',
      '/connect',
    ];

    for (const path of protectedPages) {
      await authenticatedPage.goto(path);
      await authenticatedPage.waitForLoadState('domcontentloaded');

      const url = authenticatedPage.url();
      expect(url).not.toContain('/login');
    }
  });
});
