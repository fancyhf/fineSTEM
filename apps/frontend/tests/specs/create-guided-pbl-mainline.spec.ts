/**
 * fineSTEM E2E 测试 - 引导式 PBL 主链路
 *
 * 用途：验证回答基础三问后，系统会继续进入脑爆/方向/技术建议，而不是重复卡在前三问
 * 维护者：AI Agent
 * links: .trae/documents/testing/
 */

import { test, expect } from '../fixtures';

const QUESTION_TIMEOUT_MS = 25000;
const RESPONSE_TIMEOUT_MS = 45000;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(text: string, phrase: string): number {
  return (text.match(new RegExp(escapeRegExp(phrase), 'g')) || []).length;
}

async function answerQuestionByPreferredLabels(page: Parameters<typeof test>[0]['authenticatedPage'], preferredLabels: string[]) {
  const questionCard = page.locator('div.my-3.rounded-xl').last();
  await expect(questionCard).toBeVisible({ timeout: QUESTION_TIMEOUT_MS });

  const preferredPattern = preferredLabels.length > 0
    ? new RegExp(preferredLabels.map(escapeRegExp).join('|'))
    : null;
  const optionButtons = questionCard.locator('button');
  const optionCount = await optionButtons.count();
  let selected = false;

  for (let index = 0; index < optionCount; index += 1) {
    const button = optionButtons.nth(index);
    const text = (await button.innerText()).trim();
    if (!text || /^(取消|确定|下一步|上一步|其他)$/.test(text)) {
      continue;
    }
    if (preferredPattern && !preferredPattern.test(text)) {
      continue;
    }
    await button.click();
    selected = true;
    break;
  }

  if (!selected) {
    for (let index = 0; index < optionCount; index += 1) {
      const button = optionButtons.nth(index);
      const text = (await button.innerText()).trim();
      if (!text || /^(取消|确定|下一步|上一步|其他)$/.test(text)) {
        continue;
      }
      await button.click();
      selected = true;
      break;
    }
  }

  expect(selected).toBeTruthy();

  const confirmButton = questionCard.getByRole('button', { name: /确定|下一步/ }).last();
  await expect(confirmButton).toBeEnabled({ timeout: 5000 });
  await confirmButton.click();
}

async function waitForPromptInput(page: Parameters<typeof test>[0]['authenticatedPage']) {
  const input = page.locator('textarea[placeholder*="继续对话"], textarea[placeholder*="输入你的目标"]').first();
  await expect(input).toBeVisible({ timeout: 15000 });
  await expect(input).toBeEnabled({ timeout: 15000 });
  return input;
}

test.describe('创造页引导式 PBL 主链路', () => {
  test('回答基础三问后进入方向与技术建议，不再重复问年级和时间', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/create');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    const firstInput = await waitForPromptInput(authenticatedPage);
    await firstInput.fill('我想做一个项目');
    await authenticatedPage.keyboard.press('Enter');

    await answerQuestionByPreferredLabels(authenticatedPage, ['高中', '初中']);
    await answerQuestionByPreferredLabels(authenticatedPage, ['6小时', '2小时', '12小时']);
    await answerQuestionByPreferredLabels(authenticatedPage, ['已经有具体想法', '有个大概方向', '完全没想法，需要脑爆', '继续推荐']);

    const baselineText = await authenticatedPage.locator('body').innerText();
    const gradeQuestionCountBefore = countOccurrences(baselineText, '你现在是哪个年级');
    const timeQuestionCountBefore = countOccurrences(baselineText, '你打算花多长时间完成这个项目');

    const followupInput = await waitForPromptInput(authenticatedPage);
    await followupInput.fill('我想做一个学生成绩管理网页，请先给我三个创意方向，再推荐一个 MVP 方案，并告诉我更适合用 HTML/CSS/JavaScript 还是 Python。');
    await authenticatedPage.keyboard.press('Enter');

    await expect
      .poll(async () => await authenticatedPage.locator('body').innerText(), {
        timeout: RESPONSE_TIMEOUT_MS,
        message: '等待系统进入创意方向与技术建议阶段',
      })
      .toMatch(/创意方向|方向 1|方向1|MVP|技术路线|HTML|JavaScript|Python|学生成绩管理/);

    const finalText = await authenticatedPage.locator('body').innerText();
    const gradeQuestionCountAfter = countOccurrences(finalText, '你现在是哪个年级');
    const timeQuestionCountAfter = countOccurrences(finalText, '你打算花多长时间完成这个项目');

    expect(gradeQuestionCountAfter).toBeLessThanOrEqual(gradeQuestionCountBefore);
    expect(timeQuestionCountAfter).toBeLessThanOrEqual(timeQuestionCountBefore);
    expect(finalText).toMatch(/HTML|JavaScript|Python|技术路线|MVP/);
  });
});
