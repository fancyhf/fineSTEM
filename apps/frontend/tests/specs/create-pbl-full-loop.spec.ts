/**
 * fineSTEM E2E 测试 - PBL 闭环确定性前端渲染验证
 *
 * 用途：通过 API 直推后端到指定阶段，点击项目选中后断言前端 /create 页面
 * 正确渲染阶段进度条、教学模式切换器、编辑器、聊天历史。完全不碰 LLM。
 *
 * 维护者：AI Agent
 * links: .trae/documents/testing/
 */

import type { Page } from '@playwright/test';
import { test, expect, API_BASE } from '../fixtures';

interface ProjectRecord {
  id: string;
  name: string;
  mode: string;
  current_stage?: string;
}

interface ApiEnvelope<T> {
  data: T;
  message?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

/** 等待 workspace 恢复的稳定时间 */
const RESTORE_SETTLE_MS = 3000;

/** 前端 STANDARD_STAGES 中的阶段标签（与 Create.tsx 中 STANDARD_STAGES 一致） */
const STAGE_LABELS: Record<string, string> = {
  stage_00_bootstrap: '初始化',
  stage_01_brainstorm: '脑爆选题',
  stage_02_brief: '开题立项',
  stage_03_constraints: '范围裁剪',
  stage_04_track: '轨道选择',
  stage_05_design: '设计蓝图',
  stage_06_step_plan: '分步计划',
  stage_07_execute: '编码实现',
  stage_08_evaluate: '验收展示',
};

/** 创建标准项目 */
async function createStandardProject(page: Page, token: string, name: string): Promise<ProjectRecord> {
  const response = await page.request.post(`${API_BASE}/projects`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name, mode: 'standard' },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as ApiEnvelope<ProjectRecord>;
  return body.data;
}

/** 用 /pbl/complete-stage 逐阶段推进 */
async function drivePblStages(
  page: Page,
  token: string,
  projectId: string,
  stages: Array<{ stage: string; artifact: string; content: string }>,
): Promise<void> {
  for (const { stage, artifact, content } of stages) {
    const response = await page.request.post(`${API_BASE}/projects/${projectId}/pbl/complete-stage`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { stage, artifacts: { [artifact]: content } },
    });
    expect(response.ok(), `阶段 ${stage} 推进失败`).toBeTruthy();
  }
}

/** 保存代码 */
async function saveProjectCode(
  page: Page,
  token: string,
  projectId: string,
  code: string,
  language: string,
): Promise<void> {
  const response = await page.request.post(`${API_BASE}/projects/${projectId}/code`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { code, language },
  });
  expect(response.ok()).toBeTruthy();
}

/** 保存聊天历史 */
async function saveProjectChat(
  page: Page,
  token: string,
  projectId: string,
  messages: ChatMessage[],
): Promise<void> {
  const response = await page.request.post(`${API_BASE}/projects/${projectId}/chat`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { messages },
  });
  expect(response.ok()).toBeTruthy();
}

/** 点击侧边栏中的项目来选中并触发 workspace 恢复 */
async function selectProjectInSidebar(page: Page, projectName: string): Promise<void> {
  // 侧边栏项目列表中项目名以 📍 前缀显示
  const projectItem = page.locator(`text=${projectName}`).first();
  await projectItem.click();
  // 等待 workspace 恢复完成
  await page.waitForTimeout(RESTORE_SETTLE_MS);
}

