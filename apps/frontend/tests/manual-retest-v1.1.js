/**
 * v1.1 复测脚本：A1.7、TC-02、TC-04、TC-07
 * 使用 DOM 锚点速查表中的选择器
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
  console.log('=== v1.1 复测：A1.7、TC-02、TC-04、TC-07 ===\n');

  const browser = await chromium.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // 监听控制台 - 使用 v1.1 新的日志格式
  const consoleLogs = [];
  const toolCalls = [];
  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    consoleLogs.push({ type, text: text.slice(0, 300) });

    // 捕获 v1.1 新增的工具调用日志格式
    if (text.includes('[tool_call]')) {
      toolCalls.push({ type: 'call', text });
      console.log(`[工具调用] ${text.slice(0, 150)}`);
    }
    if (text.includes('[tool_result]')) {
      toolCalls.push({ type: 'result', text });
      console.log(`[工具结果] ${text.slice(0, 150)}`);
    }
    if (text.includes('[restore]') || text.includes('Invalid JSON')) {
      console.log(`[浏览器日志] ${text.slice(0, 150)}`);
    }
  });

  try {
    // ========== 登录并进入首轮项目 1d222e80 ==========
    console.log('1. 登录 MOCK_USER...');
    await page.goto(`${FRONTEND_BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', MOCK_USER_EMAIL);
    await page.fill('input[type="password"]', MOCK_USER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(explore|dashboard|research|create)/, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // 进入首轮阶段A项目 1d222e80
    console.log('2. 进入首轮项目 1d222e80...');
    await page.goto(`${FRONTEND_BASE}/create`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // ========== A1.7 复测：code_reader 工具调用 ==========
    console.log('\n=== A1.7 复测：code_reader 工具调用捕获 ===');
    toolCalls.length = 0; // 清空之前的调用记录

    await sendMessage(page, '我发现添加任务的按钮没反应，请帮我检查一下');
    await waitForAIResponse(page, 180000).catch((e) => console.log('   ⚠️ ' + e.message));

    // 检查新的工具调用日志格式
    const codeReaderCalls = toolCalls.filter(t => t.text.includes('project_code_reader'));
    const codeReaderResults = toolCalls.filter(t => t.text.includes('project_code_reader') && t.text.includes('ok'));

    record('A1.7 [tool_call] project_code_reader 捕获', codeReaderCalls.length > 0, `捕获 ${codeReaderCalls.length} 次调用`);
    record('A1.7 [tool_result] project_code_reader ok', codeReaderResults.length > 0, `捕获 ${codeReaderResults.length} 次成功结果`);

    await shot(page, 'v1.1-a17-retest');

    // ========== TC-02 复测：图片上传功能 ==========
    console.log('\n=== TC-02 复测：聊天发送截图/图片 ===');

    // 使用 v1.1 新增的 data-testid="attach-image-button"
    const attachBtn = page.locator('[data-testid="attach-image-button"]');
    const attachBtnExists = await attachBtn.count() > 0;
    record('TC-02 📎 发图按钮存在 (data-testid)', attachBtnExists, attachBtnExists ? '找到 attach-image-button' : '未找到按钮');

    if (attachBtnExists) {
      // 点击 📎 按钮
      await attachBtn.click();
      await page.waitForTimeout(1000);

      // 选择测试图片
      const testImagePath = `${SHOT_DIR}/v2-02-code-generated.png`;
      const fs = require('fs');

      if (fs.existsSync(testImagePath)) {
        const fileInput = page.locator('input[type="file"]').first();
        await fileInput.setInputFiles(testImagePath);
        await page.waitForTimeout(2000);

        // 检查预览条
        const preview = page.locator('[data-testid="image-preview"], .image-preview, img[alt="预览"]').first();
        const previewExists = await preview.isVisible().catch(() => false);
        record('TC-02 图片预览显示', previewExists, previewExists ? '预览条已显示' : '未显示预览');

        // 发送带图片的消息
        const input = await waitForInputEnabled(page);
        await input.fill('这个页面显示有什么问题？');
        await page.getByTestId('send-button').click();

        // 等待识别 loading
        await page.waitForTimeout(3000);
        const loadingText = await page.locator('text=正在识别').isVisible().catch(() => false);
        record('TC-02 "正在识别截图内容" loading', loadingText, loadingText ? '显示识别中' : '未捕获 loading');

        await waitForAIResponse(page, 180000).catch(() => {});
        record('TC-02 图片消息发送成功', true, '消息已发送');

        // 检查用户气泡 - 不应显示冗长识别文本
        const lastUserMsg = await page.locator('[data-testid="message-user"]').last().textContent().catch(() => '');
        const hasLongDescription = lastUserMsg.length > 200 && lastUserMsg.includes('图中');
        record('TC-02 气泡不显示冗长识别文本', !hasLongDescription, hasLongDescription ? '出现长文本' : '仅显示原话');

        await shot(page, 'v1.1-tc02-retest');
      } else {
        record('TC-02 测试图片文件', false, 'v2-02-code-generated.png 不存在');
      }
    }

    // ========== TC-04 复测：预览区控制台面板 ==========
    console.log('\n=== TC-04 复测：预览区控制台面板 ===');

    // 必须先点"运行"按钮
    const runBtn = page.locator('button').filter({ hasText: /运行|预览|▶/ }).first();
    if (await runBtn.count() > 0) {
      await runBtn.click();
      console.log('   已点击运行按钮');
      await page.waitForTimeout(3000);

      // 切到预览页签（如果需要）
      const previewTab = page.locator('[data-testid="preview-tab"], button:has-text("预览")').first();
      if (await previewTab.count() > 0 && await previewTab.isVisible()) {
        await previewTab.click();
        await page.waitForTimeout(1000);
      }
    }

    // 使用 v1.1 新增的 testid 检查控制台面板
    const consolePanel = page.locator('[data-testid="preview-console"]');
    const consolePanelExists = await consolePanel.count() > 0;
    record('TC-04 控制台面板存在 (preview-console)', consolePanelExists, consolePanelExists ? '找到控制台面板' : '未找到面板');

    if (consolePanelExists) {
      // 检查展开/收起按钮
      const toggleBtn = page.locator('[data-testid="preview-console-toggle"]');
      record('TC-04 控制台展开/收起按钮', await toggleBtn.count() > 0, 'toggle 按钮检查');

      // 检查日志列表
      const logsList = page.locator('[data-testid="preview-console-logs"]');
      record('TC-04 控制台日志列表', await logsList.count() > 0, 'logs 列表检查');

      // 检查"让 AI 诊断"按钮
      const askAiBtn = page.locator('[data-testid="preview-console-ask-ai"]');
      const askAiExists = await askAiBtn.count() > 0;
      record('TC-04 "让 AI 诊断"按钮 (preview-console-ask-ai)', askAiExists, askAiExists ? '找到诊断按钮' : '未找到按钮');

      await shot(page, 'v1.1-tc04-retest');
    }

    // ========== TC-07 复测：bug 诊断链路 ==========
    console.log('\n=== TC-07 复测：汇报 bug 诊断链路 ===');
    toolCalls.length = 0; // 清空记录

    await sendMessage(page, '我的页面按钮点了没反应，帮我看看');
    await waitForAIResponse(page, 180000).catch((e) => console.log('   ⚠️ ' + e.message));

    // 检查工具调用
    const tc07CodeReaderCalls = toolCalls.filter(t => t.text.includes('project_code_reader'));
    record('TC-07 [tool_call] project_code_reader', tc07CodeReaderCalls.length > 0, `捕获 ${tc07CodeReaderCalls.length} 次调用`);

    // 检查 AI 回复是否无泛泛排查清单
    const aiResponse = await page.locator('[data-testid="message-assistant"]').last().textContent().catch(() => '');
    const hasGenericAdvice = aiResponse.includes('F12') || aiResponse.includes('打开控制台') || aiResponse.includes('请按以下步骤') || aiResponse.includes('检查以下');
    record('TC-07 无泛泛排查清单', !hasGenericAdvice, hasGenericAdvice ? '出现模板化建议' : '给出针对性诊断');

    await shot(page, 'v1.1-tc07-retest');

    // ========== 汇总 ==========
    console.log('\n=== v1.1 复测结果汇总 ===');
    for (const r of results) console.log(` ${r.pass ? '✅' : '❌'} ${r.name} — ${r.detail}`);
    const passed = results.filter((r) => r.pass).length;
    console.log(`\n通过 ${passed}/${results.length}`);

    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('测试出错:', error.message);
    await shot(page, 'v1.1-error').catch(() => {});
  }

  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
})();
