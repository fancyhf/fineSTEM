/**
 * 项目 8a7c155e 实测脚本
 * 
 * 测试场景：
 * 1. 说"代码丢了重写" - 确认 AI 理解上下文
 * 2. 说"继续" - 确认 AI 从断点接着写，记得之前的代码
 * 3. 讲解式生成大段代码 - 确认不被 totalTimeout 截断
 */

const { chromium } = require('playwright-core');

const FRONTEND_BASE = 'http://localhost:5184';
const PROJECT_ID = '8a7c155e';

async function waitForInputEnabled(page, timeout = 30000) {
  const input = page.locator('[data-testid="chat-input"]');
  await input.waitFor({ timeout });
  // 等待输入框可用（不被禁用）
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const isEnabled = await input.isEnabled().catch(() => false);
    if (isEnabled) return input;
    await page.waitForTimeout(500);
  }
  throw new Error('输入框在超时时间内未启用');
}

async function sendMessage(page, text) {
  console.log(`[发送消息] ${text}`);
  const input = await waitForInputEnabled(page);
  await input.fill(text);
  await page.getByTestId('send-button').click();
  console.log('  消息已发送，等待 AI 回复...');
}

async function getLastAssistantMessage(page) {
  try {
    const messages = page.locator('[data-testid="message-assistant"]');
    const count = await messages.count();
    if (count === 0) return null;
    return await messages.nth(count - 1).textContent();
  } catch {
    return null;
  }
}

async function waitForAIResponse(page, timeout = 120000) {
  console.log('  等待 AI 回复完成...');
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const input = page.locator('[data-testid="chat-input"]');
    const isEnabled = await input.isEnabled().catch(() => false);
    if (isEnabled) {
      // 再等待一下确保消息渲染完成
      await page.waitForTimeout(1000);
      return;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error('AI 回复超时');
}

(async () => {
  console.log('=== 项目 8a7c155e 实测开始 ===\n');
  
  const browser = await chromium.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // 监听控制台日志
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('截断') || text.includes('续接') || text.includes('timeout') || text.includes('keepalive')) {
      console.log(`[浏览器日志] ${text}`);
    }
  });
  
  try {
    // 1. 访问项目页面
    console.log('1. 访问项目 8a7c155e...');
    await page.goto(`${FRONTEND_BASE}/create?project=${PROJECT_ID}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '../../../test-results/8a7c155e-01-initial.png', fullPage: true });
    console.log('   截图已保存: 8a7c155e-01-initial.png\n');
    
    // 2. 测试场景：说"代码丢了重写"
    console.log('2. 测试场景：说"代码丢了重写"...');
    await sendMessage(page, '代码丢了重写');
    await waitForAIResponse(page);
    
    const msg1 = await getLastAssistantMessage(page);
    console.log(`   AI 回复长度: ${msg1?.length || 0} 字符`);
    console.log(`   AI 回复前 200 字符: ${msg1?.slice(0, 200)}...`);
    await page.screenshot({ path: '../../../test-results/8a7c155e-02-code-lost.png', fullPage: true });
    console.log('   截图已保存: 8a7c155e-02-code-lost.png\n');
    
    // 3. 测试场景：说"继续"
    console.log('3. 测试场景：说"继续"...');
    await sendMessage(page, '继续');
    await waitForAIResponse(page);
    
    const msg2 = await getLastAssistantMessage(page);
    console.log(`   AI 回复长度: ${msg2?.length || 0} 字符`);
    console.log(`   AI 回复前 200 字符: ${msg2?.slice(0, 200)}...`);
    
    // 检查是否从断点接着写（而非从头开始）
    const hasBackToStart = msg2?.match(/首先|第一步|我们先|原理介绍|让我们从头|重新开始/i);
    if (hasBackToStart) {
      console.log('   ⚠️ AI 可能回到开头重新讲解');
    } else {
      console.log('   ✅ AI 似乎从断点接着写');
    }
    await page.screenshot({ path: '../../../test-results/8a7c155e-03-continue.png', fullPage: true });
    console.log('   截图已保存: 8a7c155e-03-continue.png\n');
    
    // 4. 测试场景：讲解式生成大段代码
    console.log('4. 测试场景：讲解式生成大段代码...');
    await sendMessage(page, '请用讲解式模式，完整实现这个项目的所有代码，包括HTML、CSS、JavaScript，不要省略任何部分');
    
    // 等待较长时间，观察是否被 totalTimeout 截断
    console.log('   等待 AI 生成代码（最长 3 分钟）...');
    let lastLength = 0;
    let stableCount = 0;
    const startTime = Date.now();
    
    while (Date.now() - startTime < 180000) { // 最多等 3 分钟
      await page.waitForTimeout(5000);
      
      const msg = await getLastAssistantMessage(page);
      const currentLength = msg?.length || 0;
      
      if (currentLength > lastLength) {
        lastLength = currentLength;
        stableCount = 0;
        console.log(`   代码生成中... 当前长度: ${currentLength}`);
      } else {
        stableCount++;
        if (stableCount >= 6) { // 30秒无增长，认为完成
          console.log(`   代码生成停止，最终长度: ${currentLength}`);
          break;
        }
      }
    }
    
    const finalMsg = await getLastAssistantMessage(page);
    console.log(`   最终代码长度: ${finalMsg?.length || 0} 字符`);
    
    // 检查是否完整
    const hasHtmlClosing = finalMsg?.includes('</html>');
    const hasCodeBlockEnd = finalMsg?.includes('```');
    console.log(`   检查: </html>闭合=${hasHtmlClosing}, 代码块闭合=${hasCodeBlockEnd}`);
    
    if (hasHtmlClosing) {
      console.log('   ✅ 代码完整输出到 </html> 闭合');
    } else {
      console.log('   ⚠️ 代码可能未完整输出');
    }
    
    await page.screenshot({ path: '../../../test-results/8a7c155e-04-large-code.png', fullPage: true });
    console.log('   截图已保存: 8a7c155e-04-large-code.png\n');
    
    // 5. 完成
    console.log('=== 测试完成 ===');
    console.log('浏览器保持打开，请手动检查...');
    
    // 保持浏览器打开 5 分钟供手动检查
    await page.waitForTimeout(300000);
    
  } catch (error) {
    console.error('测试出错:', error.message);
    await page.screenshot({ path: '../../../test-results/8a7c155e-error.png', fullPage: true });
  }
  
  await browser.close();
})();
