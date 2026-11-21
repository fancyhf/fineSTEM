/**
 * fineSTEM E2E 测试 - 数字人导师「小知」（语音聊天）
 *
 * 产品模型（2026-11-06 晚定调 + 2026-11-07 验收补充）：
 *   小知是聊天界面的化身，不是独立悬浮组件。两个聊天入口都支持语音：
 *   ① 首页智能对话区：全身立绘在输入框左侧，可点击进语音模式 + 🎤按住说话
 *   ② /create 聊天框：头部形象（口型/表情状态机）可点击进语音模式 + 🎤按住说话
 *   小知先说话：进站首次手势她主动打招呼（TTS 朗读）；朗读期间底部"正在说话"胶囊。
 *
 * 覆盖：首页/Click 立绘与麦克风、点击小知进语音模式（listening/友好降级）、
 * 先说话打招呼（真实 TTS）、朗读开关、真实 ZeroClaw 对话与回复朗读。
 * 麦克风识别（ASR）依赖百炼配额（本地 key 免费额度耗尽 403），不做真实录音识别。
 *
 * 运行（服务依赖：前端 5184 + 后端 3200 + ZeroClaw 42617）：
 *   RUN_AI_E2E=1 npx playwright test companion-xiaozhi --project=chromium
 */

import { test, expect } from '../fixtures';

const HOME_COMPANION = '[data-testid="home-companion"]';
const HOME_COMPANION_BUTTON = '[data-testid="home-companion-button"]';
const HOME_MIC = '[data-testid="home-mic"]';
const CREATE_BAR = '[data-testid="create-companion-bar"]';
const CREATE_COMPANION_BUTTON = '[data-testid="create-companion-button"]';
const CREATE_MIC = '[data-testid="chat-mic"]';
const VOICE_TOGGLE = '[data-testid="companion-voice-toggle"]';
const CAPSULE = '[data-testid="companion-speaking-capsule"]';
const VOICE_FLAG_KEY = 'finestem_companion_voice_on';
const GREET_KEY = 'finestem_companion_greeted';
const FRIENDLY_ERROR_RE = /麦克风|没检测到|启动失败|没录到|没听清|暂时不可用|先打字|超时/;

