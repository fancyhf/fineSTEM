/**
 * fineSTEM 核心步骤验证脚本
 * 验证 TC-08 step3、TC-09 step3、TC-10 step2 的工具调用
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
  const filename = `core-${String(screenshotCounter).padStart(2, '0')}-${name}.png`;
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
  
  await page.waitForURL(/\/(dashboard|create|projects|research)/, { timeout: 15000 });
  await wait(2000);
  console.log('  ✅ 登录成功');
}

// 等待 AI 响应
async function waitForAIResponse(page, timeout = 120000) {
  console.log('  ⏳ 等待 AI 响应...');
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const isTyping = await page.locator('[data-testid="typing-indicator"], .typing-indicator, [class*="typing"]').count() > 0;
    if (!isTyping) {
      const messages = await page.locator('[data-testid="ai-message"], .ai-message').count();
      if (messages > 0) {
        await wait(2000);
        return true;
      }
    }
    await wait(1000);
  }
  return false;
}

// 发送消息
async function sendMessage(page, text) {
  console.log(`  💬 发送: "${text}"`);
  
  const input = page.locator('textarea, [data-testid="chat-input"]').first();
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
    if (text.includes('[tool_call]') || text.includes('[tool_result]')) {
      console.log(`    📝 ${text.substring(0, 200)}`);
    }
  });
  return logs;
}

// ==================== TC-08 Step 3: 项目名修改 ====================
async function testTC08Step3(page, logs) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 TC-08 Step 3: 项目名修改（核心断言）');
  console.log('='.repeat(60));
  
  // 创建新项目
  await page.goto(`${FRONTEND_BASE}/create`);
  await wait(3000);
  await screenshot(page, 'tc08s3-create');
  
  // 先对话建立上下文
  console.log('\n  建立上下文...');
  await sendMessage(page, '你好，请确认当前项目名称');
  await waitForAIResponse(page, 60000);
  await wait(2000);
  
  // 核心步骤：要求修改项目名
  console.log('\n  🔍 核心断言：捕获 [tool_call] skill_state_writer');
  logs.length = 0;
  await sendMessage(page, '请将项目名称修改为"核心测试项目"');
  const responded = await waitForAIResponse(page, 90000);
  
  await screenshot(page, 'tc08s3-after-rename');
  
  if (!responded) {
    console.log('  ❌ AI 响应超时');
    return false;
  }
  
  // 分析日志
  const skillStateWriterCalls = logs.filter(l => 
    l.text.includes('[tool_call]') && l.text.includes('skill_state_writer')
  );
  const skillStateWriterResults = logs.filter(l => 
    l.text.includes('[tool_result]') && l.text.includes('skill_state_writer')
  );
  
  console.log(`\n  📊 日志分析:`);
  console.log(`     skill_state_writer 调用: ${skillStateWriterCalls.length} 次`);
  console.log(`     skill_state_writer 结果: ${skillStateWriterResults.length} 次`);
  
  // 输出所有 tool_call 日志
  const allToolCalls = logs.filter(l => l.text.includes('[tool_call]'));
  console.log(`\n  📋 所有工具调用 (${allToolCalls.length} 个):`);
  allToolCalls.forEach((log, i) => {
    console.log(`     ${i + 1}. ${log.text.substring(0, 100)}`);
  });
  
  if (skillStateWriterCalls.length > 0) {
    console.log('\n  ✅ TC-08 Step 3 通过：捕获到 skill_state_writer 调用');
    return true;
  } else {
    console.log('\n  ❌ TC-08 Step 3 失败：未捕获到 skill_state_writer 调用');
    return false;
  }
}

// ==================== TC-09 Step 3: 评估报告修改 ====================
async function testTC09Step3(page, logs) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 TC-09 Step 3: 评估报告修改（核心断言）');
  console.log('='.repeat(60));
  
  // 打开 stage_08 项目
  await page.goto(`${FRONTEND_BASE}/create?project=8a7c155e-5f66-4d7a-a595-e287731ff747`);
  await wait(4000);
  await screenshot(page, 'tc09s3-project');
  
  // 尝试点击第 9 阶段 tab
  try {
    const tabs = await page.locator('button').all();
    for (const tab of tabs) {
      const text = await tab.textContent().catch(() => '');
      if (text.includes('9') || text.includes('评估') || text.includes('stage')) {
        console.log(`  点击 tab: ${text}`);
        await tab.click();
        await wait(2000);
        break;
      }
    }
  } catch (e) {}
  
  // 核心步骤：要求修改评估报告
  console.log('\n  🔍 核心断言：捕获 [tool_call] artifact_writer');
  logs.length = 0;
  await sendMessage(page, '请修改评估报告，增加对代码质量的评价');
  const responded = await waitForAIResponse(page, 90000);
  
  await screenshot(page, 'tc09s3-after-modify');
  
  if (!responded) {
    console.log('  ❌ AI 响应超时');
    return false;
  }
  
  // 分析日志
  const artifactWriterCalls = logs.filter(l => 
    l.text.includes('[tool_call]') && l.text.includes('artifact_writer')
  );
  const artifactWriterResults = logs.filter(l => 
    l.text.includes('[tool_result]') && l.text.includes('artifact_writer')
  );
  const okResults = artifactWriterResults.filter(l => l.text.includes('ok'));
  const failedResults = artifactWriterResults.filter(l => l.text.includes('failed'));
  
  console.log(`\n  📊 日志分析:`);
  console.log(`     artifact_writer 调用: ${artifactWriterCalls.length} 次`);
  console.log(`     artifact_writer 结果: ${artifactWriterResults.length} 次`);
  console.log(`     artifact_writer ok: ${okResults.length} 次`);
  console.log(`     artifact_writer failed: ${failedResults.length} 次`);
  
  // 输出所有 tool_call 日志
  const allToolCalls = logs.filter(l => l.text.includes('[tool_call]'));
  console.log(`\n  📋 所有工具调用 (${allToolCalls.length} 个):`);
  allToolCalls.forEach((log, i) => {
    console.log(`     ${i + 1}. ${log.text.substring(0, 100)}`);
  });
  
  if (artifactWriterCalls.length > 0 && failedResults.length === 0) {
    console.log('\n  ✅ TC-09 Step 3 通过：捕获到 artifact_writer 调用且成功');
    return true;
  } else if (failedResults.length > 0) {
    console.log('\n  ❌ TC-09 Step 3 失败：artifact_writer 调用失败');
    return false;
  } else {
    console.log('\n  ❌ TC-09 Step 3 失败：未捕获到 artifact_writer 调用');
    return false;
  }
}

// ==================== TC-10 Step 2: 评估报告重写 ====================
async function testTC10Step2(page, logs) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 TC-10 Step 2: 评估报告重写（核心断言）');
  console.log('='.repeat(60));
  
  // 打开项目
  await page.goto(`${FRONTEND_BASE}/create?project=8a7c155e-5f66-4d7a-a595-e287731ff747`);
  await wait(4000);
  await screenshot(page, 'tc10s2-project');
  
  // 尝试点击第 9 阶段 tab
  try {
    const tabs = await page.locator('button').all();
    for (const tab of tabs) {
      const text = await tab.textContent().catch(() => '');
      if (text.includes('9') || text.includes('评估') || text.includes('stage')) {
        console.log(`  点击 tab: ${text}`);
        await tab.click();
        await wait(2000);
        break;
      }
    }
  } catch (e) {}
  
  // 核心步骤：要求重新撰写评估报告
  console.log('\n  🔍 核心断言：捕获 [tool_call] artifact_writer 且 [tool_result] ok');
  logs.length = 0;
  await sendMessage(page, '重新撰写验收评估报告，突出错词本功能');
  const responded = await waitForAIResponse(page, 90000);
  
  await screenshot(page, 'tc10s2-after-rewrite');
  
  if (!responded) {
    console.log('  ❌ AI 响应超时');
    return false;
  }
  
  // 分析日志
  const artifactWriterCalls = logs.filter(l => 
    l.text.includes('[tool_call]') && l.text.includes('artifact_writer')
  );
  const artifactWriterResults = logs.filter(l => 
    l.text.includes('[tool_result]') && l.text.includes('artifact_writer')
  );
  const okResults = artifactWriterResults.filter(l => l.text.includes('ok'));
  const failedResults = artifactWriterResults.filter(l => l.text.includes('failed'));
  
  console.log(`\n  📊 日志分析:`);
  console.log(`     artifact_writer 调用: ${artifactWriterCalls.length} 次`);
  console.log(`     artifact_writer 结果: ${artifactWriterResults.length} 次`);
  console.log(`     artifact_writer ok: ${okResults.length} 次`);
  console.log(`     artifact_writer failed: ${failedResults.length} 次`);
  
  // 输出所有 tool_call 日志
  const allToolCalls = logs.filter(l => l.text.includes('[tool_call]'));
  console.log(`\n  📋 所有工具调用 (${allToolCalls.length} 个):`);
  allToolCalls.forEach((log, i) => {
    console.log(`     ${i + 1}. ${log.text.substring(0, 100)}`);
  });
  
  // 检查 AI 回复是否含推脱话术
  const aiMessages = await page.locator('[data-testid="ai-message"], .ai-message').allTextContents();
  const aiResponse = aiMessages.join(' ');
  const evasivePhrases = ['受系统保护', '无法修改', '白名单漏掉', '没有权限', '不能修改', '无法更改'];
  const hasEvasive = evasivePhrases.some(p => aiResponse.includes(p));
  
  console.log(`\n  📝 AI 回复分析:`);
  console.log(`     含推脱话术: ${hasEvasive ? '是' : '否'}`);
  if (hasEvasive) {
    const foundPhrase = evasivePhrases.find(p => aiResponse.includes(p));
    console.log(`     发现话术: "${foundPhrase}"`);
  }
  
  if (artifactWriterCalls.length > 0 && okResults.length > 0) {
    console.log('\n  ✅ TC-10 Step 2 通过：捕获到 artifact_writer 调用且成功');
    return true;
  } else if (failedResults.length > 0) {
    console.log('\n  ❌ TC-10 Step 2 失败：artifact_writer 调用失败');
    return false;
  } else {
    console.log('\n  ❌ TC-10 Step 2 失败：未捕获到 artifact_writer 调用');
    return false;
  }
}

// ==================== 主函数 ====================
async function main() {
  console.log('='.repeat(70));
  console.log('fineSTEM 核心步骤 E2E 验证');
  console.log('验证: TC-08 step3, TC-09 step3, TC-10 step2');
  console.log('='.repeat(70));
  
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
  
  const results = {
    tc08Step3: false,
    tc09Step3: false,
    tc10Step2: false
  };
  
  try {
    await login(page);
    
    results.tc08Step3 = await testTC08Step3(page, logs);
    results.tc09Step3 = await testTC09Step3(page, logs);
    results.tc10Step2 = await testTC10Step2(page, logs);
    
  } catch (error) {
    console.error('\n❌ 测试执行出错:', error.message);
  }
  
  // 汇总报告
  console.log('\n' + '='.repeat(70));
  console.log('📊 核心步骤验证结果汇总');
  console.log('='.repeat(70));
  console.log(`TC-08 Step 3 (skill_state_writer): ${results.tc08Step3 ? '✅ 通过' : '❌ 失败'}`);
  console.log(`TC-09 Step 3 (artifact_writer): ${results.tc09Step3 ? '✅ 通过' : '❌ 失败'}`);
  console.log(`TC-10 Step 2 (artifact_writer): ${results.tc10Step2 ? '✅ 通过' : '❌ 失败'}`);
  
  const allPassed = results.tc08Step3 && results.tc09Step3 && results.tc10Step2;
  console.log(`\n总体结果: ${allPassed ? '✅ 全部通过' : '❌ 存在失败'}`);
  
  // 保存结果
  const resultPath = path.join(__dirname, '..', '..', '..', '.dbg', 'core-steps-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 结果已保存: ${resultPath}`);
  
  await browser.close();
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
