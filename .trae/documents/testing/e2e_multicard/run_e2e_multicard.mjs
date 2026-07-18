/**
 * fineSTEM R2 E2E 多卡并列 + 批量提交 浏览器真实测试脚本
 *
 * 用途：通过真实浏览器验证 TC-MQ-001~007 用例
 * 约束：不修改任何业务文件，仅输出到 .trae/documents/testing/
 * 运行：node .trae/documents/testing/e2e_multicard/run_e2e_multicard.mjs
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

const results = [];
const wsMessages = [];

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -1);
}

function utcNow() {
  return new Date().toISOString().replace('T', ' ').slice(0, 23);
}

function record(id, title, category, status, expected, actual, evidence, durationMs, classification = '', severity = '', reproSteps = [], notesToDev = '') {
  results.push({
    id, title, category, type: 'e2e',
    entry: 'browser: Playwright Chromium (system Chrome)',
    status, duration_ms: durationMs,
    expected, actual, evidence,
    classification, severity,
    reproducible: status === 'failed' ? 'always' : 'n/a',
    repro_steps: reproSteps,
    first_seen_round: 2,
    notes_to_dev: notesToDev,
  });
}

async function registerUser() {
  const suffix = Date.now();
  const email = `e2e_r2_${suffix}@finestem.test`;
  const password = 'E2eTest123!';
  const name = `R2测试学生${suffix}`;

  const resp = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  if (!resp.ok) throw new Error(`注册失败 (${resp.status}): ${await resp.text()}`);
  const body = await resp.json();
  return { email, password, name, token: body.data.access_token, id: body.data.user.id };
}

async function createProject(token, name) {
  const resp = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ name, mode: 'standard' }),
  });
  if (!resp.ok) throw new Error(`创建项目失败 (${resp.status}): ${await resp.text()}`);
  const body = await resp.json();
  return body.data;
}

async function saveProjectChat(token, projectId, messages) {
  const resp = await fetch(`${API_BASE}/projects/${projectId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ messages }),
  });
  if (!resp.ok) throw new Error(`保存聊天失败 (${resp.status}): ${await resp.text()}`);
}

async function loginViaUI(page, email, password) {
  await page.goto(`${FE_BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
}

async function openProjectInCreate(page, projectName) {
  await page.goto(`${FE_BASE}/create`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  const projectItem = page.locator('div.cursor-pointer').filter({ hasText: `📍 ${projectName}` }).first();
  await projectItem.waitFor({ state: 'visible', timeout: 15000 });
  await projectItem.click();
  await page.waitForTimeout(4000);
}

async function countQuestionCards(page) {
  // QuestionCard has class "my-3 rounded-xl border" and contains "提问" or "已暂存"
  const cards = page.locator('div.my-3.rounded-xl.border:has(span:text("提问")), div.my-3.rounded-xl.border:has(span:text("已暂存"))');
  return await cards.count();
}

async function getBatchToolbar(page) {
  const toolbar = page.locator('div.my-3.rounded-xl.border:has(span:text("批量提交"))');
  const exists = await toolbar.count() > 0;
  if (!exists) return null;
  const buttonText = await toolbar.locator('button').last().textContent();
  const isDisabled = await toolbar.locator('button').last().isDisabled();
  return { exists: true, buttonText, isDisabled };
}

async function sendMessage(page, text) {
  const textarea = page.locator('textarea').first();
  await textarea.waitFor({ state: 'visible', timeout: 10000 });
  await textarea.fill(text);
  await page.waitForTimeout(200);
  // Click the send button (ChevronUp icon in a button with bg-gray-900)
  const sendBtn = page.locator('button.bg-gray-900').first();
  await sendBtn.click();
}

async function waitForResponse(page, timeoutMs = 120000) {
  // Wait for loading to finish (the textarea placeholder changes from "AI 正在思考..." to normal)
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const isLoading = await page.evaluate(() => {
      const ta = document.querySelector('textarea');
      return ta && ta.getAttribute('placeholder') === 'AI 正在思考...';
    });
    if (!isLoading && Date.now() - startTime > 3000) {
      // Give a bit more time for question cards to render after loading finishes
      await page.waitForTimeout(2000);
      return true;
    }
    await page.waitForTimeout(1000);
  }
  return false;
}

async function takeScreenshot(page, name) {
  const path = join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  return path;
}

async function getQuestionCardDetails(page) {
  const cards = page.locator('div.my-3.rounded-xl.border:has(span:text("提问")), div.my-3.rounded-xl.border:has(span:text("已暂存"))');
  const count = await cards.count();
  const details = [];
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    const headerText = await card.locator('span.text-xs.font-semibold').first().textContent();
    const titleText = await card.locator('p.text-sm.text-gray-800').first().textContent();
    const options = await card.locator('button:has(div.text-xs.font-medium)').allTextContents();
    const buttonText = await card.locator('button:has-text("确定"), button:has-text("暂存"), button:has-text("已暂存"), button:has-text("下一步")').last().textContent();
    details.push({ header: headerText?.trim(), title: titleText?.trim(), options, buttonText: buttonText?.trim() });
  }
  return details;
}

// ========== Main test runner ==========

async function main() {
  const startedAt = utcNow();
  console.log(`[E2E] Started at ${startedAt}`);
  console.log('[E2E] Launching browser...');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'zh-CN',
  });

  const page = await context.newPage();

  // Intercept WebSocket messages
  page.on('websocket', ws => {
    ws.on('framereceived', frame => {
      try {
        const data = JSON.parse(frame.payload);
        if (data.event === 'question' || data.event === 'final' || data.event === 'error') {
          wsMessages.push({ event: data.event, data: data.data, timestamp: utcNow() });
        }
      } catch {}
    });
  });

  // Capture console logs
  const consoleLogs = [];
  page.on('console', msg => {
    if (msg.type() === 'log' || msg.type() === 'warn' || msg.type() === 'error') {
      consoleLogs.push({ type: msg.type(), text: msg.text(), timestamp: utcNow() });
    }
  });

  try {
    // ===== Setup: Register + Login =====
    console.log('[E2E] Registering user...');
    const user = await registerUser();
    console.log(`[E2E] User registered: ${user.email}`);

    console.log('[E2E] Logging in via UI...');
    await loginViaUI(page, user.email, user.password);
    console.log('[E2E] Login done');

    // ===== TC-MQ-001: Multi-card rendering via real AI =====
    console.log('[E2E] TC-MQ-001: Creating project and sending multi-dimension prompt...');
    const project = await createProject(user.token, `R2多卡测试_${Date.now()}`);
    console.log(`[E2E] Project created: ${project.id}`);

    await openProjectInCreate(page, project.name);
    await takeScreenshot(page, 'tc-mq-001-before-send');

    const t1Start = Date.now();
    // Send a broad prompt likely to trigger multi-dimension questions
    await sendMessage(page, '帮我设计一个互动故事网页，我是零基础新手，想做一个适合小学生玩的故事冒险游戏，大概有6小时时间');

    // Wait for response
    const responded = await waitForResponse(page, 120000);
    const t1Duration = Date.now() - t1Start;

    await takeScreenshot(page, 'tc-mq-001-after-response');

    const cardCount = await countQuestionCards(page);
    const cardDetails = await getQuestionCardDetails(page);
    const toolbar = await getBatchToolbar(page);

    console.log(`[E2E] QuestionCards found: ${cardCount}`);
    console.log(`[E2E] Card details: ${JSON.stringify(cardDetails, null, 2)}`);
    console.log(`[E2E] Toolbar: ${JSON.stringify(toolbar)}`);
    console.log(`[E2E] WS question events: ${wsMessages.filter(m => m.event === 'question').length}`);

    const questionEvents = wsMessages.filter(m => m.event === 'question');

    if (cardCount >= 2) {
      // Multi-card scenario confirmed!
      record('TC-MQ-001', '/create 多维度提问 → 渲染 ≥2 张 QuestionCard + 批量提交工具条', 'A',
        'passed',
        'messagesEnd 上方渲染 ≥2 张 QuestionCard + 1 个批量提交工具条',
        `渲染了 ${cardCount} 张 QuestionCard；工具条: ${toolbar ? '存在' : '不存在'}；WS question 事件: ${questionEvents.length} 个`,
        [
          { type: 'screenshot', snippet: `tc-mq-001-after-response.png (${cardCount} cards)`, path: join(SCREENSHOT_DIR, 'tc-mq-001-after-response.png') },
          { type: 'payload', snippet: `Card titles: ${cardDetails.map(c => c.title).join(' | ')}` },
          { type: 'console', snippet: `WS question events: ${questionEvents.length}; IDs: ${questionEvents.map(q => q.data?.id).join(', ')}` },
        ],
        t1Duration, '', '', [], '多卡渲染正常，关注 showPendingQuestion 在 pendingQuestions 列表中的追加逻辑'
      );

      // ===== TC-MQ-002: Store one card → answered grey state =====
      console.log('[E2E] TC-MQ-002: Storing one card...');
      const t2Start = Date.now();
      const firstCard = page.locator('div.my-3.rounded-xl.border:has(span:text("提问"))').first();
      const firstOption = firstCard.locator('button:has(div.text-xs.font-medium)').first();
      await firstOption.click();
      await page.waitForTimeout(500);

      // Click "暂存" button
      const storeBtn = firstCard.locator('button:has-text("暂存")').first();
      if (await storeBtn.count() > 0) {
        await storeBtn.click();
        await page.waitForTimeout(1000);
      }

      await takeScreenshot(page, 'tc-mq-002-after-store');
      const t2Duration = Date.now() - t2Start;

      // Check if the card turned grey
      const answeredCards = page.locator('div.my-3.rounded-xl.border:has(span:text("已暂存"))');
      const answeredCount = await answeredCards.count();
      const toolbarAfterStore = await getBatchToolbar(page);
      const remainingCards = await countQuestionCards(page);

      console.log(`[E2E] Answered cards: ${answeredCount}, Total cards: ${remainingCards}, Toolbar disabled: ${toolbarAfterStore?.isDisabled}`);

      if (answeredCount >= 1 && toolbarAfterStore && toolbarAfterStore.isDisabled) {
        record('TC-MQ-002', '暂存其中 1 张卡 → answered 灰态 + 提交按钮 disabled', 'A',
          'passed',
          '该卡变 answered 灰态、文案变"已暂存"；工具条提交按钮仍 disabled；其他卡仍可交互',
          `已暂存卡数: ${answeredCount}; 工具条按钮 disabled: ${toolbarAfterStore.isDisabled}; 总卡数: ${remainingCards}`,
          [{ type: 'screenshot', snippet: 'tc-mq-002-after-store.png', path: join(SCREENSHOT_DIR, 'tc-mq-002-after-store.png') }],
          t2Duration, '', '', [], '关注 QuestionCard answered prop 传入逻辑'
        );
      } else {
        record('TC-MQ-002', '暂存其中 1 张卡 → answered 灰态 + 提交按钮 disabled', 'A',
          'failed',
          '该卡变 answered 灰态、文案变"已暂存"；工具条提交按钮仍 disabled；其他卡仍可交互',
          `已暂存卡数: ${answeredCount}; 工具条按钮 disabled: ${toolbarAfterStore?.isDisabled}; 总卡数: ${remainingCards}`,
          [{ type: 'screenshot', snippet: 'tc-mq-002-after-store.png', path: join(SCREENSHOT_DIR, 'tc-mq-002-after-store.png') }],
          t2Duration, 'functional-bug', 'P2', ['1. 触发多卡场景', '2. 点击第一张卡的选项', '3. 点击暂存按钮', '4. 观察卡状态和工具条按钮'],
          '关注 handleQuestionAnswer 中 pendingAnswers 更新逻辑和 answered 计算逻辑'
        );
      }

      // ===== TC-MQ-003: Batch submit =====
      console.log('[E2E] TC-MQ-003: Storing remaining cards and batch submit...');
      const t3Start = Date.now();

      // Store all remaining cards
      const remainingActiveCards = page.locator('div.my-3.rounded-xl.border:has(span:text("提问"))');
      const remainingCount = await remainingActiveCards.count();
      for (let i = 0; i < remainingCount; i++) {
        const card = remainingActiveCards.nth(i);
        const option = card.locator('button:has(div.text-xs.font-medium)').first();
        if (await option.count() > 0) {
          await option.click();
          await page.waitForTimeout(300);
          const btn = card.locator('button:has-text("暂存")').first();
          if (await btn.count() > 0) {
            await btn.click();
            await page.waitForTimeout(500);
          }
        }
      }

      await page.waitForTimeout(1000);
      await takeScreenshot(page, 'tc-mq-003-all-stored');

      // Check toolbar is now enabled
      const toolbarEnabled = await getBatchToolbar(page);
      console.log(`[E2E] Toolbar after all stored: ${JSON.stringify(toolbarEnabled)}`);

      // Click "提交全部回答"
      if (toolbarEnabled && !toolbarEnabled.isDisabled) {
        const submitBtn = page.locator('button:has-text("提交全部回答")').first();
        await submitBtn.click();
        await page.waitForTimeout(3000);
        await takeScreenshot(page, 'tc-mq-003-after-submit');

        // Check if cards disappeared
        const cardsAfterSubmit = await countQuestionCards(page);
        const t3Duration = Date.now() - t3Start;

        // Check if a [批量回答] message was sent (look in chat messages)
        const chatContainsBatch = await page.evaluate(() => {
          const body = document.body.innerText;
          return body.includes('[批量回答]');
        });

        console.log(`[E2E] Cards after submit: ${cardsAfterSubmit}, Chat has [批量回答]: ${chatContainsBatch}`);

        if (cardsAfterSubmit === 0 && chatContainsBatch) {
          record('TC-MQ-003', '暂存全部卡后点提交全部回答 → 单条 [批量回答] 消息', 'A',
            'passed',
            'network 单条消息文本以 [批量回答]\\n1.…\\n2.… 开头；所有卡消失',
            `卡片数: ${cardsAfterSubmit}; 聊天含 [批量回答]: ${chatContainsBatch}`,
            [{ type: 'screenshot', snippet: 'tc-mq-003-after-submit.png', path: join(SCREENSHOT_DIR, 'tc-mq-003-after-submit.png') }],
            t3Duration, '', '', [], '关注 handleBatchSubmit 中 [批量回答] 拼接逻辑'
          );
        } else {
          record('TC-MQ-003', '暂存全部卡后点提交全部回答 → 单条 [批量回答] 消息', 'A',
            'failed',
            'network 单条消息文本以 [批量回答]\\n1.…\\n2.… 开头；所有卡消失',
            `卡片数: ${cardsAfterSubmit}; 聊天含 [批量回答]: ${chatContainsBatch}`,
            [{ type: 'screenshot', snippet: 'tc-mq-003-after-submit.png', path: join(SCREENSHOT_DIR, 'tc-mq-003-after-submit.png') }],
            t3Duration, 'functional-bug', 'P1', ['1. 多卡场景', '2. 暂存所有卡', '3. 点击提交全部回答', '4. 检查卡片消失和消息内容'],
            '关注 handleBatchSubmit 的 aggregated 拼接和 clearQuestionFlow 调用'
          );
        }
      } else {
        const t3Duration = Date.now() - t3Start;
        record('TC-MQ-003', '暂存全部卡后点提交全部回答 → 单条 [批量回答] 消息', 'A',
          'failed',
          '工具条按钮应变为 enabled',
          `工具条按钮 disabled: ${toolbarEnabled?.isDisabled}`,
          [{ type: 'screenshot', snippet: 'tc-mq-003-all-stored.png', path: join(SCREENSHOT_DIR, 'tc-mq-003-all-stored.png') }],
          t3Duration, 'functional-bug', 'P1', ['1. 多卡场景', '2. 暂存所有卡', '3. 检查工具条按钮状态'],
          '关注 allAnswered 计算逻辑: pendingQuestions.every(q => pendingAnswers[q.id] !== undefined)'
        );
      }

      // ===== TC-MQ-007: Close single card (new session) =====
      // This needs a fresh multi-card scenario, skip if we already submitted
      record('TC-MQ-007', '多卡场景关闭/取消单张卡 → 仅该卡消失', 'C',
        'skipped',
        '仅该卡消失，其他卡保持',
        'TC-MQ-003 已消耗多卡场景（批量提交后卡已消失），TC-MQ-007 需独立多卡场景才能测试',
        [],
        0, 'spec-ambiguity', 'P2', [], '需要独立的多卡场景才能测试关闭单卡功能'
      );

    } else if (cardCount === 1) {
      // Single card scenario
      console.log('[E2E] Single card scenario detected');

      record('TC-MQ-001', '/create 多维度提问 → 渲染 ≥2 张 QuestionCard + 批量提交工具条', 'A',
        'failed',
        'messagesEnd 上方渲染 ≥2 张 QuestionCard + 1 个批量提交工具条',
        `仅渲染了 ${cardCount} 张 QuestionCard；无批量提交工具条。AI 未在单轮中派发多维度问题`,
        [
          { type: 'screenshot', snippet: 'tc-mq-001-after-response.png (1 card only)', path: join(SCREENSHOT_DIR, 'tc-mq-001-after-response.png') },
          { type: 'payload', snippet: `Card title: ${cardDetails[0]?.title}; WS question events: ${questionEvents.length}` },
        ],
        t1Duration, 'spec-ambiguity', 'P2', ['1. 发送宽泛 prompt', '2. 等待 AI 响应', '3. 检查 QuestionCard 数量'],
        'AI 未在单轮中派发多个 question 事件。需关注 orchestrator.py 中 _extract_plaintext_question_blocks 是否被触发，或 ask_user_question 工具是否被多次调用'
      );

      // ===== TC-MQ-004: Single card → direct send =====
      console.log('[E2E] TC-MQ-004: Testing single card direct send...');
      const t4Start = Date.now();
      const singleCard = page.locator('div.my-3.rounded-xl.border:has(span:text("提问"))').first();
      const singleBtnText = await singleCard.locator('button').last().textContent();
      console.log(`[E2E] Single card button text: ${singleBtnText}`);

      // Click an option and submit
      const option = singleCard.locator('button:has(div.text-xs.font-medium)').first();
      if (await option.count() > 0) {
        await option.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, 'tc-mq-004-before-submit');

        const submitBtn = singleCard.locator('button:has-text("确定"), button:has-text("下一步")').first();
        if (await submitBtn.count() > 0) {
          await submitBtn.click();
          await page.waitForTimeout(3000);
          await takeScreenshot(page, 'tc-mq-004-after-submit');

          const cardsAfter = await countQuestionCards(page);
          const t4Duration = Date.now() - t4Start;

          if (cardsAfter === 0) {
            record('TC-MQ-004', '单卡场景 → 走原直接发送路径，按钮文案『确定』', 'A',
              'passed',
              '单卡路径，按钮文案"确定"，点击直接发送；无批量工具条',
              `按钮文案: ${singleBtnText?.trim()}; 提交后卡片消失: ${cardsAfter === 0}; 无批量工具条: ${!toolbar}`,
              [
                { type: 'screenshot', snippet: 'tc-mq-004-before-submit.png', path: join(SCREENSHOT_DIR, 'tc-mq-004-before-submit.png') },
                { type: 'screenshot', snippet: 'tc-mq-004-after-submit.png', path: join(SCREENSHOT_DIR, 'tc-mq-004-after-submit.png') },
              ],
              t4Duration, '', '', [], '单卡直发路径正常'
            );
          } else {
            record('TC-MQ-004', '单卡场景 → 走原直接发送路径，按钮文案『确定』', 'A',
              'failed',
              '点击直接发送，卡片消失',
              `提交后仍有 ${cardsAfter} 张卡`,
              [{ type: 'screenshot', snippet: 'tc-mq-004-after-submit.png', path: join(SCREENSHOT_DIR, 'tc-mq-004-after-submit.png') }],
              t4Duration, 'functional-bug', 'P1', ['1. 单卡场景', '2. 点击选项', '3. 点击确定', '4. 检查卡片是否消失'],
              '关注 handleQuestionAnswer 中 list.length <= 1 分支的 clearQuestionFlow 调用'
            );
          }
        }
      }

      // Skip multi-card tests
      record('TC-MQ-002', '暂存其中 1 张卡 → answered 灰态 + 提交按钮 disabled', 'A',
        'skipped', '需要多卡场景', '当前为单卡场景', [], 0, 'spec-ambiguity', 'P2', [], '需要多卡场景才能测试');
      record('TC-MQ-003', '暂存全部卡后点提交全部回答 → 单条 [批量回答] 消息', 'A',
        'skipped', '需要多卡场景', '当前为单卡场景', [], 0, 'spec-ambiguity', 'P1', [], '需要多卡场景才能测试');
      record('TC-MQ-007', '多卡场景关闭/取消单张卡 → 仅该卡消失', 'C',
        'skipped', '需要多卡场景', '当前为单卡场景', [], 0, 'spec-ambiguity', 'P2', [], '需要多卡场景才能测试');

    } else {
      // No question cards at all
      console.log('[E2E] No question cards found');

      record('TC-MQ-001', '/create 多维度提问 → 渲染 ≥2 张 QuestionCard + 批量提交工具条', 'A',
        'failed',
        'messagesEnd 上方渲染 ≥2 张 QuestionCard + 1 个批量提交工具条',
        `未渲染任何 QuestionCard。AI 响应可能未包含 question 事件。WS question 事件数: ${questionEvents.length}`,
        [
          { type: 'screenshot', snippet: 'tc-mq-001-after-response.png (no cards)', path: join(SCREENSHOT_DIR, 'tc-mq-001-after-response.png') },
          { type: 'console', snippet: `WS events: ${JSON.stringify(wsMessages.map(m => m.event))}` },
        ],
        t1Duration, 'spec-ambiguity', 'P2', ['1. 发送 prompt', '2. 等待 AI 响应', '3. 检查 QuestionCard'],
        'AI 未派发 question 事件。可能需要调整 prompt 或检查 orchestrator 流式兜底逻辑'
      );

      record('TC-MQ-002', '暂存其中 1 张卡 → answered 灰态 + 提交按钮 disabled', 'A',
        'skipped', '需要多卡场景', '无卡场景', [], 0, 'spec-ambiguity', 'P2', [], '需要多卡场景才能测试');
      record('TC-MQ-003', '暂存全部卡后点提交全部回答 → 单条 [批量回答] 消息', 'A',
        'skipped', '需要多卡场景', '无卡场景', [], 0, 'spec-ambiguity', 'P1', [], '需要多卡场景才能测试');
      record('TC-MQ-004', '单卡场景 → 走原直接发送路径，按钮文案『确定』', 'A',
        'skipped', '需要单卡场景', '无卡场景', [], 0, 'spec-ambiguity', 'P1', [], '需要单卡场景才能测试');
      record('TC-MQ-007', '多卡场景关闭/取消单张卡 → 仅该卡消失', 'C',
        'skipped', '需要多卡场景', '无卡场景', [], 0, 'spec-ambiguity', 'P2', [], '需要多卡场景才能测试');
    }

    // ===== TC-MQ-005: Refresh page restore =====
    console.log('[E2E] TC-MQ-005: Testing page refresh restore...');
    const t5Start = Date.now();

    // Refresh the page
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    await takeScreenshot(page, 'tc-mq-005-after-refresh');
    const restoredCards = await countQuestionCards(page);
    const t5Duration = Date.now() - t5Start;

    console.log(`[E2E] Restored cards after refresh: ${restoredCards}`);

    if (restoredCards >= 1) {
      record('TC-MQ-005', '刷新页面 / 切换历史 → pendingQuestions 至少恢复 1 张', 'B',
        'passed',
        'pendingQuestions 至少恢复 1 张（理想全部恢复）',
        `恢复 ${restoredCards} 张卡`,
        [{ type: 'screenshot', snippet: 'tc-mq-005-after-refresh.png', path: join(SCREENSHOT_DIR, 'tc-mq-005-after-refresh.png') }],
        t5Duration, '', '', [], '恢复逻辑正常，关注 parseQuestionFromText 是否能恢复多卡'
      );
    } else {
      record('TC-MQ-005', '刷新页面 / 切换历史 → pendingQuestions 至少恢复 1 张', 'B',
        'failed',
        'pendingQuestions 至少恢复 1 张',
        '刷新后未恢复任何卡',
        [{ type: 'screenshot', snippet: 'tc-mq-005-after-refresh.png', path: join(SCREENSHOT_DIR, 'tc-mq-005-after-refresh.png') }],
        t5Duration, 'functional-bug', 'P1', ['1. 有 question 卡片时', '2. 刷新页面', '3. 检查卡片恢复'],
        '关注 Create.tsx 中 restore 逻辑: parseQuestionFromText 对最后一条 assistant 消息的解析'
      );
    }

    // ===== TC-MQ-006: Step same-source switch =====
    // This is hard to test without controlling AI step progression
    record('TC-MQ-006', 'step 同源切换（step=1→step=2）→ 不入多卡 list，覆盖渲染同卡', 'B',
      'skipped',
      '覆盖渲染，不出现多卡',
      'step 同源切换需要 AI 连续派发带 step 属性的 question 事件，无法在单轮 E2E 中可靠触发',
      [],
      0, 'spec-ambiguity', 'P1', [], '需要 AI 配合连续派发 step=1→step=2 的 question 事件，建议手动测试或 mock WS'
    );

    // ===== S-02: WS multi-question event observation =====
    const questionEventCount = questionEvents.length;
    const questionIds = questionEvents.map(q => q.data?.id).filter(Boolean);
    const uniqueIds = new Set(questionIds);

    if (questionEventCount > 1) {
      record('S-02', 'WS 多 question 事件 id 互不相同（含 block_idx 后缀）', 'C',
        uniqueIds.size === questionIds.length ? 'passed' : 'failed',
        '当 AI 一轮 emit 多个 question 事件时，事件 id 互不相同',
        `WS question 事件数: ${questionEventCount}; 唯一 id 数: ${uniqueIds.size}; IDs: ${questionIds.join(', ')}`,
        [{ type: 'payload', snippet: `Question events: ${JSON.stringify(questionEvents.map(q => ({ id: q.data?.id, title: q.data?.title })))}` }],
        0, '', '', [], '关注 orchestrator.py 中 id 加 block_idx 后缀防覆盖逻辑'
      );
    } else {
      record('S-02', 'WS 多 question 事件 id 互不相同（含 block_idx 后缀）', 'C',
        'skipped',
        '当 AI 一轮 emit 多个 question 事件时，事件 id 互不相同',
        `本轮 WS question 事件数: ${questionEventCount}（不足 2 个，无法验证 id 唯一性）`,
        [],
        0, 'spec-ambiguity', 'P2', [], '需要 AI 单轮派发多个 question 事件才能验证'
      );
    }

  } catch (error) {
    console.error('[E2E] Error:', error);
    await takeScreenshot(page, 'error-state');
    record('E2E-RUNNER', 'E2E 测试运行器', 'A',
      'failed', '测试正常运行完成', `运行器异常: ${error.message}`,
      [{ type: 'screenshot', snippet: 'error-state.png', path: join(SCREENSHOT_DIR, 'error-state.png') }],
      0, 'env-issue', 'P0', [], `运行器异常: ${error.stack}`
    );
  } finally {
    await browser.close();
  }

  const finishedAt = utcNow();
  console.log(`[E2E] Finished at ${finishedAt}`);

  // Write results JSON
  const summary = {
    started_at: startedAt,
    finished_at: finishedAt,
    ws_messages: wsMessages,
    console_logs_count: consoleLogs.length,
    results: results,
  };

  const resultsPath = join(__dirname, 'e2e_results.json');
  writeFileSync(resultsPath, JSON.stringify(summary, null, 2), 'utf-8');
  console.log(`[E2E] Results written to ${resultsPath}`);

  // Print summary
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  console.log(`[E2E] Summary: ${passed} passed, ${failed} failed, ${skipped} skipped (total: ${results.length})`);

  return failed > 0 ? 1 : 0;
}

main().then(code => {
  process.exit(code);
}).catch(err => {
  console.error('[E2E] Fatal:', err);
  process.exit(1);
});
