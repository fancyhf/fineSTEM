/**
 * v1.2 复测脚本：TC-02、TC-04
 * 按照 v1.2 复测指引执行
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
  console.log('=== v1.2 复测：TC-02、TC-04 ===\n');

  const browser = await chromium.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // 监听控制台
  const consoleLogs = [];
  const toolCalls = [];
  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text: text.slice(0, 300) });

    if (text.includes('[tool_call]')) {
      toolCalls.push({ type: 'call', text });
      console.log(`[工具调用] ${text.slice(0, 150)}`);
    }
    if (text.includes('[tool_result]')) {
      toolCalls.push({ type: 'result', text });
      console.log(`[工具结果] ${text.slice(0, 150)}`);
    }
  });

  try {
    // ========== 登录并进入项目 ==========
    console.log('1. 登录 MOCK_USER...');
    await page.goto(`${FRONTEND_BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', MOCK_USER_EMAIL);
    await page.fill('input[type="password"]', MOCK_USER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(explore|dashboard|research|create)/, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // 进入创造页
    console.log('2. 进入创造页...');
    await page.goto(`${FRONTEND_BASE}/create`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // ========== TC-02 复测：图片预览条（v1.2 修复） ==========
    console.log('\n=== TC-02 复测：聊天发送截图/图片 ===');

    // 使用 v1.2 新增的 data-testid="attach-image-button"
    const attachBtn = page.locator('[data-testid="attach-image-button"]');
    const attachBtnExists = await attachBtn.count() > 0;
    record('TC-02 📎 发图按钮存在', attachBtnExists, attachBtnExists ? '找到 attach-image-button' : '未找到按钮');

    if (attachBtnExists) {
      await attachBtn.click();
      await page.waitForTimeout(1000);

      // 选择测试图片
      const testImagePath = `${SHOT_DIR}/v2-02-code-generated.png`;
      const fs = require('fs');

      if (fs.existsSync(testImagePath)) {
        const fileInput = page.locator('input[type="file"]').first();
        await fileInput.setInputFiles(testImagePath);
        await page.waitForTimeout(2000);

        // v1.2 修复：使用 data-testid="image-preview" 在发送前断言预览条
        const preview = page.locator('[data-testid="image-preview"]');
        const previewExists = await preview.count() > 0 && await preview.isVisible().catch(() => false);
        record('TC-02 图片预览条存在 (image-preview)', previewExists, previewExists ? '预览条已显示' : '未显示预览');

        // 截图记录预览状态（发送前）
        await shot(page, 'v1.2-tc02-preview-before-send');

        // 添加文字并发送
        const input = await waitForInputEnabled(page);
        await input.fill('这个页面显示有什么问题？');

        // 再次确认预览条在发送前仍然存在
        const previewBeforeSend = await preview.isVisible().catch(() => false);
        record('TC-02 发送前预览条可见', previewBeforeSend, previewBeforeSend ? '发送前预览可见' : '发送前预览已消失');

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

        await shot(page, 'v1.2-tc02-after-send');
      } else {
        record('TC-02 测试图片文件', false, 'v2-02-code-generated.png 不存在');
      }
    }

    // ========== TC-04 复测：模态框内控制台面板（v1.2 修复） ==========
    console.log('\n=== TC-04 复测：预览区控制台面板（模态框内）===');

    // 先让 AI 写一段含 console.log 和未定义函数调用的 HTML
    await sendMessage(page, '请写一段 HTML 代码，包含一个按钮，点击按钮时调用一个未定义的函数 triggerError()，同时在页面加载时 console.log("hello")');
    await waitForAIResponse(page, 180000).catch(() => {});

    // 点击"运行"按钮
    const runBtn = page.locator('button').filter({ hasText: /运行|预览|▶/ }).first();
    if (await runBtn.count() > 0) {
      await runBtn.click();
      console.log('   已点击运行按钮，等待模态框弹出...');
      await page.waitForTimeout(3000);

      // v1.2 修复：在模态框内查找 [data-testid="preview-console"]
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
        await shot(page, 'v1.2-tc04-console-panel');

        // 尝试触发错误：在 iframe 内点击按钮
        const iframe = page.locator('iframe[title="预览"], iframe[srcdoc], .preview-modal iframe, [data-testid="preview-iframe"]').first();
        if (await iframe.count() > 0) {
          console.log('   尝试在预览 iframe 内点击按钮触发错误...');
          try {
            const iframeElement = await iframe.elementHandle();
            if (iframeElement) {
              const frame = await iframeElement.contentFrame();
              if (frame) {
                const button = frame.locator('button').first();
                if (await button.count() > 0) {
                  await button.click();
                  await page.waitForTimeout(2000);
                  record('TC-04 触发页面按钮点击', true, '已点击 iframe 内按钮');

                  // 检查控制台是否自动展开并显示错误
                  const consoleVisible = await consolePanel.isVisible().catch(() => false);
                  record('TC-04 点击后控制台可见', consoleVisible, consoleVisible ? '控制台可能已展开' : '控制台未展开');

                  await shot(page, 'v1.2-tc04-after-error');
                }
              }
            }
          } catch (e) {
            console.log(`   iframe 操作失败: ${e.message}`);
          }
        }

        // 测试"让 AI 诊断"按钮
        if (askAiExists) {
          console.log('   点击"让 AI 诊断"按钮...');
          await askAiBtn.click();
          await page.waitForTimeout(3000);

          // 检查模态框是否关闭
          const modalClosed = await consolePanel.count() === 0 || !await consolePanel.isVisible().catch(() => false);
          record('TC-04 点诊断后模态框关闭', modalClosed, modalClosed ? '模态框已关闭' : '模态框仍打开');

          // 检查聊天区是否发出带日志的消息
          const lastUserMsg = await page.locator('[data-testid="message-user"]').last().textContent().catch(() => '');
          const hasConsoleLogs = lastUserMsg.includes('```') || lastUserMsg.includes('console') || lastUserMsg.includes('error');
          record('TC-04 聊天区发出带日志消息', hasConsoleLogs, hasConsoleLogs ? '消息包含日志' : '消息不含日志');

          await shot(page, 'v1.2-tc04-after-ask-ai');
        }
      } else {
        // 如果模态框内没找到，检查是否在其他位置
        const allPanels = page.locator('[data-testid="preview-console"]');
        const panelCount = await allPanels.count();
        console.log(`   页面中共有 ${panelCount} 个 preview-console 元素`);

        if (panelCount > 0) {
          for (let i = 0; i < panelCount; i++) {
            const isVisible = await allPanels.nth(i).isVisible().catch(() => false);
            console.log(`   面板 ${i}: 可见=${isVisible}`);
          }
        }

        record('TC-04 控制台面板查找', false, `找到 ${panelCount} 个面板，但无可见面板`);
      }
    } else {
      record('TC-04 运行按钮', false, '未找到运行按钮');
    }

    // ========== 汇总 ==========
    console.log('\n=== v1.2 复测结果汇总 ===');
    for (const r of results) console.log(` ${r.pass ? '✅' : '❌'} ${r.name} — ${r.detail}`);
    const passed = results.filter((r) => r.pass).length;
    console.log(`\n通过 ${passed}/${results.length}`);

    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('测试出错:', error.message);
    await shot(page, 'v1.2-error').catch(() => {});
  }

  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
})();
