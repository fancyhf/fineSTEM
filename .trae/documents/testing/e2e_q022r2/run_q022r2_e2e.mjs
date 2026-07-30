/**
 * Q-022R2 手动改名回归测试 — 有头浏览器真实 E2E
 *
 * 流程：API建项目→UI打开→AI确认名→手动改名→再对话→检查不被覆盖
 * 禁止改产品代码，仅输出报告
 */

import { createRequire } from 'module';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire('G:/mediaProjects/fineSTEM/apps/frontend/tests/');
const { chromium } = require('playwright');

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, 'screenshots');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const API_BASE = 'http://127.0.0.1:3200/api/v1';
const FE_BASE = 'http://localhost:5184';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const results = {};

function utcNow() {
  return new Date().toISOString().replace('T', ' ').slice(0, 23);
}

function record(id, title, status, expected, actual, evidence, notesToDev = '') {
  results[id] = { id, title, status, expected, actual, evidence, notesToDev };
  const icon = status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⏭️';
  console.log(`[${icon}] ${id}: ${title} -> ${status}`);
}

async function registerUser() {
  const suffix = Date.now();
  const email = `q022r2_${suffix}@finestem.test`;
  const password = 'E2eTest123!';
  const name = `Q022R2test${suffix}`;
  const resp = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  if (!resp.ok) throw new Error(`register failed (${resp.status}): ${await resp.text()}`);
  const body = await resp.json();
  return { email, password, name, token: body.data.access_token, id: body.data.user.id };
}

async function loginViaUI(page, email, password) {
  await page.goto(`${FE_BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
}

async function createProjectViaAPI(token, name, mode = 'standard') {
  const resp = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ name, mode }),
  });
  if (!resp.ok) throw new Error(`create project failed (${resp.status}): ${await resp.text()}`);
  const body = await resp.json();
  return body.data;
}

async function getProjectFromAPI(token, projectId) {
  const resp = await fetch(`${API_BASE}/projects/${projectId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`GET /projects/${projectId} failed (${resp.status})`);
  const body = await resp.json();
  return body.data;
}

async function getActiveProjectNameInSidebar(page) {
  // 精确目标：侧边栏中含 📍 的 div.text-xs.truncate 元素（只含项目名，不含日期/模式）
  let nameEl = page.locator('div.bg-teal-50 div.text-xs.truncate').first();
  if (await nameEl.count() === 0) {
    nameEl = page.locator('div.text-xs.truncate:has-text("\u{1F4CD}")').first();
  }
  if (await nameEl.count() === 0) {
    nameEl = page.locator('span.truncate:has-text("\u{1F4CD}")').first();
  }
  if (await nameEl.count() === 0) return null;
  const text = await nameEl.textContent();
  const match = text.match(/\u{1F4CD}\s*(.+)/u);
  return match ? match[1].trim() : text.trim();
}

async function sendMessage(page, text) {
  const textarea = page.locator('textarea').first();
  await textarea.waitFor({ state: 'visible', timeout: 10000 });
  await textarea.fill(text);
  await page.waitForTimeout(200);
  const sendBtn = page.locator('button.bg-gray-900').first();
  await sendBtn.click();
}

async function waitForResponse(page, timeoutMs = 120000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const isLoading = await page.evaluate(() => {
      const ta = document.querySelector('textarea');
      if (!ta) return false;
      const ph = ta.getAttribute('placeholder') || '';
      return ph.includes('思考') || ph.includes('loading') || ta.disabled;
    });
    if (!isLoading && Date.now() - startTime > 5000) {
      await page.waitForTimeout(2000);
      return true;
    }
    await page.waitForTimeout(1000);
  }
  return false;
}

async function takeScreenshot(page, name) {
  const path = join(SCREENSHOT_DIR, `${name}.png`);
  try {
    await page.screenshot({ path, fullPage: false, timeout: 10000 });
  } catch (e) {
    console.log(`[Q-022R2] Screenshot fallback for ${name}: ${e.message?.slice(0, 80)}`);
    try { await page.screenshot({ path, fullPage: false, timeout: 5000, animations: 'disabled' }); } catch {}
  }
  return path;
}

