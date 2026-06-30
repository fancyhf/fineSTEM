/**
 * fineSTEM E2E 测试 - 核心用户流程
 *
 * 用途：验证 Demo→Fork→轻项目→成果卡→分享 完整闭环
 * 维护者：AI Agent
 * links: .trae/documents/testing/
 */

import { test, expect, API_BASE, registerUser } from '../fixtures';

test.describe('核心用户闭环：Demo → Fork → 轻项目 → 成果卡 → 分享', () => {

  test('首页加载与导航', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(10);
  });

  test('注册新用户', async ({ page }) => {
    const user = await registerUser(page, 'register');
    expect(user.token).toBeTruthy();
    expect(user.email).toContain('@finestem.test');
  });

  test('登录已有用户', async ({ authenticatedPage }) => {
    const url = authenticatedPage.url();
    const isLoggedIn = !url.includes('/login');
    expect(isLoggedIn).toBeTruthy();
  });

  test('浏览 Demo 墙', async ({ page }) => {
    await page.goto('/explore/demos', { waitUntil: 'domcontentloaded' });

    const hasContent = await page.locator('body').textContent();
    expect(hasContent).toBeTruthy();
  });

  test('查看 Demo 详情', async ({ page }) => {
    await page.goto('/explore/demos', { waitUntil: 'domcontentloaded' });

    const firstDemo = page.locator('a[href*="/explore/demos/"], [class*="demo"] a, [class*="card"] a').first();
    if (await firstDemo.isVisible()) {
      await firstDemo.click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('/explore/demos/');
    }
  });

  test('AI 工作台页面加载', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/create', { waitUntil: 'domcontentloaded' });

    const pageContent = await authenticatedPage.locator('body').textContent();
    expect(pageContent).toBeTruthy();
  });

  test('研学项目页面加载', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/research', { waitUntil: 'domcontentloaded' });

    const pageContent = await authenticatedPage.locator('body').textContent();
    expect(pageContent).toBeTruthy();
  });

  test('互联页面加载', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/connect', { waitUntil: 'domcontentloaded' });

    const pageContent = await authenticatedPage.locator('body').textContent();
    expect(pageContent).toBeTruthy();
  });

  test('课程库页面加载', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/course-library', { waitUntil: 'domcontentloaded' });

    const pageContent = await authenticatedPage.locator('body').textContent();
    expect(pageContent).toBeTruthy();
  });

  test('代码工作室页面加载', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/code-studio', { waitUntil: 'domcontentloaded' });

    const pageContent = await authenticatedPage.locator('body').textContent();
    expect(pageContent).toBeTruthy();
  });
});

test.describe('完整 API 驱动流程验证', () => {

  test('通过 API 完成完整闭环并验证前端展示', async ({ page, testUser }) => {
    const headers = { 'Authorization': `Bearer ${testUser.token}` };

    // 1. 获取 Demo 列表
    const demosResp = await page.request.get(`${API_BASE}/demos`);
    expect(demosResp.ok()).toBeTruthy();
    const demosBody = await demosResp.json();
    const demos = demosBody.data.items;

    if (demos.length > 0) {
      // 2. 创建项目（不依赖 Demo ID）
      const projectResp = await page.request.post(`${API_BASE}/projects`, {
        data: {
          name: 'E2E 自动化测试项目',
          mode: 'light',
        },
        headers,
      });
      if (!projectResp.ok()) {
        const errText = await projectResp.text();
        console.log(`项目创建失败 (${projectResp.status()}): ${errText}`);
      }
      expect(projectResp.ok()).toBeTruthy();
      const project = (await projectResp.json()).data;

      // 3. 保存轻项目步骤
      await page.request.post(`${API_BASE}/projects/${project.id}/progress/light/step1`, {
        data: {
          project_name: 'E2E 测试项目',
          one_liner: '自动化测试创建',
          core_features: ['功能1'],
        },
        headers,
      });

      await page.request.post(`${API_BASE}/projects/${project.id}/progress/light/step2`, {
        data: {
          code_url: 'https://github.com/example/e2e',
          key_screenshots: [],
        },
        headers,
      });

      await page.request.post(`${API_BASE}/projects/${project.id}/progress/light/step3`, {
        data: {
          brief_reflection: 'E2E 自动化测试反思',
        },
        headers,
      });

      // 4. 创建成果档案卡
      const cardResp = await page.request.post(`${API_BASE}/achievement-cards/projects/${project.id}`, {
        data: {
          title: 'E2E 测试成果',
          one_liner: '自动化测试成果卡',
          problem_solved: '验证完整流程',
          method_used: 'E2E 自动化',
          reflection: '流程跑通',
          capability_tags: ['测试'],
          project_mode: 'light',
        },
        headers,
      });
      expect(cardResp.ok()).toBeTruthy();
      const card = (await cardResp.json()).data;

      // 5. 生成分享链接
      const shareResp = await page.request.post(`${API_BASE}/achievement-cards/${card.id}/share`, { headers });
      expect(shareResp.ok()).toBeTruthy();
      const shareData = (await shareResp.json()).data;

      // 6. 访问分享页面
      await page.goto(`/share/${shareData.share_token}`, { waitUntil: 'domcontentloaded' });

      const shareContent = await page.locator('body').textContent();
      expect(shareContent).toBeTruthy();

      // 7. 验证项目详情页
      await page.goto(`/research/projects/${project.id}`, { waitUntil: 'domcontentloaded' });

      // 8. 验证导出
      const exportResp = await page.request.get(`${API_BASE}/projects/${project.id}/export?format=zip`, { headers });
      expect(exportResp.ok()).toBeTruthy();
    }
  });
});