test.describe('PBL 闭环确定性前端渲染', () => {
  test('确定性推进到 stage_07 后前端完整渲染', async ({ authenticatedPage, testUser }) => {
    const token = testUser.token;
    const projectName = 'PBL 闭环 E2E 测试';

    // 1. 创建标准项目
    const project = await createStandardProject(authenticatedPage, token, projectName);

    // 2. 逐阶段推进到 stage_07_execute
    const stages = [
      { stage: 'stage_01_brainstorm', artifact: 'brainstorm', content: '# 脑爆\nAI 诗词生成器' },
      { stage: 'stage_02_brief', artifact: 'project_brief', content: '# 项目简介\n做一个诗词工具' },
      { stage: 'stage_03_constraints', artifact: 'constraints', content: '# 约束\nPython' },
      { stage: 'stage_04_track', artifact: 'track_plan', content: '# 轨道\nWeb 应用' },
      { stage: 'stage_05_design', artifact: 'design', content: '# 设计\nReact + FastAPI' },
      { stage: 'stage_06_step_plan', artifact: 'step_plan', content: '# 分步\nStep1 脚手架' },
      { stage: 'stage_07_execute', artifact: 'dev_log', content: '# 开发日志\nDay1 初始化' },
    ];
    await drivePblStages(authenticatedPage, token, project.id, stages);

    // 3. 写入示例代码
    await saveProjectCode(authenticatedPage, token, project.id, 'print("hello world")', 'python');

    // 4. 写入聊天历史
    const chatMessages: ChatMessage[] = [
      { id: 'msg-1', role: 'user', content: '帮我开始这个项目' },
      { id: 'msg-2', role: 'assistant', content: '好的，让我们从搭建项目结构开始。' },
    ];
    await saveProjectChat(authenticatedPage, token, project.id, chatMessages);

    // 5. 导航到 /create
    await authenticatedPage.goto('/create');
    await authenticatedPage.waitForLoadState('domcontentloaded');
    await authenticatedPage.waitForTimeout(RESTORE_SETTLE_MS);

    // 6. 点击侧边栏项目名来选中项目（触发 workspace 恢复）
    await selectProjectInSidebar(authenticatedPage, projectName);

    // 7. 断言：阶段进度条显示 stage_07（"执行开发"）
    const stageLabel = STAGE_LABELS['stage_07_execute'];
    const stageBar = authenticatedPage.locator(`text=${stageLabel}`);
    await expect(stageBar).toBeVisible({ timeout: 15000 });

    // 8. 断言：教学模式切换器可见（stage_07 触发显示）
    const teachingModeLabel = authenticatedPage.locator('text=教学模式');
    await expect(teachingModeLabel).toBeVisible({ timeout: 10000 });

    // 9. 断言：聊天历史已恢复
    const chatArea = authenticatedPage.locator('text=帮我开始这个项目');
    await expect(chatArea).toBeVisible({ timeout: 10000 });

    // 10. 断言：代码编辑器区域存在（标签为"代码"）
    const codeTab = authenticatedPage.locator('button:has-text("代码")');
    await expect(codeTab.first()).toBeVisible({ timeout: 10000 });
  });

  test('确定性推进到 stage_08 后前端渲染验收阶段', async ({ authenticatedPage, testUser }) => {
    const token = testUser.token;
    const projectName = 'PBL 验收阶段 E2E';

    // 1. 创建标准项目并推到 stage_08
    const project = await createStandardProject(authenticatedPage, token, projectName);

    const stages = [
      { stage: 'stage_01_brainstorm', artifact: 'brainstorm', content: '# 脑爆' },
      { stage: 'stage_02_brief', artifact: 'project_brief', content: '# 简介' },
      { stage: 'stage_03_constraints', artifact: 'constraints', content: '# 约束' },
      { stage: 'stage_04_track', artifact: 'track_plan', content: '# 轨道' },
      { stage: 'stage_05_design', artifact: 'design', content: '# 设计' },
      { stage: 'stage_06_step_plan', artifact: 'step_plan', content: '# 计划' },
      { stage: 'stage_07_execute', artifact: 'dev_log', content: '# 日志' },
      { stage: 'stage_08_evaluate', artifact: 'evaluate', content: '# 验收总结' },
    ];
    await drivePblStages(authenticatedPage, token, project.id, stages);

    // 2. 导航到 /create
    await authenticatedPage.goto('/create');
    await authenticatedPage.waitForLoadState('domcontentloaded');
    await authenticatedPage.waitForTimeout(RESTORE_SETTLE_MS);

    // 3. 点击侧边栏项目名来选中项目
    await selectProjectInSidebar(authenticatedPage, projectName);

    // 4. 断言：阶段进度条显示验收阶段（"评估阶段"）
    const stageLabel = STAGE_LABELS['stage_08_evaluate'];
    const evaluateStage = authenticatedPage.locator(`text=${stageLabel}`);
    await expect(evaluateStage).toBeVisible({ timeout: 15000 });

    // 5. 断言：教学模式切换器可见
    const teachingModeLabel = authenticatedPage.locator('text=教学模式');
    await expect(teachingModeLabel).toBeVisible({ timeout: 10000 });
  });
});
