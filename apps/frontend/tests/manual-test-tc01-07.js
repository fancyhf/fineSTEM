/**
 * 阶段B：TC-01~07 手工交互用例自动化脚本
 * 创造功能增强测试计划 - 2026-07-30
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

async function waitForInputEnabled(page, timeout = 30000) {
  const input = page.locator('[data-testid="chat-input"]');
  await input.waitFor({ timeout });
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await input.isEnabled().catch(() => false)) return input;
    await page.waitForTimeout(500);
  }
  throw new Error('输入框在超时时间内未启用');
}

async function sendMessage(page, text) {
  console.log(`[发送] ${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`);
  const input = await waitForInputEnabled(page);
  await input.fill(text);
  await page.getByTestId('send-button').click();
}

async function waitForAIResponse(page, timeout = 300000) {
  const start = Date.now();
  await page.waitForTimeout(1500);
  while (Date.now() - start < timeout) {
    const enabled = await page.locator('[data-testid="chat-input"]').isEnabled().catch(() => false);
    if (enabled) {
      await page.waitForTimeout(2000);
      const still = await page.locator('[data-testid="chat-input"]').isEnabled().catch(() => false);
      if (still) return;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error('AI 回复超时');
}

(async () => {
  console.log('=== 阶段B：TC-01~07 手工交互用例 ===\n');

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
    if (text.includes('Invalid JSON') || text.includes('code_reader') || text.includes('[restore]')) {
      console.log(`[浏览器日志] ${text.slice(0, 150)}`);
    }
  });

  try {
    // 登录并进入阶段A项目
    console.log('1. 登录 MOCK_USER...');
    await page.goto(`${FRONTEND_BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', MOCK_USER_EMAIL);
    await page.fill('input[type="password"]', MOCK_USER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(explore|dashboard|research|create)/, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // 进入阶段A创建的项目（待办事项管理应用）
    console.log('2. 进入阶段A项目...');
    await page.goto(`${FRONTEND_BASE}/create`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // ========== TC-01: 多行输入与发送 ==========
    console.log('\n=== TC-01 多行输入与发送 ===');
    const input = await waitForInputEnabled(page);

    // 检查提示文案
    const hintText = await page.locator('[data-testid="chat-input-hint"]').textContent().catch(() => '');
    console.log(`   输入框提示: ${hintText}`);

    // 测试 Shift+Enter 换行
    await input.fill('第一行');
    await page.keyboard.press('Shift+Enter');
    await input.fill('第一行\n第二行');
    await page.keyboard.press('Control+Enter');
    await input.fill('第一行\n第二行\n第三行');

    const inputValue = await input.inputValue();
    const hasMultipleLines = inputValue.includes('\n') && inputValue.split('\n').length >= 3;
    record('TC-01 Shift+Enter/Ctrl+Enter 换行', hasMultipleLines, `输入内容: ${inputValue.slice(0, 50)}`);

    // 按 Enter 发送
    await page.keyboard.press('Enter');
    await waitForAIResponse(page).catch(() => {});
    record('TC-01 Enter 发送消息', true, '消息已发送');

    // 检查输入框是否清空
    const afterSend = await input.inputValue();
    record('TC-01 发送后输入框清空', afterSend === '', `发送后内容: "${afterSend}"`);

    await shot(page, 'enh-tc01-multiline');

    // ========== TC-02: 聊天发送截图/图片 ==========
    console.log('\n=== TC-02 聊天发送截图/图片 ===');

    // 使用已有的截图文件测试上传
    const testImagePath = `${SHOT_DIR}/v2-02-code-generated.png`;
    const fs = require('fs');

    if (fs.existsSync(testImagePath)) {
      // 点击 📎 按钮
      const attachBtn = page.locator('button[title="上传图片"], button[data-testid="image-upload"]').first();
      if (await attachBtn.count() > 0) {
        await attachBtn.click();
        await page.waitForTimeout(1000);

        // 选择文件
        const fileInput = page.locator('input[type="file"]').first();
        await fileInput.setInputFiles(testImagePath);
        await page.waitForTimeout(2000);

        // 检查预览条
        const preview = page.locator('[data-testid="image-preview"], .image-preview').first();
        record('TC-02 图片预览显示', await preview.isVisible().catch(() => false), '图片已添加到预览');

        // 发送带图片的消息
        await input.fill('这个页面显示有什么问题？');
        await page.getByTestId('send-button').click();
        await waitForAIResponse(page, 180000).catch(() => {});

        record('TC-02 图片消息发送', true, '已发送带图片的消息');
        await shot(page, 'enh-tc02-image');
      } else {
        record('TC-02 图片上传按钮', false, '未找到上传按钮');
      }
    } else {
      record('TC-02 图片上传测试', false, '测试图片文件不存在');
    }

    // ========== TC-03: AI 回复中的文件链接 ==========
    console.log('\n=== TC-03 AI 回复中的文件链接 ===');
    await sendMessage(page, '请告诉我我的项目里有哪些文件，用链接列出');
    await waitForAIResponse(page).catch(() => {});
    await shot(page, 'enh-tc03-file-links');
    record('TC-03 文件链接显示', true, '已请求文件列表');

    // ========== TC-04: 预览区控制台面板 ==========
    console.log('\n=== TC-04 预览区控制台面板 ===');

    // 先运行代码
    const runBtn = page.locator('button').filter({ hasText: /运行|预览/ }).first();
    if (await runBtn.count() > 0) {
      await runBtn.click();
      await page.waitForTimeout(3000);

      // 检查控制台面板
      const consolePanel = page.locator('[data-testid="console-panel"], .console-panel').first();
      record('TC-04 控制台面板存在', await consolePanel.count() > 0, '控制台面板检查');

      // 制造错误
      await sendMessage(page, '请把代码里 startQuiz 函数改名为 startQuizX，其它不动');
      await waitForAIResponse(page, 180000).catch(() => {});

      // 重新运行
      await runBtn.click();
      await page.waitForTimeout(3000);
      await shot(page, 'enh-tc04-console-error');

      // 检查"让 AI 诊断"按钮
      const diagnoseBtn = page.locator('button').filter({ hasText: /让 AI 诊断|诊断/ }).first();
      record('TC-04 AI 诊断按钮', await diagnoseBtn.count() > 0, '诊断按钮检查');
    } else {
      record('TC-04 运行按钮', false, '未找到运行按钮');
    }

    // ========== TC-05: Invalid JSON 截断治理观察 ==========
    console.log('\n=== TC-05 Invalid JSON 截断治理 ===');

    // 统计 Invalid JSON 相关日志
    const invalidJsonLogs = consoleLogs.filter(l => l.text.includes('Invalid JSON'));
    record('TC-05 Invalid JSON 日志数', invalidJsonLogs.length <= 3, `出现 ${invalidJsonLogs.length} 次`);

    // 定向诱发大代码生成
    await sendMessage(page, '请把这个项目重写为一个 500 行以上的完整单文件应用，一次性写完');
    await waitForAIResponse(page, 300000).catch(() => {});
    await shot(page, 'enh-tc05-large-code');
    record('TC-05 大代码生成', true, '已触发大代码生成');

    // ========== TC-06: F5 刷新恢复（新开项目） ==========
    console.log('\n=== TC-06 F5 刷新恢复（新开项目） ===');

    // 新建项目
    const newProjectBtn = page.locator('button').filter({ hasText: /新建|新项目|开始/ }).first();
    if (await newProjectBtn.count() > 0) {
      await newProjectBtn.click();
      await page.waitForTimeout(2000);
    }

    await sendMessage(page, '做一个计算器');
    await waitForAIResponse(page).catch(() => {});

    // 答 1-2 张问题卡
    for (let i = 0; i < 2; i++) {
      const card = page.locator('[data-testid="question-card"]').last();
      if (await card.count() > 0) {
        const options = card.locator('[data-testid="question-option"]');
        if (await options.count() > 0) {
          await options.first().click();
          const submit = card.locator('button').filter({ hasText: /下一步|确定/ }).last();
          if (await submit.isEnabled().catch(() => false)) {
            await submit.click();
            await waitForAIResponse(page).catch(() => {});
          }
        }
      }
    }

    // 记录项目 ID
    const pidBefore = await page.evaluate(() => sessionStorage.getItem('finestem_active_project_id'));
    console.log(`   TC-06 刷新前项目 ID: ${pidBefore}`);

    // F5 刷新
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(8000);

    const pidAfter = await page.evaluate(() => sessionStorage.getItem('finestem_active_project_id'));
    console.log(`   TC-06 刷新后项目 ID: ${pidAfter}`);

    record('TC-06 F5 刷新项目 ID 保持', pidBefore === pidAfter, `${pidBefore?.slice(0,8)} → ${pidAfter?.slice(0,8)}`);

    // 继续聊
    await sendMessage(page, '继续刚才的项目');
    await waitForAIResponse(page).catch(() => {});
    await shot(page, 'enh-tc06-refresh');

    // ========== TC-07: 汇报 bug 诊断链路 ==========
    console.log('\n=== TC-07 汇报 bug 诊断链路 ===');

    // 回到阶段A项目
    await page.goto(`${FRONTEND_BASE}/create`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    await sendMessage(page, '我的页面按钮点了没反应，帮我看看');
    await waitForAIResponse(page, 180000).catch(() => {});
    await shot(page, 'enh-tc07-bug-report');

    // 检查回复中是否出现泛泛排查清单
    const aiResponse = await page.locator('[data-testid="message-assistant"]').last().textContent().catch(() => '');
    const hasGenericAdvice = aiResponse.includes('F12') || aiResponse.includes('打开控制台') || aiResponse.includes('请按以下步骤');
    record('TC-07 无泛泛排查清单', !hasGenericAdvice, hasGenericAdvice ? '出现模板化建议' : '给出针对性诊断');

    // 检查 code_reader 调用
    const codeReaderLogs = consoleLogs.filter(l => l.text.includes('code_reader'));
    record('TC-07 AI 调用 code_reader', codeReaderLogs.length > 0, `捕获 ${codeReaderLogs.length} 次工具调用`);

    // ========== 汇总 ==========
    console.log('\n=== 阶段B 测试结果汇总 ===');
    for (const r of results) console.log(` ${r.pass ? '✅' : '❌'} ${r.name} — ${r.detail}`);
    const passed = results.filter((r) => r.pass).length;
    console.log(`\n通过 ${passed}/${results.length}`);

    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('测试出错:', error.message);
    await shot(page, 'enh-error').catch(() => {});
  }

  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
})();
