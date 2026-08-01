/**
 * 讲解文档沉淀功能 E2E 有头测试（task-8b5 / RT-39 / TC-16）
 *
 * 覆盖四入口：创建页气泡「保存为讲解」、创建页工具栏「AI 讲解」、
 * 项目详情页「讲解回顾」、Demo 详情页「讲解」页签。
 *
 * 运行：cd apps/frontend/tests && node manual-test-explanation.js
 *   （有头模式，系统 Chrome；后端 3200 + 前端 5184 + ZeroClaw daemon 42617 需先起）
 *
 * 设计：
 *  1. MOCK_USER 登录
 *  2. 复用/推进一个已有代码的项目（优先用最近项目，避免每次新建）
 *  3. 让 AI 做一次成体系长讲解（>200 字，诱导出保存按钮）
 *  4. TC-16 步骤 1~4：气泡保存为讲解 + 判重 + 工具栏 AI 讲解
 *  5. TC-16 步骤 5~8：项目详情讲解回顾 Card + 弹窗 + AI 讲解代码
 *  6. TC-16 步骤 10~11：Demo 详情讲解页签 + ?tab=explanation 直达
 *
 * 说明：步骤 9（AI 自动调 artifact_writer）依赖模型行为，作观察项（不计失败）。
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

// 观察项：记录但不计入失败
function observe(name, detail) {
  console.log(`   👁️ [观察] ${name}${detail ? ' — ' + detail : ''}`);
}

let artifactWriterCalled = false;

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
  console.log(`[发送] ${text.slice(0, 70)}${text.length > 70 ? '…' : ''}`);
  const input = await waitForInputEnabled(page);
  await input.fill(text);
  await page.getByTestId('send-button').click();
}

/** 等 AI 一轮回复结束：输入框重新可用且稳定 2 秒 */
async function waitForAIResponse(page, timeout = 300000) {
  const start = Date.now();
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

/** 获取最近一个项目的 ID（从侧边栏第一个 project-name 取 data-project-id） */
async function getRecentProjectId(page) {
  return await page.evaluate(() => {
    const pid = sessionStorage.getItem('finestem_active_project_id');
    return pid;
  });
}

(async () => {
  console.log('====================================================');
  console.log(' 讲解文档沉淀功能 E2E 有头测试 (TC-16 / RT-39)');
  console.log('====================================================');

  const fs = require('fs');
  const chromePath = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].find((p) => fs.existsSync(p));
  const browser = await chromium.launch({
    headless: false,
    // 找不到系统 Chrome 时回退到 playwright 自带 chromium（不传 executablePath）
    ...(chromePath ? { executablePath: chromePath } : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
  });
  const page = await context.newPage();

  // 监听工具调用日志（观察 AI 是否自动调 artifact_writer）
  page.on('console', (msg) => {
    const text = msg.text() || '';
    if (text.includes('[tool_call] artifact_writer') || text.includes('[tool_result] artifact_writer')) {
      artifactWriterCalled = true;
      observe('AI 自动调 artifact_writer', text.slice(0, 120));
    }
  });

  try {
    // ── 1. 登录 ──
    console.log('\n1. MOCK_USER 登录...');
    await page.goto(`${FRONTEND_BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', MOCK_USER_EMAIL);
    await page.fill('input[type="password"]', MOCK_USER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(explore|dashboard|research|create)/, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const loggedIn = !page.url().includes('/login');
    record('登录 MOCK_USER', loggedIn, page.url());
    await shot(page, 'expl-00-login');
    if (!loggedIn) throw new Error('登录失败，终止');

    // ── 2. 准备有代码的项目（优先复用已有 stage_05+ 项目，避免每次重新推进 PBL）──
    console.log('\n2. 准备有代码的项目...');
    // 先通过 API 找一个已有代码（stage_05+）的项目，直接注入 sessionStorage 复用
    const existingProjectId = await page.evaluate(async () => {
      const token = localStorage.getItem('auth_token');
      try {
        const res = await fetch('/api/v1/projects?limit=10', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        const items = (data.data && data.data.items) || data.data || [];
        // 优先 stage_07_execute（有完整代码），其次 stage_05/08
        const CODE_STAGES = ['stage_07_execute', 'stage_08_evaluate', 'stage_05_design'];
        for (const st of CODE_STAGES) {
          const found = items.find((p) => p.current_stage === st);
          if (found) return found.id;
        }
        return null;
      } catch (e) {
        return null;
      }
    });

    let activeProjectId = null;
    if (existingProjectId) {
      console.log(`   复用已有代码项目: ${existingProjectId}`);
      // 写入 sessionStorage 让 /create 恢复该项目（复用 finestem_restore_project 链路）
      await page.evaluate((pid) => {
        sessionStorage.setItem('finestem_active_project_id', pid);
      }, existingProjectId);
      await page.goto(`${FRONTEND_BASE}/create`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000); // 等工作区恢复
      activeProjectId = await getRecentProjectId(page);
    } else {
      console.log('   无可用代码项目，新建并推进到编码阶段（较慢）...');
      await page.goto(`${FRONTEND_BASE}/create`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2500);
      await sendMessage(
        page,
        '我想做一个待办事项管理应用。请尽快带我进入编码实现阶段，' +
          '最终要一个完整的 HTML 单页（含 CSS 和 JavaScript），功能完整并写入项目文件。',
      );
      await waitForAIResponse(page).catch((e) => console.log('   ⚠️ ' + e.message));
      for (let n = 0; n < 4 && !activeProjectId; n++) {
        await sendMessage(page, '请直接进入编码实现阶段，把完整的 HTML 单页代码写入项目文件。');
        await waitForAIResponse(page).catch((e) => console.log('   ⚠️ ' + e.message));
        activeProjectId = await getRecentProjectId(page);
      }
    }
    record('存在活跃项目(有代码)', !!activeProjectId, activeProjectId || '仍未拿到');
    await shot(page, 'expl-01-project-ready');


    // ── 3. 让 AI 做一次成体系长讲解（诱导出 >200 字回复 + 保存按钮） ──
    // 注意：AI 在早期阶段可能回"项目状态说明"而非真正代码讲解，
    // 需要循环诱导直到产出 >200 字的成体系讲解（保存按钮的渲染条件）。
    console.log('\n3. 诱导 AI 成体系长讲解（最多重试3次）...');
    const EXPLAIN_PROMPTS = [
      '请像老师讲课一样，详细讲解我项目代码的核心原理、设计思路和关键代码实现。要分章节、成体系地讲（至少讲清楚原理、思路、代码三部分），讲得详细一点，这样我能存进讲解文档日后复习。',
      '我想把这段代码的讲解存下来复习。请你现在就开始详细讲解：先讲这段代码解决什么问题、用了什么原理，再讲设计思路和关键函数的实现细节，要有实质内容，不要只说后续步骤。请展开讲。',
      '请直接开始讲解代码。要求：1）这段代码的核心算法/原理是什么；2）整体结构怎么设计的、各模块怎么配合；3）挑 2-3 个关键函数逐行讲清楚。请现在就讲，要详细、有结构。',
    ];
    let induceOk = false;
    let lastAssistantLen = 0;
    for (let i = 0; i < EXPLAIN_PROMPTS.length; i++) {
      await sendMessage(page, EXPLAIN_PROMPTS[i]);
      await waitForAIResponse(page).catch((e) => console.log('   ⚠️ ' + e.message));
      // 检查最后一条 AI 消息长度
      const lastMsg = page.locator('[data-testid="message-assistant"]').last();
      const lastText = (await lastMsg.textContent().catch(() => '')) || '';
      lastAssistantLen = lastText.length;
      console.log(`   第${i + 1}次诱导: 最后AI回复 ${lastAssistantLen} 字`);
      // 出现保存按钮或回复够长就算成功
      const hasBtn = (await page.locator('[data-testid="save-explanation"]').count()) > 0;
      if (hasBtn || lastAssistantLen > 250) {
        induceOk = true;
        break;
      }
    }
    await shot(page, 'expl-02-explanation-response');
    observe('诱导讲解最终回复长度', `${lastAssistantLen} 字${induceOk ? '（达标）' : '（未达200字阈值）'}`);

    // ── TC-16 步骤 1：AI 长消息尾部出现「保存为讲解」按钮 ──
    console.log('\n--- TC-16 步骤 1：保存为讲解按钮出现 ---');
    const saveBtn = page.locator('[data-testid="save-explanation"]').last();
    const hasSaveBtn = (await saveBtn.count()) > 0;
    record('TC16-1 AI 长消息尾部出现「保存为讲解」按钮', hasSaveBtn, hasSaveBtn ? '' : `诱导后仍<200字（最后${lastAssistantLen}字），属测试方法局限非功能bug`);

    // 若没出现，再发一条更明确的讲解请求
    let savedOk = false;
    if (hasSaveBtn) {
      // ── TC-16 步骤 2：点保存，变「已保存 ✓」 + 文件树出现讲解文档 ──
      console.log('\n--- TC-16 步骤 2：点击保存 ---');
      await saveBtn.click();
      await page.waitForTimeout(2500);
      const btnText = (await saveBtn.textContent().catch(() => '')) || '';
      const saved = btnText.includes('已保存') || btnText.includes('✓');
      record('TC16-2a 点击后变「已保存 ✓」', saved, `实际文案: "${btnText.trim()}"`);
      await shot(page, 'expl-03-saved');

      // 文件树出现 BookOpen 讲解文档（ProjectFilesPanel 刷新后）
      // 讲解文档项没有独立 testid，按文件名/图标文案定位
      const docTree = page.locator('text=讲解文档');
      const docInTree = (await docTree.count()) > 0;
      record('TC16-2b 文件树出现「讲解文档」项', docInTree, docInTree ? '' : '文件树未刷新（检查 refreshSignal）');
      await shot(page, 'expl-04-doctree');

      // ── TC-16 步骤 3：重复点同按钮 → 「已在讲解文档中」（判重） ──
      console.log('\n--- TC-16 步骤 3：重复保存判重 ---');
      // 按钮已 disabled（!!explanationState），但仍可读文案
      const dupText = (await saveBtn.textContent().catch(() => '')) || '';
      const isDup = dupText.includes('已在讲解文档中') || dupText.includes('已保存');
      record('TC16-3 重复保存为 duplicate/已保存态', isDup, `文案: "${dupText.trim()}"`);
      savedOk = saved;
    } else {
      observe('步骤1 保存按钮未出现', '回复可能不足200字，跳过 2/3，详情页步骤仍可验证既有讲解');
    }

    // ── TC-16 步骤 4：工具栏「AI 讲解」按钮 ──
    console.log('\n--- TC-16 步骤 4：工具栏 AI 讲解按钮 ---');
    const explainBtn = page.locator('[data-testid="explain-code"]');
    const hasExplainBtn = (await explainBtn.count()) > 0;
    record('TC16-4a 工具栏存在「AI 讲解」按钮', hasExplainBtn, hasExplainBtn ? '' : 'explain-code testid 未找到');
    if (hasExplainBtn) {
      await explainBtn.first().click();
      await page.waitForTimeout(2000);
      // 聊天区应发出一条讲解请求消息（输入框转 loading）
      const isLoading = !(await page.locator('[data-testid="chat-input"]').isEnabled().catch(() => false));
      record('TC16-4b 点击后发出讲解请求（loading）', isLoading, isLoading ? '' : '未触发发送');
      await waitForAIResponse(page).catch((e) => console.log('   ⚠️ ' + e.message));
      await shot(page, 'expl-05-toolbar-explain');
    }

    // ── TC-16 步骤 5~8：项目详情页讲解回顾 ──
    console.log('\n--- TC-16 步骤 5~8：项目详情页讲解回顾 ---');
    if (activeProjectId) {
      await page.goto(`${FRONTEND_BASE}/research/projects/${activeProjectId}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);
      await shot(page, 'expl-06-project-detail');

      const recapCard = page.locator('[data-testid="explanation-recap-card"]');
      const hasCard = (await recapCard.count()) > 0;
      record('TC16-5a 出现「讲解回顾」Card', hasCard, hasCard ? '' : 'explanation-recap-card 未找到');

      if (hasCard) {
        const hasContent = (await page.locator('[data-testid="explanation-recap-summary"]').count()) > 0;
        const isEmpty = (await page.locator('[data-testid="explanation-recap-empty"]').count()) > 0;
        record('TC16-5b 讲解回顾有内容（非空态）', hasContent && !isEmpty, hasContent ? '已沉淀讲解' : '空态（讲解未落盘）');

        if (hasContent) {
          // 步骤 6：查看讲解文档弹窗
          const viewBtn = page.locator('[data-testid="view-explanation-doc"]');
          await viewBtn.click();
          await page.waitForTimeout(1500);
          const modal = page.locator('[data-testid="explanation-doc-modal"]');
          const modalShown = (await modal.count()) > 0;
          record('TC16-6a 弹出讲解文档弹窗', modalShown);
          if (modalShown) {
            const content = (await page.locator('[data-testid="explanation-doc-modal-content"]').textContent().catch(() => '')) || '';
            const hasSection = content.includes('📖');
            record('TC16-6b 弹窗内容含 ## 📖 时间戳章节', hasSection, `内容长度: ${content.length}`);
            await shot(page, 'expl-07-explanation-modal');
            // 步骤 7：关闭弹窗
            await page.locator('[data-testid="explanation-doc-modal-close"]').click();
            await page.waitForTimeout(800);
            const closed = (await page.locator('[data-testid="explanation-doc-modal"]').count()) === 0;
            record('TC16-7 关闭弹窗', closed);
          }
        }

        // 步骤 8：「AI 讲解代码」按钮存在性
        const projExplainBtn = page.locator('[data-testid="project-explain-code"]');
        const hasProjExplain = (await projExplainBtn.count()) > 0;
        record('TC16-8 存在「AI 讲解代码」按钮', hasProjExplain);
        // 不实际点击跳转（会离开详情页且消耗 AI 流），仅验证存在
      }
    } else {
      record('TC16-5~8 项目详情讲解回顾', false, '无活跃项目 ID，跳过');
    }

    // ── TC-16 步骤 9：观察 AI 是否自动调 artifact_writer（观察项） ──
    console.log('\n--- TC-16 步骤 9：AI 自动沉淀（观察项） ---');
    observe('TC16-9 AI 自动调 artifact_writer', artifactWriterCalled ? '本轮已捕获' : '本轮未捕获（依赖模型行为，不计失败）');

    // ── TC-16 步骤 10~11：Demo 详情讲解页签 ──
    console.log('\n--- TC-16 步骤 10~11：Demo 详情讲解页签 ---');
    await page.goto(`${FRONTEND_BASE}/explore/demos`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await shot(page, 'expl-08-demo-list');

    // 点第一个 Demo 进入详情
    const firstDemoLink = page.locator('a[href*="/explore/demos/"]').first();
    let demoId = null;
    if ((await firstDemoLink.count()) > 0) {
      const href = (await firstDemoLink.getAttribute('href')) || '';
      demoId = href.split('/').pop();
      await firstDemoLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    } else {
      // 备选：直接造一个已知种子 demo 路径
      demoId = 'demo_poetry_card';
      await page.goto(`${FRONTEND_BASE}/explore/demos/${demoId}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
    }
    record('进入 Demo 详情', !!demoId, demoId);

    if (demoId) {
      // 步骤 10：点讲解页签
      const tabBtn = page.locator('[data-testid="demo-tab-explanation"]');
      const hasTab = (await tabBtn.count()) > 0;
      record('TC16-10a Demo 存在「讲解」页签', hasTab);
      if (hasTab) {
        await tabBtn.click();
        await page.waitForTimeout(1000);
        const panel = page.locator('[data-testid="demo-explanation-panel"]');
        const hasPanel = (await panel.count()) > 0;
        record('TC16-10b 点击后显示讲解面板', hasPanel);
        if (hasPanel) {
          const hasContent = (await page.locator('[data-testid="demo-explanation-content"]').count()) > 0;
          const isEmpty = (await page.locator('[data-testid="demo-explanation-empty"]').count()) > 0;
          record('TC16-10c 种子 Demo 讲解内容非空', hasContent && !isEmpty, hasContent ? '' : '空态（种子 explanation_doc 回填失败）');
          await shot(page, 'expl-09-demo-explanation');
        }
      }

      // 步骤 11：?tab=explanation 直达
      await page.goto(`${FRONTEND_BASE}/explore/demos/${demoId}?tab=explanation`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const panelAfterParam = page.locator('[data-testid="demo-explanation-panel"]');
      const directHit = (await panelAfterParam.count()) > 0;
      record('TC16-11 ?tab=explanation 直达讲解页签', directHit);
      await shot(page, 'expl-10-demo-direct-tab');

      // 步骤 12：我的讲解回顾（条件项）
      const myExpl = page.locator('[data-testid="demo-my-explanation"]');
      const hasMyExpl = (await myExpl.count()) > 0;
      if (hasMyExpl) {
        record('TC16-12 出现「我的讲解回顾」', true, '（登录用户有 fork 项目且已沉淀讲解）');
      } else {
        observe('TC16-12 「我的讲解回顾」', '未出现（可能无 fork 项目，条件项跳过，不计失败）');
      }
    }
  } catch (e) {
    console.log('\n❌ 测试中断:', e.message);
    await shot(page, 'expl-ERROR').catch(() => {});
    record('测试执行', false, e.message);
  } finally {
    // ── 汇总 ──
    const passed = results.filter((r) => r.pass).length;
    const failed = results.filter((r) => !r.pass).length;
    console.log('\n====================================================');
    console.log(` 结果汇总: ${passed} 通过 / ${failed} 失败 / 共 ${results.length} 项`);
    console.log('====================================================');
    results.forEach((r) => console.log(`  ${r.pass ? '✅' : '❌'} ${r.name}`));
    console.log('\n（步骤 9 AI 自动沉淀为观察项，不计入失败数）');

    await page.waitForTimeout(3000); // 留几秒看最终态
    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
  }
})();
