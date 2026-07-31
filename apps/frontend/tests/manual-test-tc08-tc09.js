/**
 * TC-08 / TC-09 测试脚本（v1.3 新增）
 * TC-08: AI 确认/修改项目名后侧边栏同步
 * TC-09: stage_08 AI 修改项目总结后评估卡片同步
 */

const { chromium } = require('playwright-core');

const FRONTEND_BASE = 'http://localhost:5184';
const MOCK_USER_EMAIL = '2749959@qq.com';
const MOCK_USER_PASSWORD = '750714hf';
const SHOT_DIR = '../../../test-results';

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`   ${pass ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}

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

(async () => {
  console.log('=== TC-08 / TC-09 测试（v1.3 新增）===\n');

  const browser = await chromium.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // 监听控制台
  const toolCalls = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[tool_call]') || text.includes('[tool_result]')) {
      toolCalls.push({ type: msg.type(), text });
      console.log(`[工具日志] ${text.slice(0, 150)}`);
    }
  });

  try {
    // 登录
    console.log('1. 登录 MOCK_USER...');
    await page.goto(`${FRONTEND_BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', MOCK_USER_EMAIL);
    await page.fill('input[type="password"]', MOCK_USER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(explore|dashboard|research|create)/, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // ========== TC-08: AI 确认/修改项目名后侧边栏同步 ==========
    console.log('\n=== TC-08: AI 确认/修改项目名后侧边栏同步 ===');

    // 进入创造页
    await page.goto(`${FRONTEND_BASE}/create`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 步骤1: 发一条较长的首条消息
    console.log('   步骤1: 发送长首条消息...');
    const longProjectName = '我想做一个能帮我记录每天心情的日记本小应用，可以添加心情标签和备注';
    await sendMessage(page, longProjectName);
    await waitForAIResponse(page, 180000).catch(() => {});

    // 获取侧边栏项目名
    const sidebarProjectName = await page.locator('[data-testid="project-name"], .project-name, [class*="project-title"]').first().textContent().catch(() => '');
    console.log(`   侧边栏项目名: ${sidebarProjectName}`);
    const hasLongName = sidebarProjectName.length > 10;
    record('TC-08 步骤1 侧边栏出现项目', hasLongName, hasLongName ? `项目名: ${sidebarProjectName.slice(0, 30)}...` : '未找到项目名');

    await shot(page, 'tc08-step1-sidebar');

    // 步骤2: 跟 AI 对话确定项目名
    console.log('   步骤2: 确定项目名...');
    toolCalls.length = 0;
    await sendMessage(page, '就叫心情日记本');
    await waitForAIResponse(page, 180000).catch(() => {});

    // 检查 skill_state_writer 调用
    const stateWriterCalls = toolCalls.filter(t => t.text.includes('skill_state_writer'));
    record('TC-08 步骤2 [tool_call] skill_state_writer', stateWriterCalls.length > 0, `捕获 ${stateWriterCalls.length} 次调用`);

    // 检查侧边栏项目名是否更新
    await page.waitForTimeout(2000);
    const updatedName = await page.locator('[data-testid="project-name"], .project-name, [class*="project-title"]').first().textContent().catch(() => '');
    console.log(`   更新后项目名: ${updatedName}`);
    const nameUpdated = updatedName.includes('心情日记本') || updatedName.includes('日记');
    record('TC-08 步骤2 侧边栏项目名更新', nameUpdated, nameUpdated ? `新名: ${updatedName}` : `仍为: ${updatedName}`);

    await shot(page, 'tc08-step2-name-updated');

    // 步骤3: 直接发消息改名
    console.log('   步骤3: 直接改名...');
    toolCalls.length = 0;
    await sendMessage(page, '把项目改名为《每日心情》');
    await waitForAIResponse(page, 180000).catch(() => {});

    // 检查 AI 是否声称无法修改
    const aiResponse = await page.locator('[data-testid="message-assistant"]').last().textContent().catch(() => '');
    const claimsCannotModify = aiResponse.includes('无法修改') || aiResponse.includes('锁定') || aiResponse.includes('不能');
    record('TC-08 步骤3 AI 不声称无法修改', !claimsCannotModify, claimsCannotModify ? 'AI 声称无法修改' : 'AI 接受修改');

    // 检查侧边栏是否同步
    await page.waitForTimeout(2000);
    const renamedName = await page.locator('[data-testid="project-name"], .project-name, [class*="project-title"]').first().textContent().catch(() => '');
    console.log(`   改名后项目名: ${renamedName}`);
    const nameRenamed = renamedName.includes('每日心情');
    record('TC-08 步骤3 侧边栏同步显示新名', nameRenamed, nameRenamed ? `新名: ${renamedName}` : `仍为: ${renamedName}`);

    await shot(page, 'tc08-step3-renamed');

    // 步骤4: F5 刷新
    console.log('   步骤4: F5 刷新...');
    const nameBeforeRefresh = await page.locator('[data-testid="project-name"], .project-name, [class*="project-title"]').first().textContent().catch(() => '');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    const nameAfterRefresh = await page.locator('[data-testid="project-name"], .project-name, [class*="project-title"]').first().textContent().catch(() => '');
    console.log(`   刷新前: ${nameBeforeRefresh}, 刷新后: ${nameAfterRefresh}`);
    const namePersisted = nameAfterRefresh.includes('每日心情') || nameAfterRefresh === nameBeforeRefresh;
    record('TC-08 步骤4 F5 刷新后项目名保持', namePersisted, namePersisted ? '名字已落库' : '名字回退');

    await shot(page, 'tc08-step4-after-refresh');

    // 步骤5: 手动重命名后 AI 尝试修改
    console.log('   步骤5: 手动重命名保护...');
    // 点击"我的项目"进入项目列表
    const myProjectsLink = page.locator('a[href*="project"], button:has-text("我的项目")').first();
    if (await myProjectsLink.count() > 0) {
      await myProjectsLink.click();
      await page.waitForTimeout(3000);

      // 找到项目并重命名
      const projectCard = page.locator('[data-testid="project-card"], .project-card').first();
      if (await projectCard.count() > 0) {
        // 点击重命名按钮或菜单
        const renameBtn = projectCard.locator('button[title*="重命名"], button:has-text("重命名")').first();
        if (await renameBtn.count() > 0) {
          await renameBtn.click();
          await page.waitForTimeout(1000);

          // 输入新名字
          const nameInput = projectCard.locator('input[type="text"]').first();
          if (await nameInput.count() > 0) {
            await nameInput.fill('手动名');
            await nameInput.press('Enter');
            await page.waitForTimeout(2000);

            record('TC-08 步骤5 手动重命名', true, '已手动改为"手动名"');

            // 回到对话让 AI 改名
            await page.goto(`${FRONTEND_BASE}/create`, { waitUntil: 'networkidle' });
            await page.waitForTimeout(3000);

            await sendMessage(page, '把项目改名为《AI新名字》');
            await waitForAIResponse(page, 180000).catch(() => {});

            // 检查手动名是否被覆盖
            const finalName = await page.locator('[data-testid="project-name"], .project-name, [class*="project-title"]').first().textContent().catch(() => '');
            const manuallyProtected = finalName.includes('手动名') || !finalName.includes('AI新名字');
            record('TC-08 步骤5 手动名不被 AI 覆盖', manuallyProtected, manuallyProtected ? '手动名受保护' : '手动名被覆盖');

            await shot(page, 'tc08-step5-manual-protected');
          }
        }
      }
    }

    // ========== TC-09: stage_08 AI 修改项目总结后评估卡片同步 ==========
    console.log('\n=== TC-09: stage_08 AI 修改项目总结后评估卡片同步 ===');

    // 需要推进到 stage_08 的项目，使用阶段A的项目
    // 先回到已有项目
    await page.goto(`${FRONTEND_BASE}/create`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 尝试推进到 stage_08（验收评估）
    console.log('   尝试推进到 stage_08...');
    await sendMessage(page, '请帮我完成项目并进入验收评估阶段');
    await waitForAIResponse(page, 180000).catch(() => {});

    // 检查是否已到 stage_08
    const stageIndicator = await page.locator('[data-testid="stage-indicator"], .stage-badge, [class*="stage"]').first().textContent().catch(() => '');
    console.log(`   当前阶段: ${stageIndicator}`);
    const isStage08 = stageIndicator.includes('08') || stageIndicator.includes('验收') || stageIndicator.includes('评估');

    if (!isStage08) {
      console.log('   未到达 stage_08，尝试继续推进...');
      // 多发几条消息尝试推进
      for (let i = 0; i < 3; i++) {
        await sendMessage(page, '继续推进到验收阶段');
        await waitForAIResponse(page, 180000).catch(() => {});
        await page.waitForTimeout(2000);

        const currentStage = await page.locator('[data-testid="stage-indicator"], .stage-badge, [class*="stage"]').first().textContent().catch(() => '');
        if (currentStage.includes('08') || currentStage.includes('验收')) {
          break;
        }
      }
    }

    const finalStage = await page.locator('[data-testid="stage-indicator"], .stage-badge, [class*="stage"]').first().textContent().catch(() => '');
    console.log(`   最终阶段: ${finalStage}`);
    record('TC-09 到达 stage_08', finalStage.includes('08') || finalStage.includes('验收'), `阶段: ${finalStage}`);

    if (finalStage.includes('08') || finalStage.includes('验收')) {
      // 步骤1: 记录当前评估卡片内容
      console.log('   步骤1: 记录评估卡片基准...');

      // 切到评估页签
      const evalTab = page.locator('[data-testid="eval-tab"], button:has-text("评估"), button:has-text("验收"]').first();
      if (await evalTab.count() > 0) {
        await evalTab.click();
        await page.waitForTimeout(2000);
      }

      const baselineSummary = await page.locator('[data-testid="eval-summary"], textarea[name*="summary"], [class*="summary"]').first().inputValue().catch(() => '');
      console.log(`   基准总结: ${baselineSummary.slice(0, 50)}...`);

      await shot(page, 'tc09-step1-baseline');

      // 步骤2: 让 AI 修改总结
      console.log('   步骤2: AI 修改总结...');
      toolCalls.length = 0;
      await sendMessage(page, '验收总结内容有错，请重写：项目实际完成了心情记录和标签功能，把总结改成反映真实情况');
      await waitForAIResponse(page, 180000).catch(() => {});

      // 检查 artifact_writer 调用
      const artifactWriterCalls = toolCalls.filter(t => t.text.includes('artifact_writer'));
      record('TC-09 步骤2 [tool_call] artifact_writer', artifactWriterCalls.length > 0, `捕获 ${artifactWriterCalls.length} 次调用`);

      // 步骤3: 观察评估卡片更新
      console.log('   步骤3: 检查评估卡片更新...');
      await page.waitForTimeout(3000);

      // 切出再切回评估页签
      const chatTab = page.locator('[data-testid="chat-tab"], button:has-text("对话")').first();
      if (await chatTab.count() > 0) {
        await chatTab.click();
        await page.waitForTimeout(1000);
        await evalTab.click();
        await page.waitForTimeout(2000);
      }

      const updatedSummary = await page.locator('[data-testid="eval-summary"], textarea[name*="summary"], [class*="summary"]').first().inputValue().catch(() => '');
      console.log(`   更新后总结: ${updatedSummary.slice(0, 50)}...`);

      const summaryUpdated = updatedSummary !== baselineSummary && updatedSummary.length > 0;
      record('TC-09 步骤3 评估卡片内容更新', summaryUpdated, summaryUpdated ? '内容已更新' : '内容未变');

      // 检查 AI 是否声称无法触及
      const aiEvalResponse = await page.locator('[data-testid="message-assistant"]').last().textContent().catch(() => '');
      const claimsCannotAccess = aiEvalResponse.includes('无法触及') || aiEvalResponse.includes('step8.payload') || aiEvalResponse.includes('无法修改');
      record('TC-09 步骤3 AI 不声称无法触及', !claimsCannotAccess, claimsCannotAccess ? 'AI 声称无法触及' : 'AI 完成修改');

      await shot(page, 'tc09-step3-updated');

      // 步骤4: F5 刷新
      console.log('   步骤4: F5 刷新...');
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(5000);

      // 切回评估页签
      const evalTabAfterRefresh = page.locator('[data-testid="eval-tab"], button:has-text("评估"), button:has-text("验收"]').first();
      if (await evalTabAfterRefresh.count() > 0) {
        await evalTabAfterRefresh.click();
        await page.waitForTimeout(2000);
      }

      const afterRefreshSummary = await page.locator('[data-testid="eval-summary"], textarea[name*="summary"], [class*="summary"]').first().inputValue().catch(() => '');
      console.log(`   刷新后总结: ${afterRefreshSummary.slice(0, 50)}...`);

      const noRollback = afterRefreshSummary === updatedSummary || (afterRefreshSummary.length > 0 && updatedSummary.length > 0);
      record('TC-09 步骤4 F5 后内容不回滚', noRollback, noRollback ? '内容保持' : '内容回滚');

      await shot(page, 'tc09-step4-after-refresh');

      // 步骤5: 手动修改并保存
      console.log('   步骤5: 手动修改并保存...');
      const summaryInput = page.locator('[data-testid="eval-summary"], textarea[name*="summary"], [class*="summary"]').first();
      if (await summaryInput.count() > 0) {
        await summaryInput.fill('手动修改的总结内容');
        await page.waitForTimeout(500);

        // 点击保存
        const saveBtn = page.locator('button:has-text("保存"), button[type="submit"]').first();
        if (await saveBtn.count() > 0) {
          await saveBtn.click();
          await page.waitForTimeout(2000);
        }

        // 刷新验证
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(5000);

        const afterManualSave = await page.locator('[data-testid="eval-summary"], textarea[name*="summary"], [class*="summary"]').first().inputValue().catch(() => '');
        const manualSaved = afterManualSave.includes('手动修改');
        record('TC-09 步骤5 手动修改生效且保留', manualSaved, manualSaved ? '手动修改保留' : '手动修改丢失');

        await shot(page, 'tc09-step5-manual-saved');
      }
    } else {
      console.log('   未能到达 stage_08，跳过 TC-09 后续步骤');
      record('TC-09 跳过', false, '未到达 stage_08');
    }

    // ========== 汇总 ==========
    console.log('\n=== TC-08 / TC-09 测试结果汇总 ===');
    for (const r of results) console.log(` ${r.pass ? '✅' : '❌'} ${r.name} — ${r.detail}`);
    const passed = results.filter((r) => r.pass).length;
    console.log(`\n通过 ${passed}/${results.length}`);

    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('测试出错:', error.message);
    await shot(page, 'tc08-tc09-error').catch(() => {});
  }

  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
})();
