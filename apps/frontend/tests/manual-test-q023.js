const { chromium } = require('playwright-core');

(async () => {
  // 使用系统 Chrome
  const browser = await chromium.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // 1. 访问 Create 页面
  console.log('1. 访问 Create 页面...');
  await page.goto('http://localhost:5184/create', { waitUntil: 'networkidle' });
  await page.screenshot({ path: '../../../test-results/q023-manual-01-initial.png', fullPage: true });
  console.log('   截图已保存: q023-manual-01-initial.png');
  
  // 2. 等待页面加载完成
  await page.waitForTimeout(3000);
  
  // 3. 查找输入框并发送第一条消息
  console.log('2. 发送第一条消息创建项目...');
  const input = page.locator('[data-testid="chat-input"]').or(page.locator('textarea[placeholder*="消息"]').or(page.locator('textarea').first()));
  
  try {
    await input.waitFor({ timeout: 10000 });
    await input.fill('我想做一个英语单词学习助手');
    await page.waitForTimeout(500);
    
    // 点击发送按钮
    const sendBtn = page.locator('[data-testid="send-button"]').or(page.locator('button[type="submit"]')).or(page.locator('button').filter({ hasText: /发送|➤/ })).first();
    await sendBtn.click();
    console.log('   消息已发送');
  } catch (e) {
    console.log('   输入框未找到或无法交互:', e.message);
  }
  
  // 4. 等待 AI 回复
  console.log('3. 等待 AI 回复...');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '../../../test-results/q023-manual-02-first-response.png', fullPage: true });
  console.log('   截图已保存: q023-manual-02-first-response.png');
  
  // 5. 继续与 AI 对话推进项目
  console.log('4. 测试完成，保持浏览器打开供手动操作...');
  console.log('   请手动继续操作：回答问题、推进到编码阶段、测试大段代码生成');
  
  // 保持浏览器打开 10 分钟供手动操作
  await page.waitForTimeout(600000);
  
  await browser.close();
})();