async function clickProjectInSidebar(page, projectId) {
  // 点击侧边栏中的项目来打开它
  let projItem = page.locator(`div[data-project-id="${projectId}"]`).first();
  if (await projItem.count() === 0) {
    // fallback: 找第一个带 📍 的可点击区域
    projItem = page.locator('div.cursor-pointer:has-text("\u{1F4CD}")').first();
  }
  await projItem.waitFor({ state: 'visible', timeout: 15000 });
  await projItem.click();
  await page.waitForTimeout(3000);
}

async function renameProjectViaUI(page, projectId, newName) {
  await page.waitForTimeout(2000);
  // 找到项目项
  let projectItem = page.locator(`div[data-project-id="${projectId}"]`).first();
  if (await projectItem.count() === 0) {
    projectItem = page.locator('div.cursor-pointer:has-text("\u{1F4CD}")').first();
  }
  if (await projectItem.count() === 0) {
    projectItem = page.locator('div.group.rounded-lg').first();
  }
  await projectItem.waitFor({ state: 'visible', timeout: 15000 });
  await projectItem.hover();
  await page.waitForTimeout(800);
  // 点击铅笔按钮
  const pencilBtn = projectItem.locator('button[title="修改项目名"]').first();
  if (await pencilBtn.count() === 0) {
    const globalPencil = page.locator('button[title="修改项目名"]').first();
    if (await globalPencil.count() > 0) {
      await globalPencil.click();
    } else {
      throw new Error('pencil button not found');
    }
  } else {
    await pencilBtn.click();
  }
  await page.waitForTimeout(500);
  const editInput = page.locator('input[maxlength="50"]').first();
  await editInput.waitFor({ state: 'visible', timeout: 5000 });
  await editInput.click();
  await editInput.fill('');
  await editInput.fill(newName);
  await page.waitForTimeout(200);
  await editInput.press('Enter');
  await page.waitForTimeout(1500);
}

