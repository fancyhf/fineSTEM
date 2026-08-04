/**
 * 登录冒烟测试 - 打开页面并登录
 * 
 * 验证：打开浏览器 → 填写登录表单 → 点击登录 → 验证跳转成功
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5184';
const EMAIL = '21749959@qq.com';
const PWD = '750714hf';

test('登录测试：打开页面并登录', async ({ page }) => {
  // 监听控制台错误
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log(`[Console Error] ${msg.text()}`);
    }
  });

  // Step 1: 打开登录页面
  console.log('▶ Step 1: 打开登录页面');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);

  // 验证登录页面关键元素存在
  const emailInput = page.locator('input[type="email"]').first();
  const pwdInput = page.locator('input[type="password"]').first();
  const loginBtn = page.locator('button[type="submit"]').first();

  await expect(emailInput).toBeVisible({ timeout: 10000 });
  await expect(pwdInput).toBeVisible({ timeout: 10000 });
  await expect(loginBtn).toBeVisible({ timeout: 10000 });
  console.log('  ✓ 登录表单元素可见');

  // 截图：初始登录页面
  await page.screenshot({ path: 'test-results/login-smoke-01-page.png', fullPage: true });
  console.log('  📸 截图: login-smoke-01-page.png');

  // Step 2: 填写登录表单
  console.log('▶ Step 2: 填写登录表单');
  await emailInput.fill(EMAIL);
  await pwdInput.fill(PWD);

  // 截图：填写完成
  await page.screenshot({ path: 'test-results/login-smoke-02-filled.png', fullPage: true });
  console.log('  📸 截图: login-smoke-02-filled.png');

  // Step 3: 点击登录按钮
  console.log('▶ Step 3: 点击登录按钮');
  await loginBtn.click();

  // 等待页面跳转（登录成功后应跳转到首页）
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);

  const currentUrl = page.url();
  console.log(`  当前 URL: ${currentUrl}`);

  // 截图：登录后
  await page.screenshot({ path: 'test-results/login-smoke-03-after-login.png', fullPage: true });
  console.log('  📸 截图: login-smoke-03-after-login.png');

  // Step 4: 验证登录成功
  console.log('▶ Step 4: 验证登录结果');
  
  // 检查是否已跳转离开登录页
  expect(currentUrl).not.toContain('/login');
  console.log('  ✓ 已跳转离开登录页');

  // 检查 localStorage 中是否有 auth_token
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  expect(token).toBeTruthy();
  console.log(`  ✓ auth_token 已保存 (长度: ${token?.length})`);

  // 检查页面上是否有用户名显示或其他登录后元素
  const bodyText = await page.locator('body').textContent();
  expect(bodyText).toBeTruthy();
  expect(bodyText!.length).toBeGreaterThan(50);
  console.log(`  ✓ 页面内容正常 (长度: ${bodyText?.length})`);

  // 输出控制台错误（如果有）
  if (consoleErrors.length > 0) {
    console.log(`\n⚠️  控制台错误 (${consoleErrors.length} 个):`);
    consoleErrors.forEach(e => console.log(`   - ${e}`));
  } else {
    console.log('\n✓ 无控制台错误');
  }

  console.log('\n✅ 登录测试通过！');
});
