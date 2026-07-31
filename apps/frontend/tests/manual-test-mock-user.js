/**
 * MOCK_USER 实测脚本 v2（2026-07-30 重写）
 *
 * v1 的两个测量缺陷（已由数据库证据证实）：
 *  A. 只量聊天气泡文本长度——AI 按 PBL 流程先发问题卡，v1 从不答卡，
 *     代码生成从未开始，1279 字符只是开场白+问题卡，不是代码。
 *  B. "刷新继续聊 ✅"是误报——刷新后上下文全丢，"继续完善"新建了第二个项目
 *     （DB：10:55 a133bd66 / 10:56 46a30679 两个项目）。
 *
 * v2 测试流程：
 *  1. MOCK_USER 登录
 *  2. 发起项目请求 → 自动回答问题卡（点选项+下一步/确定），循环推进 PBL 阶段
 *  3. 通过后端 workspace API 测量真实代码行数（编辑器代码 + 项目文件），目标 ≥400 行
 *  4. F5 刷新 → 断言项目 ID 不变 + 历史消息恢复 → "继续完善"仍落在同一项目（核心断言）
 *  5. 汇报"按钮没反应" → 断言 AI 调用 project_code_reader
 *  6. 全程监听 Invalid JSON 控制台错误
 *
 * 运行：cd apps/frontend/tests && node manual-test-mock-user.js
 */

const { chromium } = require('playwright-core');

const FRONTEND_BASE = 'http://localhost:5184';
const MOCK_USER_EMAIL = '2749959@qq.com';
const MOCK_USER_PASSWORD = '750714hf';
const SHOT_DIR = '../../../test-results';