test.describe('首页智能对话区：小知立绘 + 点击说话 + 麦克风', () => {
  test('小知全身立绘站在输入框左侧，可点击说话，麦克风按钮可见', async ({ authenticatedPage: page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const character = page.locator(`${HOME_COMPANION} svg.companion-character`);
    await expect(character).toBeVisible({ timeout: 15000 });
    expect(await character.getAttribute('aria-label')).toContain('全身');
    // 点击小知进语音模式 + 按住说话麦克风
    await expect(page.locator(HOME_COMPANION_BUTTON)).toBeVisible();
    await expect(page.locator(HOME_MIC)).toBeVisible();
    await expect(page.locator(HOME_COMPANION)).toContainText('点我说话');
  });

  test('点击小知进入语音模式：开始听或给友好错误（无麦克风降级）', async ({ authenticatedPage: page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(HOME_COMPANION_BUTTON)).toBeVisible({ timeout: 15000 });
    await page.locator(HOME_COMPANION_BUTTON).click();
    // headless 无麦克风：要么进入 listening（在听呢），要么出现友好错误
    await expect
      .poll(async () => {
        const status = await page.locator(HOME_COMPANION).innerText();
        if (status.includes('在听呢')) return 'listening';
        const err = await page.getByText(FRIENDLY_ERROR_RE).count();
        return err > 0 ? 'error' : '';
      }, { timeout: 10000, interval: 800 })
      .not.toBe('');
  });

  test('无麦克风权限时给友好提示（按住麦克风降级不崩）', async ({ authenticatedPage: page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator(HOME_MIC).dispatchEvent('pointerdown');
    await page.waitForTimeout(1500);
    await page.locator(HOME_MIC).dispatchEvent('pointerup');
    await expect(page.getByText(FRIENDLY_ERROR_RE).first()).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Create 聊天框：小知形象条 + 点击说话 + 朗读开关', () => {
  test('聊天区头部是小知的可视形象，可点击说话，麦克风与朗读开关齐全', async ({ authenticatedPage: page }) => {
    await page.goto('/create', { waitUntil: 'domcontentloaded' });
    const bar = page.locator(CREATE_BAR);
    await expect(bar).toBeVisible({ timeout: 20000 });
    await expect(bar.locator('svg.companion-character')).toBeVisible();
    await expect(bar).toContainText('小知');
    await expect(page.locator('[data-testid="companion-status"]')).toContainText('点我说话');
    await expect(page.locator(CREATE_COMPANION_BUTTON)).toBeVisible();
    // 常驻立绘（宽屏 xl）：一直站在页面上的全身小知，轻晃+口型
    await expect(page.locator('[data-testid="create-companion-rail-button"] svg')).toBeVisible();
    await expect(page.locator(CREATE_MIC)).toBeVisible();
    await expect(page.locator(VOICE_TOGGLE)).toHaveAttribute('title', '关闭语音朗读');
    expect(await page.evaluate((k) => sessionStorage.getItem(k), VOICE_FLAG_KEY)).toBe('1');
  });

  test('点击小知进入语音模式：开始听或给友好错误（无麦克风降级）', async ({ authenticatedPage: page }) => {
    await page.goto('/create', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(CREATE_COMPANION_BUTTON)).toBeVisible({ timeout: 20000 });
    await page.locator(CREATE_COMPANION_BUTTON).click();
    await expect
      .poll(async () => {
        const status = await page.locator('[data-testid="companion-status"]').innerText();
        if (status.includes('在听呢')) return 'listening';
        const err = await page.getByText(FRIENDLY_ERROR_RE).count();
        return err > 0 ? 'error' : '';
      }, { timeout: 10000, interval: 800 })
      .not.toBe('');
  });

  test('朗读开关切换会话标记（开→关→开）', async ({ authenticatedPage: page }) => {
    await page.goto('/create', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(CREATE_BAR)).toBeVisible({ timeout: 20000 });
    await page.locator(VOICE_TOGGLE).click();
    await expect(page.locator(VOICE_TOGGLE)).toHaveAttribute('title', '开启语音朗读');
    expect(await page.evaluate((k) => sessionStorage.getItem(k), VOICE_FLAG_KEY)).toBe('0');
    await page.locator(VOICE_TOGGLE).click();
    await expect(page.locator(VOICE_TOGGLE)).toHaveAttribute('title', '关闭语音朗读');
    expect(await page.evaluate((k) => sessionStorage.getItem(k), VOICE_FLAG_KEY)).toBe('1');
  });

  test('Create 麦克风无权限时给友好提示', async ({ authenticatedPage: page }) => {
    await page.goto('/create', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(CREATE_MIC)).toBeVisible({ timeout: 20000 });
    await page.locator(CREATE_MIC).dispatchEvent('pointerdown');
    await page.waitForTimeout(1500);
    await page.locator(CREATE_MIC).dispatchEvent('pointerup');
    await expect(page.getByText(FRIENDLY_ERROR_RE).first()).toBeVisible({ timeout: 8000 });
  });
});

test.describe('语音链路与真实对话（@ai）', () => {
  test('@ai 小知先说话：进站首次手势触发打招呼 TTS + 说话胶囊', async ({ authenticatedPage: page }) => {
    test.setTimeout(120000);
    // 先挂请求监听再导航（登录页的点击已构成手势，create 挂载即打招呼）
    const greetTts = page.waitForRequest(
      (req) => /\/api\/v1\/voice\/tts/.test(req.url()) && /嗨，我是小知/.test(req.postData() || ''),
      { timeout: 90000 },
    );
    await page.goto('/create', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(CREATE_BAR)).toBeVisible({ timeout: 20000 });
    // 保底手势（登录页的点击已持久标记手势，create 挂载即打招呼；这里兜底时序）
    await page.locator('[data-testid="chat-input"]').click();
    await greetTts;
    // 打招呼朗读 → 说话胶囊出现
    await expect
      .poll(async () => await page.locator(CAPSULE).isVisible(), { timeout: 60000, interval: 500 })
      .toBe(true);
    // 会话内标记已招呼（同一页面会话不会再重复说）
    expect(await page.evaluate((k) => sessionStorage.getItem(k), GREET_KEY)).toBe('1');
  });

  test('@ai Create 对话：ZeroClaw 真实回复 + 回复完成触发 TTS 朗读胶囊', async ({ authenticatedPage: page }) => {
    test.setTimeout(180000);
    await page.goto('/create', { waitUntil: 'domcontentloaded' });
    const input = page.locator('[data-testid="chat-input"]');
    await expect(input).toBeVisible({ timeout: 20000 });
    const ttsRequest = page.waitForRequest(/\/api\/v1\/voice\/tts/, { timeout: 150000 });
    await input.fill('你好小知，请用一句话介绍你自己');
    await input.press('Enter');
    await expect
      .poll(async () => {
        const msgs = await page.locator('[data-testid="message-assistant"]').count();
        if (msgs === 0) return false;
        const text = await page.locator('[data-testid="message-assistant"]').last().innerText();
        return text.trim().length > 5;
      }, { timeout: 120000, interval: 2000 })
      .toBe(true);
    await ttsRequest;
    await expect
      .poll(async () => await page.locator(CAPSULE).isVisible(), { timeout: 60000, interval: 500 })
      .toBe(true);
    const capsuleText = await page.locator('[data-testid="companion-capsule-text"]').innerText();
    expect(capsuleText.trim().length).toBeGreaterThan(0);
  });

  test('@ai 首页提问带去 /create（识别降级路径下验证跳转参数链路）', async ({ authenticatedPage: page }) => {
    test.setTimeout(120000);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('textarea').first().fill('我想做一个贪吃蛇小游戏');
    await page.getByRole('button', { name: /提问/ }).click();
    await page.waitForURL(/\/create\?q=/, { timeout: 15000 });
    await expect(page.locator('[data-testid="message-user"]').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-testid="message-user"]').first()).toContainText('贪吃蛇');
  });
});
