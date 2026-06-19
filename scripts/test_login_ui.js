// UI 自动化测试：登录功能
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  console.log('[Test] 打开登录页面...');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  
  // 截图看当前状态
  await page.screenshot({ path: 'g:/mediaProjects/fineSTEM/bug/login_test_01_initial.png', fullPage: true });
  console.log('[Screenshot] login_test_01_initial.png - 初始登录页面');
  
  // 检查页面是否有错误
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log(`[Console Error] ${msg.text()}`);
    }
  });
  
  // 监听网络请求
  const networkRequests = [];
  page.on('request', req => {
    if (req.url().includes('/auth/')) {
      networkRequests.push({ url: req.url(), method: req.method() });
      console.log(`[Request] ${req.method()} ${req.url()}`);
    }
  });
  
  page.on('response', async res => {
    if (res.url().includes('/auth/')) {
      const body = await res.text().catch(() => '');
      console.log(`[Response] ${res.status()} ${res.url()} => ${body.substring(0, 200)}`);
    }
  });
  
  // 填入用户名和密码
  console.log('\n[Test] 填入用户名: 21749959@qq.com');
  await page.fill('input[type="email"], input[name="email"], input[placeholder*="邮箱"]', '21749959@qq.com');
  
  console.log('[Test] 填入密码: test123');
  await page.fill('input[type="password"], input[name="password"]', 'test123');
  
  await page.screenshot({ path: 'g:/mediaProjects/fineSTEM/bug/login_test_02_filled.png', fullPage: true });
  console.log('[Screenshot] login_test_02_filled.png - 填写完成');
  
  // 点击登录按钮
  console.log('\n[Test] 点击登录按钮...');
  const loginBtn = page.locator('button[type="submit"], button:has-text("登录")');
  await loginBtn.click();
  
  // 等待一下看看发生了什么
  await page.waitForTimeout(3000);
  
  await page.screenshot({ path: 'g:/mediaProjects/fineSTEM/bug/login_test_03_after_click.png', fullPage: true });
  console.log('[Screenshot] login_test_03_after_click.png - 点击登录后');
  
  // 检查当前 URL
  const currentUrl = page.url();
  console.log(`\n[Result] 当前 URL: ${currentUrl}`);
  
  // 检查页面上是否有错误信息
  const errorText = await page.locator('.text-red-500, .bg-red-50, [role="alert"]').textContent().catch(() => null);
  console.log(`[Result] 页面错误提示: ${errorText || '(无)'}`);
  
  // 检查所有可见文本
  const bodyText = await page.locator('body').textContent();
  const hasErrorHint = bodyText.includes('错误') || bodyText.includes('失败') || bodyText.includes('错误');
  console.log(`[Result] 页面包含错误关键词: ${hasErrorHint}`);
  
  // 再试一次，用另一个密码
  console.log('\n\n===== 第二次尝试：使用密码 demo123456 =====');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  
  await page.fill('input[type="email"], input[name="email"], input[placeholder*="邮箱"]', '21749959@qq.com');
  await page.fill('input[type="password"], input[name="password"]', 'demo123456');
  await page.locator('button[type="submit"], button:has-text("登录")').click();
  await page.waitForTimeout(3000);
  
  await page.screenshot({ path: 'g:/mediaProjects/fineSTEM/bug/login_test_04_wrong_pwd.png', fullPage: true });
  console.log(`[Result] 当前 URL: ${page.url()}`);
  const errorText2 = await page.locator('.text-red-500, .bg-red-50, [role="alert"]').textContent().catch(() => null);
  console.log(`[Result] 页面错误提示: ${errorText2 || '(无)'}`);
  
  // 用测试账号试试
  console.log('\n\n===== 第三次尝试：使用测试账号 demo@finestem.dev =====');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  
  await page.fill('input[type="email"], input[name="email"], input[placeholder*="邮箱"]', 'demo@finestem.dev');
  await page.fill('input[type="password"], input[name="password"]', 'demo123456');
  await page.locator('button[type="submit"], button:has-text("登录")').click();
  await page.waitForTimeout(3000);
  
  await page.screenshot({ path: 'g:/mediaProjects/fineSTEM/bug/login_test_05_demo_user.png', fullPage: true });
  console.log(`[Result] 当前 URL: ${page.url()}`);
  
  console.log('\n[Test Complete]');
  await browser.close();
})().catch(e => {
  console.error('[Fatal]', e.message);
  process.exit(1);
});
