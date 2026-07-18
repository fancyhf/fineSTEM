const { chromium } = require('playwright');

(async () => {
  // 使用系统已安装的 Chrome
  const browser = await chromium.launch({ 
    headless: false, 
    slowMo: 100,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  console.log('[Test] 1. 登录');
  await page.goto('http://localhost:5173/login', { timeout: 60000 });
  // 等待 React 应用加载完成
  await page.waitForFunction(() => document.querySelector('input[type="email"]') !== null, { timeout: 30000 });
  await page.fill('input[type="email"]', '21749959@qq.com');
  await page.fill('input[type="password"]', 'stem2026');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  console.log('[Test] 2. 进入创造页面');
  await page.goto('http://localhost:5173/create');
  await page.waitForTimeout(2000);

  console.log('[Test] 3. 检查代码区工具栏');
  const toolbar = await page.locator('button:has-text("代码"), button:has-text("运行")').first();
  const toolbarVisible = await toolbar.isVisible().catch(() => false);
  console.log('[Result] 工具栏可见:', toolbarVisible);
  
  if (!toolbarVisible) {
    console.log('[ERROR] 工具栏不可见！截图保存到 bug/toolbar_missing.png');
    await page.screenshot({ path: 'g:/mediaProjects/fineSTEM/bug/toolbar_missing.png', fullPage: true });
    await browser.close();
    process.exit(1);
  }

  console.log('[Test] 4. 检查编辑器是否有代码');
  const editorCode = await page.evaluate(() => {
    const textarea = document.querySelector('.monaco-editor textarea');
    return textarea ? textarea.value : 'not found';
  });
  console.log('[Result] 编辑器代码长度:', editorCode.length);
  console.log('[Result] 编辑器代码前200字符:', editorCode.substring(0, 200));

  console.log('[Test] 5. 模拟用户说"样式不对帮我修"');
  await page.fill('textarea[placeholder]', '页面样式渲染不出来，帮我修复 CSS 样式');
  await page.keyboard.press('Enter');
  
  console.log('[Test] 6. 等待 AI 回复...');
  await page.waitForTimeout(15000); // 等待15秒让 AI 回复

  console.log('[Test] 7. 检查 AI 回复内容');
  const messages = await page.locator('[class*="rounded-2xl"]').allTextContents();
  const lastAiMessage = messages.filter(m => m.includes('奇幻选择') || m.includes('CSS') || m.includes('样式') || m.includes('{')).pop();
  console.log('[Result] 最后一条相关消息:', lastAiMessage?.substring(0, 300) || '未找到');

  console.log('[Test] 8. 检查编辑器代码是否更新');
  const newEditorCode = await page.evaluate(() => {
    const textarea = document.querySelector('.monaco-editor textarea');
    return textarea ? textarea.value : 'not found';
  });
  console.log('[Result] 新代码长度:', newEditorCode.length);
  
  // 检查 CSS 是否被注入
  const hasStyleTag = newEditorCode.includes('<style>');
  console.log('[Result] 是否包含 <style> 标签:', hasStyleTag);
  
  if (editorCode.length === newEditorCode.length && !hasStyleTag) {
    console.log('[ERROR] CSS 没有被合并到 HTML！');
    await page.screenshot({ path: 'g:/mediaProjects/fineSTEM/bug/css_not_merged.png', fullPage: true });
  } else {
    console.log('[SUCCESS] 代码已更新');
  }

  console.log('[Test] 9. 点击运行按钮');
  const runBtn = await page.locator('button:has-text("运行")').first();
  if (await runBtn.isVisible().catch(() => false)) {
    await runBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'g:/mediaProjects/fineSTEM/bug/after_run.png', fullPage: true });
  }

  console.log('[Test] 完成');
  await browser.close();
})().catch(e => {
  console.error('[Fatal]', e.message);
  process.exit(1);
});
