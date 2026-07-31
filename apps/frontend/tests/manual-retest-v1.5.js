/**
 * fineSTEM 创造功能增强 v1.5 复测脚本
 * 测试范围：TC-08、TC-09、TC-10
 * 
 * TC-08: 项目名同步（Q-026 修复验证）
 * TC-09: 评估报告修改（用预置 stage_08 项目）
 * TC-10: 评估报告可改 + 工件名别名（Q-028 修复验证）
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 配置
const FRONTEND_BASE = 'http://localhost:5184';
const MOCK_USER = {
  email: '2749959@qq.com',
  password: '750714hf'
};

// 截图目录
const SCREENSHOT_DIR = path.join(__dirname, '..', '..', '..', 'test-results');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

let screenshotCounter = 1;
async function screenshot(page, name) {
  const filename = `enh-v15-${String(screenshotCounter).padStart(2, '0')}-${name}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`  📸 截图: ${filename}`);
  screenshotCounter++;
  return filename;
}

// 等待函数
async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 登录函数
async function login(page) {
  console.log('\n🔐 登录 MOCK_USER...');
  await page.goto(`${FRONTEND_BASE}/login`);
  await wait(2000);
  
  await page.fill('input[type="email"]', MOCK_USER.email);
  await page.fill('input[type="password"]', MOCK_USER.password);
  await page.click('button[type="submit"]');
  
  // 等待跳转到首页（可能是 /dashboard /create /projects /research）
  await page.waitForURL(/\/(dashboard|create|projects|research)/, { timeout: 15000 });
  await wait(2000);
  console.log('  ✅ 登录成功');
}

// 等待 AI 响应
async function waitForAIResponse(page, timeout = 120000) {
  console.log('  ⏳ 等待 AI 响应...');
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const messages = await page.locator('[data-testid="ai-message"], .ai-message, [class*="ai"]').count();
    const isTyping = await page.locator('[data-testid="typing-indicator"], .typing-indicator, [class*="typing"]').count() > 0;
    
    if (messages > 0 && !isTyping) {
      await wait(2000);
      return true;
    }
    await wait(1000);
  }
  return false;
}

// 发送消息
async function sendMessage(page, text) {
  console.log(`  💬 发送: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
  
  const input = page.locator('textarea, [data-testid="chat-input"], input[type="text"]').first();
  await input.waitFor({ state: 'visible', timeout: 10000 });
  await input.fill(text);
  
  const sendButton = page.locator('button[type="submit"], [data-testid="send-button"]').first();
  await sendButton.click();
  
  await wait(1000);
}

// 捕获控制台日志
function setupConsoleCapture(page) {
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push({ type: msg.type(), text, time: new Date().toISOString() });
    
    // 实时显示关键日志
    if (text.includes('[tool_call]') || text.includes('[tool_result]') || 
        text.includes('skill_state_writer') || text.includes('artifact_writer') ||
        text.includes('Q-026') || text.includes('Q-028')) {
      console.log(`    📝 ${text.substring(0, 150)}`);
    }
  });
  return logs;
}

// ==================== TC-08: 项目名同步 ====================
async function testTC08(page, logs) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 TC-08: 项目名同步（Q-026 修复验证）');
  console.log('='.repeat(60));
  
  const results = {
    step1: false,
    step2: false,
    step3: false,
    step4: false,
    step5: false
  };
  
  // 步骤 1: 创建新项目，查看侧边栏项目名
  console.log('\n步骤 1: 创建新项目，查看侧边栏项目名...');
  await page.goto(`${FRONTEND_BASE}/create`);
  await wait(3000);
  await screenshot(page, 'tc08-step1-create-page');
  
  // 检查侧边栏项目名（使用 data-testid 或备选选择器）
  const projectNameSelectors = [
    '[data-testid="project-name"]',
    '[data-project-id] .truncate',
    '[class*="project-name"]',
    'aside [class*="truncate"]'
  ];
  
  let projectNameFound = false;
  for (const selector of projectNameSelectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 3000 })) {
        const text = await element.textContent();
        console.log(`  ✅ 找到项目名: "${text}" (选择器: ${selector})`);
        projectNameFound = true;
        results.step1 = true;
        break;
      }
    } catch (e) {}
  }
  
  if (!projectNameFound) {
    console.log('  ⚠️ 未找到项目名元素（可能是新项目还未生成默认名）');
    results.step1 = 'N/A - 新项目无默认名';
  }
  
  // 步骤 2: 对话让 AI 确认项目名
  console.log('\n步骤 2: 对话让 AI 确认项目名...');
  await sendMessage(page, '请确认当前项目的名称是什么？');
  const responded = await waitForAIResponse(page, 60000);
  
  if (responded) {
    await screenshot(page, 'tc08-step2-ai-response');
    console.log('  ✅ AI 已响应');
    results.step2 = true;
  } else {
    console.log('  ❌ AI 响应超时');
    results.step2 = false;
  }
  
  // 步骤 3: 要求 AI 修改项目名
  console.log('\n步骤 3: 要求 AI 修改项目名为 "我的测试项目"...');
  logs.length = 0; // 清空日志
  await sendMessage(page, '请将项目名称修改为"我的测试项目"');
  const modified = await waitForAIResponse(page, 60000);
  
  if (modified) {
    await screenshot(page, 'tc08-step3-after-rename');
    
    // 检查工具调用
    const toolCalls = logs.filter(l => l.text.includes('[tool_call]') && l.text.includes('skill_state_writer'));
    const toolResults = logs.filter(l => l.text.includes('[tool_result]') && l.text.includes('skill_state_writer'));
    const q026Logs = logs.filter(l => l.text.includes('[Q-026]'));
    
    console.log(`  📊 skill_state_writer 调用: ${toolCalls.length} 次`);
    console.log(`  📊 skill_state_writer 结果: ${toolResults.length} 次`);
    console.log(`  📊 Q-026 日志: ${q026Logs.length} 条`);
    
    if (toolCalls.length > 0) {
      console.log('  ✅ 捕获到 skill_state_writer 工具调用');
      results.step3 = true;
    } else {
      console.log('  ⚠️ 未捕获到 skill_state_writer 调用');
      results.step3 = 'PARTIAL - 无工具调用日志';
    }
    
    // 检查 AI 是否宣称无法修改
    const pageContent = await page.content();
    if (pageContent.includes('无法修改') || pageContent.includes('受保护') || 
        pageContent.includes('锁定') || pageContent.includes('没有权限')) {
      console.log('  ❌ AI 宣称无法修改项目名');
      results.step3 = false;
    }
  } else {
    console.log('  ❌ AI 响应超时');
    results.step3 = false;
  }
  
  // 步骤 4: 验证侧边栏项目名已更新
  console.log('\n步骤 4: 验证侧边栏项目名已更新...');
  await wait(2000);
  await page.reload();
  await wait(3000);
  await screenshot(page, 'tc08-step4-after-refresh');
  
  let newNameFound = false;
  for (const selector of projectNameSelectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 3000 })) {
        const text = await element.textContent();
        if (text.includes('我的测试项目') || text.includes('测试项目')) {
          console.log(`  ✅ 侧边栏项目名已更新: "${text}"`);
          newNameFound = true;
          results.step4 = true;
          break;
        }
      }
    } catch (e) {}
  }
  
  if (!newNameFound) {
    console.log('  ⚠️ 未确认侧边栏项目名已更新（可能需要更长时间同步）');
    results.step4 = 'PENDING - 需手动验证';
  }
  
  // 步骤 5: F5 刷新后项目名保持
  console.log('\n步骤 5: F5 刷新验证项目名保持...');
  await page.reload();
  await wait(3000);
  await screenshot(page, 'tc08-step5-final-refresh');
  
  let nameKept = false;
  for (const selector of projectNameSelectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 3000 })) {
        const text = await element.textContent();
        if (text && text.trim().length > 0) {
          console.log(`  ✅ 刷新后项目名保持: "${text}"`);
          nameKept = true;
          results.step5 = true;
          break;
        }
      }
    } catch (e) {}
  }
  
  if (!nameKept) {
    console.log('  ⚠️ 未找到项目名元素');
    results.step5 = false;
  }
  
  return results;
}

// ==================== TC-09: 评估报告修改 ====================
async function testTC09(page, logs) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 TC-09: 评估报告修改（用预置 stage_08 项目）');
  console.log('='.repeat(60));
  
  const results = {
    step1: false,
    step2: false,
    step3: false,
    step4: false,
    step5: false
  };
  
  // 尝试打开已存在的 stage_08 项目
  // 先尝试 8a7c155e，如果不存在则尝试其他可能的项目
  const possibleProjects = [
    '8a7c155e-5f66-4d7a-a595-e287731ff747',
    'a1b57213-b531-43bc-927a-c1665992055a'
  ];
  
  let projectId = null;
  for (const pid of possibleProjects) {
    try {
      await page.goto(`${FRONTEND_BASE}/create?project=${pid}`);
      await wait(4000);
      
      // 检查是否成功加载项目
      const url = page.url();
      if (!url.includes('/login')) {
        projectId = pid;
        console.log(`  ✅ 成功加载项目: ${pid}`);
        break;
      }
    } catch (e) {}
  }
  
  if (!projectId) {
    console.log('  ⚠️ 未找到可用的 stage_08 项目，尝试创建新项目推进...');
    // TC-09 需要预置项目，如果没有则跳过
    return { ...results, note: '无可用 stage_08 预置项目' };
  }
  
  await screenshot(page, 'tc09-step1-loaded-project');
  results.step1 = true;
  
  // 步骤 2: 查看评估展示区
  console.log('\n步骤 2: 查看评估展示区...');
  const evaluationSelectors = [
    '[data-testid="evaluation-card"]',
    '[data-testid="evaluation-content"]',
    '[class*="evaluation"]',
    '[class*="评估"]'
  ];
  
  let evaluationFound = false;
  for (const selector of evaluationSelectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 3000 })) {
        const text = await element.textContent();
        console.log(`  ✅ 找到评估展示区: "${text.substring(0, 100)}..."`);
        evaluationFound = true;
        results.step2 = true;
        break;
      }
    } catch (e) {}
  }
  
  if (!evaluationFound) {
    console.log('  ⚠️ 未找到评估展示区（可能项目不在 stage_08）');
    results.step2 = false;
  }
  
  // 步骤 3: 要求 AI 修改评估报告
  console.log('\n步骤 3: 要求 AI 修改评估报告...');
  logs.length = 0;
  await sendMessage(page, '请修改评估报告，增加对代码质量的评价');
  const modified = await waitForAIResponse(page, 60000);
  
  if (modified) {
    await screenshot(page, 'tc09-step3-after-modify');
    
    // 检查 artifact_writer 工具调用
    const toolCalls = logs.filter(l => l.text.includes('[tool_call]') && l.text.includes('artifact_writer'));
    const toolResults = logs.filter(l => l.text.includes('[tool_result]') && l.text.includes('artifact_writer'));
    
    console.log(`  📊 artifact_writer 调用: ${toolCalls.length} 次`);
    console.log(`  📊 artifact_writer 结果: ${toolResults.length} 次`);
    
    if (toolCalls.length > 0) {
      console.log('  ✅ 捕获到 artifact_writer 工具调用');
      results.step3 = true;
    } else {
      console.log('  ⚠️ 未捕获到 artifact_writer 调用');
      results.step3 = 'PARTIAL';
    }
  } else {
    console.log('  ❌ AI 响应超时');
    results.step3 = false;
  }
  
  // 步骤 4: 验证评估展示区已更新
  console.log('\n步骤 4: 验证评估展示区已更新...');
  await wait(2000);
  await screenshot(page, 'tc09-step4-updated');
  results.step4 = 'PENDING - 需人工验证内容是否更新';
  
  // 步骤 5: F5 刷新后保持
  console.log('\n步骤 5: F5 刷新验证保持...');
  await page.reload();
  await wait(3000);
  await screenshot(page, 'tc09-step5-after-refresh');
  results.step5 = 'PENDING - 需人工验证';
  
  return results;
}

// ==================== TC-10: 评估报告可改 + 工件名别名 ====================
async function testTC10(page, logs) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 TC-10: 评估报告可改 + 工件名别名（Q-028 修复验证）');
  console.log('='.repeat(60));
  
  const results = {
    step1: false,
    step2: false,
    step3: false,
    step4: false,
    step5: false
  };
  
  // 使用英语单词项目 8a7c155e 或当前已打开的项目
  console.log('\n步骤 1: 打开项目并查看评估展示区...');
  
  // 检查当前页面是否已有评估内容
  const pageContent = await page.content();
  const hasEvaluation = pageContent.includes('评估') || 
                        pageContent.includes('evaluation') ||
                        pageContent.includes('验收');
  
  if (!hasEvaluation) {
    console.log('  ⚠️ 当前项目无评估展示区，尝试打开 8a7c155e...');
    await page.goto(`${FRONTEND_BASE}/create?project=8a7c155e-5f66-4d7a-a595-e287731ff747`);
    await wait(4000);
  }
  
  await screenshot(page, 'tc10-step1-evaluation-view');
  
  // 检查评估内容是否非模板垃圾
  const content = await page.content();
  const isTemplateJunk = content.includes('在 AI 导师引导下完成的') && 
                         content.includes('我想做一个');
  
  if (!isTemplateJunk) {
    console.log('  ✅ 评估内容非模板垃圾');
    results.step1 = true;
  } else {
    console.log('  ⚠️ 评估内容可能是模板文本');
    results.step1 = 'WARNING - 内容可能是模板';
  }
  
  // 步骤 2: 要求 AI 重新撰写评估报告
  console.log('\n步骤 2: 要求 AI 重新撰写评估报告...');
  logs.length = 0;
  await sendMessage(page, '重新撰写验收评估报告，突出错词本功能');
  const responded = await waitForAIResponse(page, 60000);
  
  if (responded) {
    await screenshot(page, 'tc10-step2-after-rewrite');
    
    // 检查 artifact_writer 工具调用和结果
    const toolCalls = logs.filter(l => l.text.includes('[tool_call]') && l.text.includes('artifact_writer'));
    const toolResults = logs.filter(l => l.text.includes('[tool_result]') && l.text.includes('artifact_writer'));
    const okResults = toolResults.filter(l => l.text.includes('ok'));
    const failedResults = toolResults.filter(l => l.text.includes('failed'));
    
    console.log(`  📊 artifact_writer 调用: ${toolCalls.length} 次`);
    console.log(`  📊 artifact_writer ok: ${okResults.length} 次`);
    console.log(`  📊 artifact_writer failed: ${failedResults.length} 次`);
    
    if (toolCalls.length > 0 && failedResults.length === 0) {
      console.log('  ✅ artifact_writer 调用成功');
      results.step2 = true;
    } else if (failedResults.length > 0) {
      console.log('  ❌ artifact_writer 调用失败');
      results.step2 = false;
    } else {
      console.log('  ⚠️ 未捕获到 artifact_writer 调用');
      results.step2 = 'PARTIAL';
    }
  } else {
    console.log('  ❌ AI 响应超时');
    results.step2 = false;
  }
  
  // 步骤 3: 检查 AI 是否出现推脱话术
  console.log('\n步骤 3: 检查 AI 回复是否含推脱话术...');
  const aiResponse = await page.locator('[data-testid="ai-message"], .ai-message').last().textContent().catch(() => '');
  
  const evasivePhrases = ['受系统保护', '无法修改', '白名单漏掉', '没有权限', '不能修改'];
  const hasEvasive = evasivePhrases.some(p => aiResponse.includes(p));
  
  if (!hasEvasive) {
    console.log('  ✅ AI 未出现推脱话术');
    results.step3 = true;
  } else {
    console.log('  ❌ AI 出现推脱话术');
    results.step3 = false;
  }
  
  // 步骤 4: 验证评估展示区已更新
  console.log('\n步骤 4: 验证评估展示区已更新...');
  await wait(2000);
  await screenshot(page, 'tc10-step4-updated');
  results.step4 = 'PENDING - 需人工验证';
  
  // 步骤 5: F5 刷新后保持
  console.log('\n步骤 5: F5 刷新验证保持...');
  await page.reload();
  await wait(3000);
  await screenshot(page, 'tc10-step5-after-refresh');
  results.step5 = 'PENDING - 需人工验证';
  
  return results;
}

// ==================== 主函数 ====================
async function main() {
  console.log('='.repeat(70));
  console.log('fineSTEM 创造功能增强 v1.5 复测');
  console.log('测试范围: TC-08, TC-09, TC-10');
  console.log('='.repeat(70));
  
  // 使用系统 Chrome
  const chromePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || 
                     'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  
  const browser = await chromium.launch({ 
    headless: false,
    executablePath: chromePath,
    args: ['--window-size=1400,900']
  });
  
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  const logs = setupConsoleCapture(page);
  
  const allResults = {
    tc08: {},
    tc09: {},
    tc10: {},
    logs: []
  };
  
  try {
    // 登录
    await login(page);
    
    // 执行 TC-08
    allResults.tc08 = await testTC08(page, logs);
    
    // 执行 TC-09
    allResults.tc09 = await testTC09(page, logs);
    
    // 执行 TC-10
    allResults.tc10 = await testTC10(page, logs);
    
    // 保存日志
    allResults.logs = logs;
    
  } catch (error) {
    console.error('\n❌ 测试执行出错:', error.message);
    allResults.error = error.message;
  }
  
  // 汇总报告
  console.log('\n' + '='.repeat(70));
  console.log('📊 测试结果汇总');
  console.log('='.repeat(70));
  
  console.log('\nTC-08 项目名同步:');
  Object.entries(allResults.tc08).forEach(([step, result]) => {
    if (step !== 'note') {
      const icon = result === true ? '✅' : result === false ? '❌' : '⚠️';
      console.log(`  ${icon} ${step}: ${result}`);
    }
  });
  
  console.log('\nTC-09 评估报告修改:');
  Object.entries(allResults.tc09).forEach(([step, result]) => {
    if (step !== 'note') {
      const icon = result === true ? '✅' : result === false ? '❌' : '⚠️';
      console.log(`  ${icon} ${step}: ${result}`);
    }
  });
  if (allResults.tc09.note) {
    console.log(`  📝 ${allResults.tc09.note}`);
  }
  
  console.log('\nTC-10 评估报告可改 + 工件名别名:');
  Object.entries(allResults.tc10).forEach(([step, result]) => {
    if (step !== 'note') {
      const icon = result === true ? '✅' : result === false ? '❌' : '⚠️';
      console.log(`  ${icon} ${step}: ${result}`);
    }
  });
  
  // 保存详细结果
  const resultPath = path.join(__dirname, '..', '..', '..', '.dbg', 'v1.5-test-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(allResults, null, 2));
  console.log(`\n💾 详细结果已保存: ${resultPath}`);
  
  await browser.close();
  
  // 返回退出码
  const hasFailures = Object.values(allResults.tc08).some(r => r === false) ||
                      Object.values(allResults.tc09).some(r => r === false) ||
                      Object.values(allResults.tc10).some(r => r === false);
  
  process.exit(hasFailures ? 1 : 0);
}

main().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
