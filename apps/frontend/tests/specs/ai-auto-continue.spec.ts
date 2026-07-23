/**
 * AI 自动续接功能 E2E 测试
 *
 * 测试场景：
 * 1. 用户请求生成长代码（超过 LLM 单次输出限制）
 * 2. AI 输出被截断
 * 3. 系统自动续接并完整输出
 * 4. 或显示"继续生成"按钮让用户手动触发
 *
 * 用法：
 *   npx playwright test ai-auto-continue.spec.ts --headed
 *   npx playwright test ai-auto-continue.spec.ts -g "自动续接"
 */

import { expect, Page } from '@playwright/test';
import { test } from '../fixtures';

const CONFIG = {
  BASE_URL: process.env.BASE_URL || 'http://localhost:5184/create',
  TIMEOUTS: {
    // 长代码生成需要更长的超时时间
    AI_RESPONSE: 180000,      // 3 分钟（包含续接时间）
    CODE_APPEAR: 30000,       // 代码出现
    CONTINUE_BUTTON: 60000,   // 继续按钮出现
    EDITOR_APPEAR: 15000,
  },
  SCREENSHOT_DIR: 'test-results/auto-continue',
};

test.describe('@ai AI 自动续接功能测试', () => {

  test.beforeAll(async () => {
    console.log('\n========== AI 自动续接测试开始 ==========');
    console.log(`前端地址: ${CONFIG.BASE_URL}`);
    console.log('注意：此测试需要较长时间（2-3分钟），请耐心等待');
  });

  test.afterAll(async () => {
    console.log('\n========== AI 自动续接测试结束 ==========\n');
  });

  /**
   * 测试：长代码自动生成与续接
   */
  test('完整长代码生成流程 - 自动续接应正常工作', async ({ page }) => {
    const helper = new AutoContinueTestHelper(page);

    // 1. 进入创造页面
    await helper.navigateToCreatePage();

    // 2. 发送长代码生成请求
    const longCodePrompt = `请写一个完整的贪吃蛇游戏，使用 Python 和 Pygame。
包含：游戏循环、碰撞检测、分数系统、食物生成、蛇身增长、
游戏结束界面、重新开始功能、键盘控制。
请确保代码完整可运行，不要省略任何部分。`;

    await helper.sendMessage(longCodePrompt);

    // 3. 等待 AI 响应（可能需要续接）
    console.log('⏳ 等待 AI 生成代码（可能需要 2-3 分钟）...');

    // 4. 检查是否出现"继续生成"按钮
    const hasContinueButton = await helper.waitForContinueButton(30000);

    if (hasContinueButton) {
      console.log('✅ 检测到"继续生成"按钮，点击继续...');
      await helper.clickContinueButton();

      // 等待续接完成
      await helper.waitForCodeGeneration(60000);
    } else {
      console.log('✅ 未检测到按钮，等待自动续接完成...');
      await helper.waitForCodeGeneration(CONFIG.TIMEOUTS.AI_RESPONSE);
    }

    // 5. 验证代码已生成并流入编辑器
    const codeInEditor = await helper.getEditorCode();
    expect(codeInEditor.length).toBeGreaterThan(1000); // 至少 1000 字符
    expect(codeInEditor).toContain('import');
    expect(codeInEditor).toContain('pygame');

    // 6. 验证代码完整性（检查关键函数）
    expect(codeInEditor).toMatch(/def|class/i);

    console.log(`✅ 代码生成成功，长度: ${codeInEditor.length} 字符`);
    await helper.screenshot('code-generated');

    // 7. 尝试运行代码
    await helper.runCode();
    console.log('✅ 代码运行测试完成');
  });

  /**
   * 测试：超长输出（3D 游戏引擎）
   */
  test('超长代码生成 - 3D 游戏引擎（可能触发多次续接）', async ({ page }) => {
    const helper = new AutoContinueTestHelper(page);

    await helper.navigateToCreatePage();

    // 发送超长代码请求
    const ultraLongPrompt = `请写一个完整的 3D 游戏引擎演示，使用 Python 和 PyOpenGL。
包含：向量数学、3D 模型加载、光照系统、纹理映射、摄像机控制、
碰撞检测、粒子系统。代码要完整详细，每个函数都要有注释。`;

    await helper.sendMessage(ultraLongPrompt);

    console.log('⏳ 等待超长代码生成（可能需要 3-5 分钟）...');

    // 等待代码生成，可能需要多次续接
    let continueCount = 0;
    const maxContinues = 3;

    while (continueCount < maxContinues) {
      const hasContinueButton = await helper.waitForContinueButton(45000);

      if (hasContinueButton) {
        continueCount++;
        console.log(`🔄 第 ${continueCount} 次点击"继续生成"...`);
        await helper.clickContinueButton();
      } else {
        break;
      }
    }

    // 最终等待代码生成
    await helper.waitForCodeGeneration(60000);

    const codeInEditor = await helper.getEditorCode();
    expect(codeInEditor.length).toBeGreaterThan(2000);

    console.log(`✅ 超长代码生成完成，共续接 ${continueCount} 次，总长度: ${codeInEditor.length} 字符`);
    await helper.screenshot('ultra-long-code');
  });

  /**
   * 测试：网络中断恢复
   */
  test('网络中断后应能恢复并继续生成', async ({ page }) => {
    const helper = new AutoContinueTestHelper(page);

    await helper.navigateToCreatePage();

    await helper.sendMessage('写一个完整的俄罗斯方块游戏，Python+Pygame');

    // 等待部分响应
    await page.waitForTimeout(10000);

    // 模拟网络中断（断开 WebSocket）
    await page.evaluate(() => {
      // @ts-ignore
      const ws = window.__wsConnection;
      if (ws) ws.close();
    });

    console.log('⚠️ 模拟网络中断');
    await page.waitForTimeout(2000);

    // 检查是否显示"继续生成"按钮或错误提示
    const errorVisible = await page.locator('text=/超时|连接|失败/i').isVisible({ timeout: 10000 }).catch(() => false);

    if (errorVisible) {
      console.log('✅ 检测到错误提示，检查是否有继续按钮...');
      const hasContinueButton = await helper.waitForContinueButton(5000);

      if (hasContinueButton) {
        await helper.clickContinueButton();
        await helper.waitForCodeGeneration(60000);

        const codeInEditor = await helper.getEditorCode();
        expect(codeInEditor.length).toBeGreaterThan(500);
        console.log('✅ 网络中断后成功恢复');
      }
    }
  });
});

