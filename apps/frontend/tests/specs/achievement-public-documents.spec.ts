/**
 * fineSTEM E2E 测试 - 公开成果卡过程文档
 *
 * 用途：验证匿名访客可阅读九份过程文档，空态不影响现有成果卡操作
 * 维护者：AI Agent
 * links: .trae/documents/testing/
 */

import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';

const CARD_ID = 'card-public-documents';
const DOCUMENT_NAMES = [
  '头脑风暴',
  '开题立项',
  '范围裁剪',
  '轨道选择',
  '设计蓝图',
  '分步计划',
  '开发日志',
  '验收评估',
  '讲解文档',
];

async function mockCard(page: Page) {
  await page.route(`**/api/v1/achievement-cards/${CARD_ID}`, async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          id: CARD_ID,
          project_id: 'project-internal',
          author_id: 'author-internal',
          title: '生态岛公开项目',
          one_liner: '公开过程文档回归',
          problem_solved: '问题',
          method_used: '方法',
          screenshots: [],
          reflection: '反思',
          capability_tags: [],
          project_mode: 'standard',
          is_public: true,
          visibility: 'wall',
          created_at: '2026-11-05T00:00:00Z',
          updated_at: '2026-11-05T00:00:00Z',
          created_by: 'author-internal',
        },
      },
    });
  });
}

test.describe('公开成果卡过程文档', () => {
  test('匿名打开公开主页即可看到文档并阅读 Markdown 全文', async ({ page }) => {
    await mockCard(page);
    await page.route(`**/api/v1/documents/public/${CARD_ID}`, async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: DOCUMENT_NAMES.map((name, index) => ({
            stage: index === 8 ? 'explanation' : `stage_0${index + 1}`,
            name,
            filename: `${index}.md`,
            has_content: true,
            summary: `${name}摘要`,
            content: `# ${name}\n\n${name}完整正文标记`,
            content_length: 20,
          })),
        },
      });
    });

    await page.goto(`/explore/inspiration/${CARD_ID}`);
    await expect(page.getByTestId('public-project-sidebar').getByTestId('public-process-documents')).toBeVisible();
    await expect(page.getByRole('button', { name: '文档', exact: true })).toHaveCount(0);

    await expect(page.getByTestId('process-document-list').locator('button')).toHaveCount(9);
    await page.getByRole('button', { name: /头脑风暴摘要/ }).click();
    await expect(page.getByTestId('document-viewer-content')).toContainText('头脑风暴完整正文标记');
    await expect(page.getByTestId('document-viewer-content').locator('h1')).toHaveText('头脑风暴');

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('document-viewer-modal')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '我也做一个' })).toBeVisible();
    await expect(page.getByRole('button', { name: '保存到我的项目' })).toBeVisible();
  });

  test('文档为空时显示空态且保留成果卡内容', async ({ page }) => {
    await mockCard(page);
    await page.route(`**/api/v1/documents/public/${CARD_ID}`, async (route) => {
      await route.fulfill({ json: { success: true, data: [] } });
    });

    await page.goto(`/explore/inspiration/${CARD_ID}`);
    await expect(page.getByTestId('public-project-sidebar').getByTestId('public-process-documents')).toBeVisible();
    await expect(page.getByRole('button', { name: '文档', exact: true })).toHaveCount(0);

    await expect(page.getByTestId('public-process-documents')).toContainText('该项目未沉淀过程文档');
    await expect(page.getByText('生态岛公开项目', { exact: true })).toBeVisible();
  });
});
