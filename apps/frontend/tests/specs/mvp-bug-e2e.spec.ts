/**
 * MVP Bug 全自动 UI 级测试
 * 
 * 完整流程：浏览器内登录 → 进入项目 → 聊天 → 检查 MVP
 */
import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:5184';
const PID = 'b686df08-6655-4edb-a3a5-955f3244abe1';
const EMAIL = '21749959@qq.com';
const PWD = '750714hf';

const MVP_FINGERPRINTS = [
  'fineSTEM MVP',
  '我的 STEM 项目 MVP',
  'actionButton',
  '已成功运行',
  '这是一个可运行的最小版本',
  '已生成一个可运行的最小代码版本',
  '最小代码版本',
  '最小可运行版本',
];

function checkMvp(text: string): string[] {
  return MVP_FINGERPRINTS.filter(f => text.includes(f));
}

test('MVP Bug - full UI automation', async ({ page }) => {
  const failures: string[] = [];

  /* ---------- Step 1: Login in browser ---------- */
  console.log('▶ Step 1: Login');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  
  // Fill login form
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="邮箱"], input[placeholder*="email"]').first();
  const pwdInput = page.locator('input[type="password"], input[name="password"], input[placeholder*="密码"]').first();
  
  if (await emailInput.count() > 0) {
    await emailInput.fill(EMAIL);
  } else {
    // Try alternative: might be a single input or different layout
    const allInputs = page.locator('input');
    const count = await allInputs.count();
    console.log(`  Found ${count} inputs on login page`);
    if (count >= 2) {
      await allInputs.nth(0).fill(EMAIL);
      await allInputs.nth(1).fill(PWD);
    }
  }
  
  if (await pwdInput.count() > 0) {
    await pwdInput.fill(PWD);
  }
  
  // Click login button
  const loginBtn = page.locator('button:has-text("登录"), button[type="submit"]').first();
  if (await loginBtn.count() > 0) {
    await loginBtn.click();
  } else {
    await page.keyboard.press('Enter');
  }
  
  // Wait for navigation after login
  await page.waitForTimeout(5000);
  await page.waitForLoadState('networkidle').catch(() => {});
  console.log(`  ✓ Logged in, URL: ${page.url()}`);

  /* ---------- Step 2: Navigate to project ---------- */
  console.log('▶ Step 2: Navigate to project');
  await page.goto(`${BASE}/create?id=${PID}`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/mvp-e2e-01-project.png' });

  /* ---------- Step 3: Check initial editor state via API context ---------- */
  console.log('▶ Step 3: Check workspace via API');
  let wsCleanBefore = true;
  try {
    const wsResp = await page.request.get(`http://localhost:3200/api/v1/projects/${PID}/workspace`, {
      headers: { 
        // Try to get cookie-based auth
      },
    }).catch(() => null);
    if (wsResp && wsResp.ok()) {
      const wsData = await wsResp.json();
      const code = (wsData.data?.workspace as any)?.code || '';
      const mvp = checkMvp(code);
      if (mvp.length > 0) {
        failures.push(`Workspace has MVP BEFORE: ${mvp.join(', ')}`);
        wsCleanBefore = false;
      } else {
        console.log(`  ✓ Workspace clean (code_len=${code.length})`);
      }
    } else {
      console.log(`  ⚠ Could not check workspace API (auth needed)`);
    }
  } catch(e) {
    console.log(`  ⚠ Workspace check skipped: ${e}`);
  }

  /* ---------- Step 4: Send chat message ---------- */
  console.log('▶ Step 4: Send chat message');
  
  // Find chat textarea
  const chatSel = 'textarea';
  const chatEl = page.locator(chatSel).first();
  expect(await chatEl.count(), 'Chat textarea should exist').toBeGreaterThan(0);
  await chatEl.click({ timeout: 5000 });
  await chatEl.fill('恢复之前的故事代码，把4个文件都写好，不要最小版本不要MVP');

  // Send
  const sendSelectors = ['button:has-text("发送")', 'button[class*="send"]', 'button[type="submit"]'];
  let sent = false;
  for (const sel of sendSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.count() > 0 && await btn.isVisible()) {
      await btn.click();
      sent = true;
      break;
    }
  }
  if (!sent) {
    await chatEl.press('Enter');
  }
  console.log(`  ✓ Message sent`);

  /* ---------- Step 5: Wait for AI response ---------- */
  console.log('▶ Step 5: Wait for AI response...');
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(5000);
    const bodyText = await page.locator('body').textContent() || '';
    // Check for signs of AI response completion
    if (bodyText.includes('index.html') || bodyText.includes('文件') && bodyText.length > 400) {
      console.log(`  ✓ AI responded after ${(i+1)*5}s`);
      break;
    }
  }
  await page.waitForTimeout(3000); // extra buffer
  await page.screenshot({ path: 'test-results/mvp-e2e-02-after-chat.png' });

  /* ---------- Step 6: Full page MVP scan ---------- */
  console.log('▶ Step 6: Scan for MVP fingerprints');
  const pageText = await page.locator('body').textContent() || '';
  const mvpOnPage = checkMvp(pageText);
  if (mvpOnPage.length > 0) {
    failures.push(`MVP on PAGE: ${mvpOnPage.join(', ')}`);
    console.error(`  ✗ MVP on page: ${mvpOnPage}`);
    for (const m of mvpOnPage) {
      const idx = pageText.indexOf(m);
      console.error(`    ...${pageText.substring(Math.max(0,idx-50), idx+m.length+50)}...`);
    }
  } else {
    console.log(`  ✓ No MVP on page (page_text_len=${pageText.length})`);
  }

  /* ---------- Step 7: Check editor specifically ---------- */
  console.log('▶ Step 7: Check editor area');
  const editorSels = ['.monaco-editor', '[class*="editor"] code', '.view-lines', 'pre.code'];
  for (const esel of editorSels) {
    const el = page.locator(esel).first();
    if (await el.count() > 0 && await el.isVisible()) {
      const txt = await el.textContent() || '';
      const mvp = checkMvp(txt);
      if (mvp.length > 0) {
        failures.push(`MVP in EDITOR [${esel}]: ${mvp.join(', ')}`);
        console.error(`  ✗ MVP in [${esel}]: ${mvp}`);
      } else {
        console.log(`  ✓ Editor [${esel}] clean (${txt.length} chars)`);
      }
    }
  }

  /* ---------- Final verdict ---------- */
  console.log('\n' + '='.repeat(50));
  if (failures.length === 0) {
    console.log('✅✅✅  ALL CHECKS PASSED - NO MVP DETECTED ✅✅✅');
  } else {
    console.log(`❌❌❌  ${failures.length} FAILURE(S) ❌❌❌`);
    for (const f of failures) console.log(`  • ${f}`);
  }
  console.log('='.repeat(50));

  expect(failures, 'Zero MVP detections expected').toHaveLength(0);
});
