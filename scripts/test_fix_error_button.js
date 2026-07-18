const { chromium } = require('playwright');

(async () => {
  console.log('[Test] 启动浏览器...');
  const browser = await chromium.launch({ 
    headless: false, 
    slowMo: 200,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // 监听 console 消息
  page.on('console', msg => {
    console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
  });

  try {
    console.log('[Test] 1. 登录');
    await page.goto('http://localhost:5173/login', { timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('input[type="email"]') !== null, { timeout: 30000 });
    await page.fill('input[type="email"]', '21749959@qq.com');
    await page.fill('input[type="password"]', 'stem2026');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    console.log('[Test] 2. 进入创造页面');
    await page.goto('http://localhost:5173/create');
    await page.waitForTimeout(3000);

    console.log('[Test] 3. 输入有错误的 JavaScript 代码');
    // 等待 Monaco Editor 加载
    await page.waitForSelector('.monaco-editor', { timeout: 30000 });
    
    // 点击编辑器并输入错误代码
    await page.click('.monaco-editor');
    await page.keyboard.press('Control+a');
    await page.keyboard.type(`const x = ;
console.log(x);`);
    await page.waitForTimeout(1000);

    console.log('[Test] 4. 点击运行按钮');
    await page.click('button:has-text("运行")');
    await page.waitForTimeout(3000);

    console.log('[Test] 5. 检查是否有"让 AI 修复此错误"按钮');
    const button = await page.locator('button:has-text("让 AI 修复此错误"), button[id="__fix_err_btn"]').first();
    const isVisible = await button.isVisible().catch(() => false);
    console.log('[Result] 按钮可见:', isVisible);

    if (!isVisible) {
      console.log('[ERROR] 找不到"让 AI 修复此错误"按钮！');
      await page.screenshot({ path: 'g:/mediaProjects/fineSTEM/bug/no_fix_button.png', fullPage: true });
      await browser.close();
      process.exit(1);
    }

    console.log('[Test] 6. 点击"让 AI 修复此错误"按钮');
    
    // 在点击前设置消息监听
    const messagePromise = page.evaluate(() => {
      return new Promise((resolve) => {
        const handler = (e) => {
          if (e.data && e.data.type === 'code-error') {
            window.removeEventListener('message', handler);
            resolve(e.data);
          }
        };
        window.addEventListener('message', handler);
        // 5秒超时
        setTimeout(() => resolve(null), 5000);
      });
    });

    await button.click();
    console.log('[Test] 按钮已点击，等待 postMessage...');

    const messageData = await messagePromise;
    console.log('[Result] 收到的消息:', messageData);

    if (messageData && messageData.type === 'code-error') {
      console.log('[SUCCESS] postMessage 正常工作！错误信息:', messageData.msg);
    } else {
      console.log('[ERROR] 没有收到 code-error 消息！');
      await page.screenshot({ path: 'g:/mediaProjects/fineSTEM/bug/no_postmessage.png', fullPage: true });
    }

    console.log('[Test] 7. 检查 AI 是否收到请求');
    await page.waitForTimeout(3000);
    
    // 检查是否有新的 AI 消息
    const messages = await page.locator('[class*="rounded-2xl"]').allTextContents();
    const lastMessage = messages[messages.length - 1];
    console.log('[Result] 最后一条消息:', lastMessage?.substring(0, 200));

    if (lastMessage && (lastMessage.includes('修复') || lastMessage.includes('错误') || lastMessage.includes('```'))) {
      console.log('[SUCCESS] AI 已响应修复请求！');
    } else {
      console.log('[WARNING] AI 可能没有正确响应');
    }

    await page.screenshot({ path: 'g:/mediaProjects/fineSTEM/bug/final_state.png', fullPage: true });

  } catch (e) {
    console.error('[Fatal Error]', e.message);
    await page.screenshot({ path: 'g:/mediaProjects/fineSTEM/bug/error_screenshot.png', fullPage: true });
  }

  console.log('[Test] 完成，关闭浏览器');
  await browser.close();
})();
