/**
 * TC-04 重新测试（代码修改后）
 * 测试模态框内控制台面板
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
  console.log('=== TC-04 重新测试（代码修改后）===\n');

  const browser = await chromium.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // 监听控制台
  const consoleLogs = [];
  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text: text.slice(0, 200) });
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

    // 进入创造页（刷新确保最新代码）
    console.log('2. 进入创造页（已刷新加载最新代码）...');
    await page.goto(`${FRONTEND_BASE}/create`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 检查是否有现有项目，如果没有就创建一个简单的
    const hasProject = await page.locator('[data-testid="code-editor"], .code-editor').count() > 0;
    if (!hasProject) {
      console.log('   创建新项目...');
      const newBtn = page.locator('button').filter({ hasText: /新建|新项目/ }).first();
      if (await newBtn.count() > 0) {
        await newBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    // ========== TC-04 测试：模态框内控制台面板 ==========
    console.log('\n=== TC-04 测试：预览区控制台面板（模态框内）===');

    // 先检查编辑区是否有代码
    const editor = page.locator('[data-testid="code-editor"], .code-editor, textarea').first();
    if (await editor.count() > 0) {
      // 写入测试代码
      await editor.fill(`<!DOCTYPE html>
<html>
<head>
  <title>Test Page</title>
</head>
<body>
  <h1>Test Console Panel</h1>
  <button id="errorBtn">Trigger Error</button>
  <script>
    console.log('Page loaded');
    document.getElementById('errorBtn').addEventListener('click', function() {
      undefinedFunction(); // This will cause an error
    });
  <\/script>
</body>
</html>`);
      await page.waitForTimeout(1000);
      console.log('   已写入测试代码');
    }

    // 点击"运行"按钮
    const runBtn = page.locator('button').filter({ hasText: /运行|预览|▶|Run/ }).first();
    const runBtnExists = await runBtn.count() > 0;
    console.log(`   运行按钮存在: ${runBtnExists}`);

    if (runBtnExists) {
      await runBtn.click();
      console.log('   已点击运行按钮，等待模态框弹出...');
      await page.waitForTimeout(5000);

      // 截图查看模态框状态
      await shot(page, 'tc04-rerun-modal-opened');

      // 在模态框内查找 [data-testid="preview-console"]
      // 使用多种策略查找
      console.log('   查找控制台面板...');

      // 策略1: 直接查找 preview-console
      const consolePanel1 = page.locator('[data-testid="preview-console"]');
      const count1 = await consolePanel1.count();
      console.log(`   策略1 - [data-testid="preview-console"]: ${count1} 个`);

      // 策略2: 查找可见的 preview-console
      const consolePanel2 = page.locator('[data-testid="preview-console"]').filter({ visible: true });
      const count2 = await consolePanel2.count();
      console.log(`   策略2 - 可见的 preview-console: ${count2} 个`);

      // 策略3: 查找包含 console 的元素
      const consolePanel3 = page.locator('[data-testid*="console"], [class*="console"], [class*="Console"]');
      const count3 = await consolePanel3.count();
      console.log(`   策略3 - 包含 console 的元素: ${count3} 个`);

      // 策略4: 查找模态框内的所有元素
      const modal = page.locator('[role="dialog"], .modal, [data-testid*="modal"], [data-testid*="preview"]').first();
      if (await modal.count() > 0) {
        console.log('   找到模态框，检查内部结构...');
        const modalHTML = await modal.innerHTML().catch(() => '');
        console.log(`   模态框 HTML 长度: ${modalHTML.length}`);

        // 检查是否包含 console 相关文本
        const hasConsoleText = modalHTML.includes('console') || modalHTML.includes('Console');
        console.log(`   模态框包含 console 文本: ${hasConsoleText}`);
      }

      // 记录结果
      const found = count1 > 0 || count2 > 0;
      record('TC-04 控制台面板存在 (preview-console)', found, found ? `找到 ${count1} 个面板` : '未找到面板');

      if (found) {
        const panel = count2 > 0 ? consolePanel2.first() : consolePanel1.first();

        // 检查展开/收起按钮
        const toggleBtn = page.locator('[data-testid="preview-console-toggle"]');
        record('TC-04 控制台展开/收起按钮', await toggleBtn.count() > 0, `找到 ${await toggleBtn.count()} 个`);

        // 检查日志列表
        const logsList = page.locator('[data-testid="preview-console-logs"]');
        record('TC-04 控制台日志列表', await logsList.count() > 0, `找到 ${await logsList.count()} 个`);

        // 检查"让 AI 诊断"按钮
        const askAiBtn = page.locator('[data-testid="preview-console-ask-ai"]');
        const askAiExists = await askAiBtn.count() > 0;
        record('TC-04 "让 AI 诊断"按钮', askAiExists, askAiExists ? '找到诊断按钮' : '未找到');

        // 截图记录面板状态
        await shot(page, 'tc04-rerun-console-found');

        // 测试展开面板
        if (await toggleBtn.count() > 0) {
          await toggleBtn.first().click();
          await page.waitForTimeout(1000);
          await shot(page, 'tc04-rerun-console-expanded');
        }

        // 测试"让 AI 诊断"按钮
        if (askAiExists) {
          console.log('   点击"让 AI 诊断"按钮...');
          await askAiBtn.first().click();
          await page.waitForTimeout(3000);

          // 检查模态框是否关闭
          const modalClosed = await modal.count() === 0 || !await modal.isVisible().catch(() => false);
          record('TC-04 点诊断后模态框关闭', modalClosed, modalClosed ? '模态框已关闭' : '模态框仍打开');

          // 检查聊天区是否发出带日志的消息
          const lastUserMsg = await page.locator('[data-testid="message-user"]').last().textContent().catch(() => '');
          const hasConsoleLogs = lastUserMsg.includes('```') || lastUserMsg.includes('console') || lastUserMsg.includes('error');
          record('TC-04 聊天区发出带日志消息', hasConsoleLogs, hasConsoleLogs ? '消息包含日志' : '消息不含日志');

          await shot(page, 'tc04-rerun-after-ask-ai');
        }
      } else {
        // 如果未找到，输出页面结构帮助诊断
        console.log('   未找到控制台面板，输出页面结构...');

        // 查找所有 data-testid
        const allTestids = await page.locator('[data-testid]').evaluateAll(els => els.map(el => el.getAttribute('data-testid')));
        console.log(`   页面中所有 data-testid: ${[...new Set(allTestids)].join(', ')}`);

        // 查找模态框内的按钮
        const modalBtns = await page.locator('[role="dialog"] button, .modal button').evaluateAll(els => els.map(el => el.textContent?.trim()).filter(Boolean));
        console.log(`   模态框内按钮: ${modalBtns.join(', ')}`);

        record('TC-04 控制台面板查找', false, `尝试3种策略均未找到`);
      }
    } else {
      record('TC-04 运行按钮', false, '未找到运行按钮');
    }

    // ========== 汇总 ==========
    console.log('\n=== TC-04 重新测试结果汇总 ===');
    for (const r of results) console.log(` ${r.pass ? '✅' : '❌'} ${r.name} — ${r.detail}`);
    const passed = results.filter((r) => r.pass).length;
    console.log(`\n通过 ${passed}/${results.length}`);

    // 输出所有控制台日志
    console.log('\n=== 控制台日志汇总 ===');
    const relevantLogs = consoleLogs.filter(l => l.text.includes('console') || l.text.includes('preview') || l.text.includes('error'));
    if (relevantLogs.length > 0) {
      relevantLogs.forEach(l => console.log(`[${l.type}] ${l.text}`));
    } else {
      console.log('（无相关日志）');
    }

    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('测试出错:', error.message);
    await shot(page, 'tc04-rerun-error').catch(() => {});
  }

  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
})();