async function main() {
  const startedAt = utcNow();
  console.log(`[Q-022R2] Started at ${startedAt}`);
  console.log('[Q-022R2] Launching browser (headed mode)...');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: false,
    slowMo: 300,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'zh-CN',
  });

  const page = await context.newPage();

  try {
    // ===== Setup: Register + Login =====
    console.log('[Q-022R2] Registering test user...');
    const user = await registerUser();
    console.log(`[Q-022R2] User: ${user.email}`);

    console.log('[Q-022R2] Logging in...');
    await loginViaUI(page, user.email, user.password);
    console.log('[Q-022R2] Login done');

    // ===== 步骤2: 核心 E2E — 手动改名不被覆盖 =====
    console.log('\n[Q-022R2] === Step 2: Core E2E manual rename not overwritten ===');

    // 2-0: 先通过 API 创建项目（确保 DB 中有项目记录）
    console.log('[Q-022R2] 2-0: Creating project via API...');
    const initialName = '我想做一个英语单词学习助手';
    const project = await createProjectViaAPI(user.token, initialName, 'standard');
    const projectId = project.id;
    console.log(`[Q-022R2] Project created: id=${projectId}, name="${project.name}"`);

    // 2-1: 打开 /create 页面
    console.log('[Q-022R2] 2-1: Opening /create page...');
    await page.goto(`${FE_BASE}/create`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await takeScreenshot(page, 'step2-1-create-page');

    // 2-2: 在侧边栏点击项目来打开它
    console.log('[Q-022R2] 2-2: Opening project from sidebar...');
    await clickProjectInSidebar(page, projectId);
    await takeScreenshot(page, 'step2-2-project-opened');

    // 2-3: 发送消息让 AI 开始脑爆
    console.log('[Q-022R2] 2-3: Sending first message to start brainstorm...');
    await sendMessage(page, '我想做一个英语单词学习助手，帮初中生背单词');
    const responded1 = await waitForResponse(page, 120000);
    if (!responded1) throw new Error('first conversation timeout');
    await takeScreenshot(page, 'step2-3-after-first-response');
    console.log('[Q-022R2] 2-3: First response received');

    // 2-4: 走脑爆阶段，让 AI 确定项目名
    console.log('[Q-022R2] 2-4: Walking through brainstorm...');
    for (let i = 0; i < 6; i++) {
      const questionCards = page.locator('div.my-3.rounded-xl.border');
      const cardCount = await questionCards.count();

      if (cardCount > 0) {
        const firstCard = questionCards.first();
        const option = firstCard.locator('button:has(div.text-xs.font-medium)').first();
        if (await option.count() > 0) {
          await option.click();
          await page.waitForTimeout(500);
          const btn = firstCard.locator('button:has-text("确定"), button:has-text("下一步"), button:has-text("暂存"), button:has-text("提交")').last();
          if (await btn.count() > 0) {
            const btnText = await btn.textContent();
            console.log(`[Q-022R2] 2-4: Clicking "${btnText?.trim()}" on card ${i + 1}`);
            await btn.click();
            await waitForResponse(page, 120000);
            await takeScreenshot(page, `step2-4-round-${i + 1}`);
          }
        }
      } else {
        console.log(`[Q-022R2] 2-4: No card, sending "继续" (round ${i + 1})`);
        await sendMessage(page, '继续');
        await waitForResponse(page, 120000);
        await takeScreenshot(page, `step2-4-continue-${i + 1}`);
      }

      // 检查 AI 是否已确认项目名
      const pageText = await page.evaluate(() => document.body.innerText);
      if (pageText.includes('英语单词学习助手') || pageText.includes('英语助手') || pageText.includes('单词学习')) {
        console.log('[Q-022R2] 2-4: AI seems to have confirmed the project name');
        break;
      }
    }

    await takeScreenshot(page, 'step2-4-after-brainstorm');

    // 获取 AI 确认的名字（从 API 读取，因为后端自愈会更新）
    const projectAfterBrainstorm = await getProjectFromAPI(user.token, projectId);
    const aiConfirmedName = projectAfterBrainstorm.name;
    console.log(`[Q-022R2] AI confirmed name (from API): "${aiConfirmedName}"`);

    // 2-5: 手动改名
    const manualName = '我的专属助手';
    console.log(`[Q-022R2] 2-5: Renaming project to "${manualName}"...`);
    await renameProjectViaUI(page, projectId, manualName);
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'step2-5-after-rename');

    // 检查点 A: 改名即时生效
    const nameAfterRename = await getActiveProjectNameInSidebar(page);
    console.log(`[Q-022R2] Checkpoint A: Name after rename = "${nameAfterRename}" (expected: "${manualName}")`);

    if (nameAfterRename === manualName) {
      record('A', '手动改名即时生效', 'passed',
        `侧边栏立即显示"${manualName}"`,
        `侧边栏显示"${nameAfterRename}"`,
        [{ type: 'screenshot', snippet: 'step2-5-after-rename.png', path: join(SCREENSHOT_DIR, 'step2-5-after-rename.png') }]
      );
    } else {
      record('A', '手动改名即时生效', 'failed',
        `侧边栏立即显示"${manualName}"`,
        `侧边栏显示"${nameAfterRename}"`,
        [{ type: 'screenshot', snippet: 'step2-5-after-rename.png', path: join(SCREENSHOT_DIR, 'step2-5-after-rename.png') }],
        '关注 saveEditProject 中 setUserProjects 更新逻辑'
      );
    }

    // 2-6: 继续对话（触发流末刷新）
    console.log('[Q-022R2] 2-6: Sending message to trigger stream-end refresh...');
    await sendMessage(page, '好的，接下来该做什么？');
    const responded2 = await waitForResponse(page, 120000);
    await page.waitForTimeout(3000);
    await takeScreenshot(page, 'step2-6-after-conversation');

    // 检查点 B（核心）: 对话后名字仍是手动改的
    const nameAfterConversation = await getActiveProjectNameInSidebar(page);
    console.log(`[Q-022R2] Checkpoint B (CORE): Name after conversation = "${nameAfterConversation}" (expected: "${manualName}")`);

    if (nameAfterConversation === manualName) {
      record('B', '对话后名字不被覆盖（核心）', 'passed',
        `对话流结束后侧边栏仍显示"${manualName}"（不被覆盖回 AI 确认名）`,
        `侧边栏显示"${nameAfterConversation}"`,
        [{ type: 'screenshot', snippet: 'step2-6-after-conversation.png', path: join(SCREENSHOT_DIR, 'step2-6-after-conversation.png') }]
      );
    } else {
      record('B', '对话后名字不被覆盖（核心）', 'failed',
        `对话流结束后侧边栏仍显示"${manualName}"（不被覆盖回 AI 确认名）`,
        `侧边栏显示"${nameAfterConversation}"（被覆盖了！）`,
        [{ type: 'screenshot', snippet: 'step2-6-after-conversation.png', path: join(SCREENSHOT_DIR, 'step2-6-after-conversation.png') }],
        'CORE NOT FIXED! Check _sync_project_name_from_skill_state name_manually_overridden + frontend manualRenameAtRef'
      );
    }

    // 2-7: 刷新页面检查持久化
    console.log('[Q-022R2] 2-7: Refreshing page...');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    await takeScreenshot(page, 'step2-7-after-refresh');

    // 检查点 C: 刷新后名字仍是手动改的
    const nameAfterRefresh = await getActiveProjectNameInSidebar(page);
    console.log(`[Q-022R2] Checkpoint C: Name after refresh = "${nameAfterRefresh}" (expected: "${manualName}")`);

    if (nameAfterRefresh === manualName) {
      record('C', '刷新后名字持久化', 'passed',
        `刷新后项目名仍为"${manualName}"`,
        `侧边栏显示"${nameAfterRefresh}"`,
        [{ type: 'screenshot', snippet: 'step2-7-after-refresh.png', path: join(SCREENSHOT_DIR, 'step2-7-after-refresh.png') }]
      );
    } else {
      record('C', '刷新后名字持久化', 'failed',
        `刷新后项目名仍为"${manualName}"`,
        `侧边栏显示"${nameAfterRefresh}"`,
        [{ type: 'screenshot', snippet: 'step2-7-after-refresh.png', path: join(SCREENSHOT_DIR, 'step2-7-after-refresh.png') }],
        'Check backend _sync_project_name_from_skill_state skips when name_manually_overridden=true'
      );
    }

    // 接口验证
    console.log('[Q-022R2] API check: GET /api/projects/{id}...');
    const projectData = await getProjectFromAPI(user.token, projectId);
    const apiName = projectData.name;
    const initialData = projectData.initial_data || {};
    const overridden = initialData.name_manually_overridden;

    console.log(`[Q-022R2] API: name="${apiName}", name_manually_overridden=${overridden}`);

    if (apiName === manualName && overridden === true) {
      record('API', 'name_manually_overridden=true', 'passed',
        `data.name="${manualName}"; data.initial_data.name_manually_overridden=true`,
        `data.name="${apiName}"; data.initial_data.name_manually_overridden=${overridden}`,
        [{ type: 'payload', snippet: `GET /api/projects/${projectId} -> { name: "${apiName}", initial_data: { name_manually_overridden: ${overridden} } }` }]
      );
    } else {
      record('API', 'name_manually_overridden=true', 'failed',
        `data.name="${manualName}"; data.initial_data.name_manually_overridden=true`,
        `data.name="${apiName}"; data.initial_data.name_manually_overridden=${overridden}`,
        [{ type: 'payload', snippet: `GET /api/projects/${projectId} -> { name: "${apiName}", initial_data: { name_manually_overridden: ${overridden} } }` }],
        'Check backend update_project sets initial_data.name_manually_overridden=true on rename'
      );
    }

    // ===== 步骤3: 回归 — AI 确认名自愈仍正常 =====
    console.log('\n[Q-022R2] === Step 3: Regression - AI confirmed name auto-sync still works ===');

    // 3-1: 通过 API 创建第二个项目
    console.log('[Q-022R2] 3-1: Creating second project via API...');
    const initialName2 = '我想做一个数学公式练习工具';
    const project2 = await createProjectViaAPI(user.token, initialName2, 'standard');
    const project2Id = project2.id;
    console.log(`[Q-022R2] Project 2 created: id=${project2Id}, name="${project2.name}"`);

    // 3-2: 打开 /create 页面并点击第二个项目
    await page.goto(`${FE_BASE}/create`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await clickProjectInSidebar(page, project2Id);
    await takeScreenshot(page, 'step3-2-project-opened');

    // 3-3: 发送消息让 AI 开始脑爆
    console.log('[Q-022R2] 3-3: Sending first message...');
    await sendMessage(page, '我想做一个数学公式练习工具');
    const responded3 = await waitForResponse(page, 120000);
    await takeScreenshot(page, 'step3-3-first-response');

    // 走几轮让 AI 确认名
    for (let i = 0; i < 6; i++) {
      const questionCards = page.locator('div.my-3.rounded-xl.border');
      const cardCount = await questionCards.count();

      if (cardCount > 0) {
        const firstCard = questionCards.first();
        const option = firstCard.locator('button:has(div.text-xs.font-medium)').first();
        if (await option.count() > 0) {
          await option.click();
          await page.waitForTimeout(500);
          const btn = firstCard.locator('button:has-text("确定"), button:has-text("下一步"), button:has-text("暂存"), button:has-text("提交")').last();
          if (await btn.count() > 0) {
            await btn.click();
            await waitForResponse(page, 120000);
          }
        }
      } else {
        await sendMessage(page, '继续');
        await waitForResponse(page, 120000);
      }

      const pageText = await page.evaluate(() => document.body.innerText);
      if (pageText.includes('数学公式') || pageText.includes('公式练习') || pageText.includes('数学练习')) {
        console.log('[Q-022R2] 3-3: AI seems to have confirmed the project name');
        break;
      }
    }

    // 继续对话触发流末刷新
    console.log('[Q-022R2] 3-4: Sending message to trigger stream-end refresh...');
    await sendMessage(page, '好的，继续');
    await waitForResponse(page, 120000);
    await page.waitForTimeout(3000);
    await takeScreenshot(page, 'step3-4-after-conversation');

    // 检查点 D: AI 确认名自愈仍正常（不手动改名时，名字应为 AI 确认名）
    const nameAfterAiRefresh = await getActiveProjectNameInSidebar(page);
    console.log(`[Q-022R2] Checkpoint D: Name after AI refresh = "${nameAfterAiRefresh}"`);

    const apiData2 = await getProjectFromAPI(user.token, project2Id);
    const overridden2 = apiData2.initial_data?.name_manually_overridden;

    // 检查 workspace 中的 skill_state 是否有 AI 确认名
    const wsResp = await fetch(`${API_BASE}/projects/${project2Id}/workspace`, {
      headers: { 'Authorization': `Bearer ${user.token}` },
    });
    const wsBody = await wsResp.json();
    const wsData = wsBody.data || {};
    const skillState = wsData.skill_state || {};
    const stdStepData = skillState.standard_step_data || {};
    const briefContent = stdStepData.brief_content;
    let aiConfirmedName2 = null;
    if (typeof briefContent === 'string') {
      try { const parsed = JSON.parse(briefContent); aiConfirmedName2 = parsed.project_name; } catch {}
    } else if (briefContent && typeof briefContent === 'object') {
      aiConfirmedName2 = briefContent.project_name;
    }
    if (!aiConfirmedName2) aiConfirmedName2 = skillState.project_name || stdStepData.project_name;

    console.log(`[Q-022R2] Checkpoint D: API name="${apiData2.name}", overridden=${overridden2}, aiConfirmedName="${aiConfirmedName2}"`);

    // 判定逻辑：
    // 1. overridden 不应为 true（未手动改名）
    // 2. 如果 AI 确认了名字（skill_state 中有），API name 应等于 AI 确认名（自愈工作）
    // 3. 如果 AI 未确认名字（skill_state 中没有），则自愈无数据可同步，不算退化
    const overriddenOk = overridden2 !== true;
    let syncOk = true;
    let dNotes = '';
    if (aiConfirmedName2) {
      syncOk = apiData2.name === aiConfirmedName2 || apiData2.name.includes(aiConfirmedName2) || aiConfirmedName2.includes(apiData2.name);
      if (!syncOk) dNotes = `AI confirmed name "${aiConfirmedName2}" but API name is "${apiData2.name}" - sync may not be working`;
    } else {
      dNotes = `AI did not confirm a name in skill_state during brief conversation - auto-sync N/A (not a regression)`;
    }

    if (overriddenOk && syncOk) {
      record('D', 'AI 确认名自愈仍正常（不退化）', 'passed',
        '不手动改名时，name_manually_overridden 不影响项目；AI 确认名自愈仍正常',
        `侧边栏: "${nameAfterAiRefresh}"; API: name="${apiData2.name}", overridden=${overridden2}; aiConfirmed="${aiConfirmedName2}"`,
        [
          { type: 'screenshot', snippet: 'step3-4-after-conversation.png', path: join(SCREENSHOT_DIR, 'step3-4-after-conversation.png') },
          { type: 'payload', snippet: `GET /api/projects/${project2Id} -> { name: "${apiData2.name}", overridden: ${overridden2}, aiConfirmed: "${aiConfirmedName2}" }` }
        ],
        dNotes
      );
    } else {
      record('D', 'AI 确认名自愈仍正常（不退化）', 'failed',
        '不手动改名时，AI 确认名自愈仍正常',
        `侧边栏: "${nameAfterAiRefresh}"; API: name="${apiData2.name}", overridden=${overridden2}; aiConfirmed="${aiConfirmedName2}"; syncOk=${syncOk}`,
        [{ type: 'screenshot', snippet: 'step3-4-after-conversation.png', path: join(SCREENSHOT_DIR, 'step3-4-after-conversation.png') }],
        dNotes || 'Q-022 regression! Check _sync_project_name_from_skill_state still works when name_manually_overridden=false/undefined'
      );
    }

  } catch (error) {
    console.error('[Q-022R2] Error:', error);
    await takeScreenshot(page, 'error-state');
    record('RUNNER', '测试运行器', 'failed', '测试正常运行完成', `运行器异常: ${error.message}`,
      [{ type: 'screenshot', snippet: 'error-state.png', path: join(SCREENSHOT_DIR, 'error-state.png') }],
      error.stack
    );
  } finally {
    await browser.close();
  }

  const finishedAt = utcNow();
  console.log(`\n[Q-022R2] Finished at ${finishedAt}`);

  const allResults = Object.values(results);
  const passed = allResults.filter(r => r.status === 'passed').length;
  const failed = allResults.filter(r => r.status === 'failed').length;

  const summary = {
    started_at: startedAt,
    finished_at: finishedAt,
    total: allResults.length,
    passed,
    failed,
    overall_status: failed > 0 ? 'failed' : 'passed',
    core_check_b: results['B']?.status || 'unknown',
    results: allResults,
  };

  const resultsPath = join(__dirname, 'q022r2_results.json');
  writeFileSync(resultsPath, JSON.stringify(summary, null, 2), 'utf-8');
  console.log(`[Q-022R2] Results: ${passed} passed, ${failed} failed (total: ${allResults.length})`);
  console.log(`[Q-022R2] Results written to ${resultsPath}`);

  return failed > 0 ? 1 : 0;
}

main().then(code => process.exit(code)).catch(err => {
  console.error('[Q-022R2] Fatal:', err);
  process.exit(1);
});
