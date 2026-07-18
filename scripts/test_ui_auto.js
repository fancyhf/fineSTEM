const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  console.log('[Test] 1. 打开登录页面');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'g:/mediaProjects/fineSTEM/bug/ui_test_01_login.png' });

  console.log('[Test] 2. 登录');
  await page.fill('input[type="email"]', '21749959@qq.com');
  await page.fill('input[type="password"]', 'stem2026');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'g:/mediaProjects/fineSTEM/bug/ui_test_02_logged_in.png' });

  console.log('[Test] 3. 进入创造页面');
  await page.goto('http://localhost:5173/create');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'g:/mediaProjects/fineSTEM/bug/ui_test_03_create_page.png', fullPage: true });

  // 检查代码区工具栏是否可见
  const toolbarVisible = await page.isVisible('text=代码').catch(() => false);
  console.log(`[Check] 工具栏可见: ${toolbarVisible}`);

  // 检查编辑器是否已显示
  const editorVisible = await page.isVisible('[data-testid="code-editor"], .monaco-editor').catch(() => false);
  console.log(`[Check] 编辑器可见: ${editorVisible}`);

  // 如果没有显示编辑器，尝试打开一个项目
  if (!editorVisible) {
    console.log('[Test] 4. 尝试打开最近项目');
    // 点击项目列表中的第一个项目
    const projectLinks = await page.locator('text=/项目|📍/').all();
    if (projectLinks.length > 0) {
      await projectLinks[0].click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'g:/mediaProjects/fineSTEM/bug/ui_test_04_project_opened.png', fullPage: true });
    }
  }

  // 检查代码区内容
  const codeContent = await page.locator('.monaco-editor textarea').inputValue().catch(() => '无法获取');
  console.log(`[Check] 编辑器代码前200字符: ${codeContent.substring(0, 200)}`);

  // 检查预览区
  const previewVisible = await page.isVisible('text=运行结果').catch(() => false);
  console.log(`[Check] 预览区可见: ${previewVisible}`);

  // 尝试点击运行按钮
  const runButton = await page.locator('button:has-text("运行"), button:has([data-icon="play"])').first();
  if (await runButton.isVisible().catch(() => false)) {
    console.log('[Test] 5. 点击运行按钮');
    await runButton.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'g:/mediaProjects/fineSTEM/bug/ui_test_05_after_run.png', fullPage: true });
  }

  console.log('[Test] 完成');
  await browser.close();
})().catch(e => {
  console.error('[Fatal]', e);
  process.exit(1);
});
