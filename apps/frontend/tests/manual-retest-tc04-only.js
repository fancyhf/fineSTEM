/**
 * v1.2 TC-04 单独复测
 * 使用已有项目代码，直接点击运行按钮
 */

const { chromium } = require('playwright-core');

const FRONTEND_BASE = 'http://localhost:5184';
const MOCK_USER_EMAIL = '2749959@qq.com';
const MOCK_USER_PASSWORD = '750714hf';
const SHOT_DIR = '../../../test-results';

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`   ${pass ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function shot(page, name) {
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true });
  console.log(`   截图: ${name}.png`);
}

(async () => {
  console.log('=== v1.2 TC-04 单独复测 ===\n');

  const browser = await chromium.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // 监听控制台
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[tool_call]') || text.includes('[tool_result]') || text.includes('preview-console')) {
      console.log(`[浏览器日志] ${text.slice(0, 150)}`);
    }
  });

  try {
    // 登录
    console.log('1. 登录 MOCK_USER...');
    await page.goto(`${FRONTEND_BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', MOCK_USER_EMAIL);
    await page.fill('input[type="password"]', MOCK_USER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(explore|dashboard|research|create)/, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // 进入已有项目（首轮的 1d222e80）
    console.log('2. 进入已有项目...');
    await page.goto(`${FRONTEND_BASE}/create`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // ========== TC-04 复测：模态框内控制台面板 ==========
    console.log('\n=== TC-04 复测：预览区控制台面板（模态框内）===');

    // 直接点击"运行"按钮
    const runBtn = page.locator('button').filter({ hasText: /运行|预览|▶/ }).first();
    const runBtnExists = await runBtn.count() > 0;
    console.log(`   运行按钮存在: ${runBtnExists}`);

    if (runBtnExists) {
      await runBtn.click();
      console.log('   已点击运行按钮，等待模态框弹出...');
      await page.waitForTimeout(5000);

      // 截图查看模态框状态
      await shot(page, 'v1.2-tc04-modal-opened');

      // 在模态框内查找 [data-testid="preview-console"]
      // 注意：模态框和编辑区各有一个面板实例，取可见的那个
      const consolePanel = page.locator('[data-testid="preview-console"]').filter({ visible: true }).first();
      const consolePanelExists = await consolePanel.count() > 0;
      record('TC-04 模态框内控制台面板存在 (preview-console)', consolePanelExists, consolePanelExists ? '找到可见的面板' : '未找到面板');

      if (consolePanelExists) {
        // 检查展开/收起按钮
        const toggleBtn = page.locator('[data-testid="preview-console-toggle"]').filter({ visible: true }).first();
        record('TC-04 控制台展开/收起按钮', await toggleBtn.count() > 0, 'toggle 按钮检查');

        // 检查日志列表
        const logsList = page.locator('[data-testid="preview-console-logs"]').filter({ visible: true }).first();
        record('TC-04 控制台日志列表', await logsList.count() > 0, 'logs 列表检查');

        // 检查"让 AI 诊断"按钮
        const askAiBtn = page.locator('[data-testid="preview-console-ask-ai"]').filter({ visible: true }).first();
        const askAiExists = await askAiBtn.count() > 0;
        record('TC-04 "让 AI 诊断"按钮 (preview-console-ask-ai)', askAiExists, askAiExists ? '找到诊断按钮' : '未找到按钮');

        // 截图记录面板状态
        await shot(page, 'v1.2-tc04-console-found');

        // 尝试展开面板（如果有关闭按钮）
        if (await toggleBtn.count() > 0) {
          await toggleBtn.click();
          await page.waitForTimeout(1000);
          await shot(page, 'v1.2-tc04-console-expanded');
        }
      } else {
        // 如果模态框内没找到，检查是否在其他位置
        const allPanels = page.locator('[data-testid="preview-console"]');
        const panelCount = await allPanels.count();
        console.log(`   页面中共有 ${panelCount} 个 preview-console 元素`);

        if (panelCount > 0) {
          for (let i = 0; i < panelCount; i++) {
            const isVisible = await allPanels.nth(i).isVisible().catch(() => false);
            const isInViewport = await allPanels.nth(i).isInViewport().catch(() => false);
            console.log(`   面板 ${i}: 可见=${isVisible}, 视口内=${isInViewport}`);
          }
        }

        record('TC-04 控制台面板查找', false, `找到 ${panelCount} 个面板，但无可见面板`);
      }
    } else {
      record('TC-04 运行按钮', false, '未找到运行按钮');
    }

    // ========== 汇总 ==========
    console.log('\n=== TC-04 复测结果汇总 ===');
    for (const r of results) console.log(` ${r.pass ? '✅' : '❌'} ${r.name} — ${r.detail}`);
    const passed = results.filter((r) => r.pass).length;
    console.log(`\n通过 ${passed}/${results.length}`);

    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('测试出错:', error.message);
    await shot(page, 'v1.2-tc04-error').catch(() => {});
  }

  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
})();