/**
 * 测试辅助类
 */
class AutoContinueTestHelper {
  page: Page;
  screenshots: string[] = [];

  constructor(page: Page) {
    this.page = page;
  }

  async navigateToCreatePage(): Promise<void> {
    await this.page.goto(CONFIG.BASE_URL, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(1000);
    console.log('✅ 已进入创造页面');
  }

  async sendMessage(message: string): Promise<void> {
    const textarea = this.page.locator('textarea[placeholder*="描述"], textarea').first();
    await textarea.fill(message);

    const sendButton = this.page.locator('button:has-text("发送"), button[type="submit"]').first();
    await sendButton.click();

    console.log(`📤 发送消息: ${message.slice(0, 50)}...`);
  }

  async waitForContinueButton(timeout: number): Promise<boolean> {
    try {
      const button = this.page.locator('button:has-text("继续生成"), [data-testid="continue-button"]');
      await button.waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  async clickContinueButton(): Promise<void> {
    const button = this.page.locator('button:has-text("继续生成"), [data-testid="continue-button"]');
    await button.click();
    console.log('🖱️ 点击"继续生成"按钮');
  }

  async waitForCodeGeneration(timeout: number): Promise<void> {
    // 等待代码编辑器出现或代码内容流入
    await this.page.waitForFunction(
      () => {
        const editor = document.querySelector('textarea, .monaco-editor, [data-testid="code-editor"]');
        return editor && (editor as HTMLTextAreaElement).value?.length > 100;
      },
      { timeout }
    );
    console.log('✅ 代码已生成');
  }

  async getEditorCode(): Promise<string> {
    const editor = this.page.locator('textarea, .monaco-editor textarea, [data-testid="code-editor"]').first();
    return await editor.inputValue() || await editor.textContent() || '';
  }

  async runCode(): Promise<void> {
    const runButton = this.page.locator('button:has-text("运行"), button:has([name="play"])').first();
    if (await runButton.isVisible().catch(() => false)) {
      await runButton.click();
      await this.page.waitForTimeout(3000);
      console.log('▶️ 代码已运行');
    }
  }

  async screenshot(name: string): Promise<void> {
    const path = `${CONFIG.SCREENSHOT_DIR}/${Date.now()}-${name}.png`;
    await this.page.screenshot({ path });
    this.screenshots.push(path);
  }
}