// ── 结果汇总 ──
const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`   ${pass ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}

let invalidJsonCount = 0;
let codeReaderCalled = false;

// ── 基础工具 ──
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

/** 等 AI 一轮回复结束：输入框重新可用且稳定 2 秒 */
async function waitForAIResponse(page, timeout = 300000) {
  const start = Date.now();
  // 先等它进入 loading（最多 10 秒，防止发送未生效直接通过）
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

// ── 问题卡自动回答 ──
/** 回答当前问题卡：优先点"推荐"选项，不够就顺序补点直到提交按钮可用 */
async function answerQuestionCard(page) {
  const card = page.locator('[data-testid="question-card"]').last();
  const options = card.locator('[data-testid="question-option"]');
  const submit = card.locator('button').filter({ hasText: /下一步|确定/ }).last();
  const n = await options.count();
  if (n === 0) return false;

  // 优先点带"推荐"的选项
  const recommended = options.filter({ hasText: '推荐' });
  if (await recommended.count() > 0) {
    await recommended.first().click();
  } else {
    await options.first().click();
  }
  // requireEachGroup 卡片：一个选项不够时顺序补点其它选项
  for (let i = 0; i < n; i++) {
    if (await submit.isEnabled().catch(() => false)) break;
    await options.nth(i).click().catch(() => {});
    await page.waitForTimeout(300);
  }
  if (!(await submit.isEnabled().catch(() => false))) {
    console.log('   ⚠️ 问题卡提交按钮始终不可用，跳过该卡');
    return false;
  }
  const title = (await card.locator('p').first().textContent().catch(() => '')) || '';
  console.log(`   答卡: ${title.trim().slice(0, 40)}`);
  await submit.click();
  return true;
}

// ── 后端 API 测量（在页面上下文里带 token 调用） ──
async function fetchWorkspace(page) {
  return await page.evaluate(async () => {
    const pid = sessionStorage.getItem('finestem_active_project_id');
    if (!pid) return { error: 'no active project id' };
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`/api/v1/projects/${pid}/workspace`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      return { pid, status: res.status, payload: data.data || null };
    } catch (e) {
      return { pid, error: String(e) };
    }
  });
}

/** 统计真实代码行数：主编辑器代码 + 所有项目文件，取总和与最大单文件 */
function measureCode(wsResult) {
  const ws = wsResult?.payload?.workspace;
  if (!ws) return { totalLines: 0, maxFileLines: 0, files: [] };
  const files = [];
  const countLines = (s) => (s || '').split('\n').filter((l) => l.trim() !== '').length;
  if (ws.code) files.push({ name: ws.filename || '(editor)', lines: countLines(ws.code) });
  for (const f of ws.files || []) {
    if (!files.some((x) => x.name === f.name)) files.push({ name: f.name, lines: countLines(f.content) });
  }
  const totalLines = files.reduce((a, b) => a + b.lines, 0);
  const maxFileLines = files.reduce((a, b) => Math.max(a, b.lines), 0);
  return { totalLines, maxFileLines, files };
}

async function getActivePid(page) {
  return await page.evaluate(() => sessionStorage.getItem('finestem_active_project_id'));
}

async function getMessageCount(page) {
  return await page.locator('[data-testid="message-user"], [data-testid="message-assistant"]').count();
}

// ── 主流程 ──
(async () => {
  console.log('=== MOCK_USER 实测 v2 开始 ===\n');

  const browser = await chromium.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('Invalid JSON')) {
      invalidJsonCount++;
      console.log(`[浏览器日志][InvalidJSON] ${text.slice(0, 120)}`);
    }
    if (text.includes('project_code_reader')) {
      codeReaderCalled = true;
      console.log(`[浏览器日志][code_reader] ${text.slice(0, 120)}`);
    }
    if (text.includes('[restore]')) {
      console.log(`[浏览器日志] ${text.slice(0, 150)}`);
    }
  });

  try {
    // 1. 登录
    console.log('1. MOCK_USER 登录...');
    await page.goto(`${FRONTEND_BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', MOCK_USER_EMAIL);
    await page.fill('input[type="password"]', MOCK_USER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(explore|dashboard|research|create)/, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const loggedIn = !page.url().includes('/login');
    record('MOCK_USER 登录', loggedIn, page.url());
    await shot(page, 'v2-01-logged-in');
    if (!loggedIn) throw new Error('登录失败，终止');

    // 2. 进 Create，发起项目请求
    console.log('\n2. 发起项目请求并自动推进 PBL 流程...');
    await page.goto(`${FRONTEND_BASE}/create`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await sendMessage(
      page,
      '我想做一个待办事项管理应用。我是高中生，请尽快带我进入编码实现阶段，' +
        '最终要一个完整的 HTML 单页（含 CSS 和 JavaScript，总代码 400 行以上），功能完整并写入项目文件。',
    );
    await waitForAIResponse(page).catch((e) => console.log('   ⚠️ ' + e.message));

    // 3. 循环：答卡 / 催进编码，直到代码落盘 ≥400 行或轮数用尽
    console.log('\n3. 自动答卡 + 推进编码，验证 400+ 行代码落盘...');
    const NUDGES = [
      '好的，请直接进入编码实现阶段，把完整代码写入项目文件。',
      '请现在就开始写代码：一个完整的待办事项 HTML 页面，含增删改查、筛选、统计，400 行以上，写入项目文件。',
      '继续，把剩余代码写完并保存到项目文件里。',
      '请继续完成代码，确保功能完整。',
    ];
    let nudgeIdx = 0;
    let measure = { totalLines: 0, maxFileLines: 0, files: [] };
    for (let round = 1; round <= 16; round++) {
      // 有问题卡先答卡
      if (await page.locator('[data-testid="question-card"]').count().catch(() => 0)) {
        const answered = await answerQuestionCard(page);
        if (answered) {
          await waitForAIResponse(page).catch((e) => console.log('   ⚠️ ' + e.message));
          continue;
        }
      }
      // 测量后端真实代码
      const ws = await fetchWorkspace(page);
      measure = measureCode(ws);
      console.log(`   第 ${round} 轮：项目=${(ws.pid || '无').slice(0, 8)} 代码总行数=${measure.totalLines} 文件=${measure.files.map((f) => `${f.name}:${f.lines}`).join(', ') || '无'}`);
      if (measure.totalLines >= 400) break;
      if (nudgeIdx >= NUDGES.length) break;
      await sendMessage(page, NUDGES[nudgeIdx++]);
      await waitForAIResponse(page, 420000).catch((e) => console.log('   ⚠️ ' + e.message));
    }
    record('400+ 行代码落盘（后端 workspace 实测）', measure.totalLines >= 400, `总 ${measure.totalLines} 行，最大单文件 ${measure.maxFileLines} 行`);
    record('全程无 Invalid JSON 错误', invalidJsonCount === 0, `出现 ${invalidJsonCount} 次`);
    await shot(page, 'v2-02-code-generated');

    // 4. F5 刷新恢复测试（核心：同一项目、历史恢复、继续聊不建新项目）
    console.log('\n4. F5 刷新恢复测试...');
    const pidBefore = await getActivePid(page);
    const msgCountBefore = await getMessageCount(page);
    console.log(`   刷新前：项目=${(pidBefore || '无').slice(0, 8)} 消息数=${msgCountBefore}`);

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(8000); // 等 F5 兜底恢复完成

    const pidAfterReload = await getActivePid(page);
    const msgCountAfterReload = await getMessageCount(page);
    record('刷新后项目 ID 保持', !!pidBefore && pidAfterReload === pidBefore, `${(pidBefore || '').slice(0, 8)} → ${(pidAfterReload || '无').slice(0, 8)}`);
    record('刷新后历史消息恢复', msgCountAfterReload > 0, `恢复 ${msgCountAfterReload} 条（刷新前 ${msgCountBefore} 条）`);
    await shot(page, 'v2-03-after-refresh');

    await sendMessage(page, '继续完善这个待办应用，添加本地存储功能');
    await waitForAIResponse(page).catch((e) => console.log('   ⚠️ ' + e.message));
    const pidAfterContinue = await getActivePid(page);
    record('继续聊未新建项目（核心断言）', pidAfterContinue === pidBefore, `${(pidBefore || '').slice(0, 8)} → ${(pidAfterContinue || '无').slice(0, 8)}`);
    await shot(page, 'v2-04-continue');

    // 5. 汇报"按钮没反应" → AI 应调 project_code_reader
    console.log('\n5. 汇报"按钮没反应"，验证 AI 读代码...');
    codeReaderCalled = false;
    await sendMessage(page, '我发现添加任务的按钮没反应，请帮我检查一下');
    await waitForAIResponse(page).catch((e) => console.log('   ⚠️ ' + e.message));
    record('AI 调用 project_code_reader 诊断', codeReaderCalled, codeReaderCalled ? '控制台捕获到工具调用' : '未捕获到工具调用');
    await shot(page, 'v2-05-button-fix');

    // 6. 汇总
    console.log('\n=== 测试结果汇总 ===');
    for (const r of results) console.log(` ${r.pass ? '✅' : '❌'} ${r.name} — ${r.detail}`);
    const passed = results.filter((r) => r.pass).length;
    console.log(`\n通过 ${passed}/${results.length}`);
    console.log('\n浏览器保持打开 2 分钟供手动检查...');
    await page.waitForTimeout(120000);
  } catch (error) {
    console.error('测试出错:', error.message);
    await shot(page, 'v2-error').catch(() => {});
  }

  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
})();
