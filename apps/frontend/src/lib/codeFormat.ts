/**
 * 代码格式化工具（2026-08-16 修复"HTML 挤在一行没有排版"）。
 *
 * 背景：部分 Demo 种子（如 demo_video_analyzer）的 minimal_replica 是压缩成
 * 单行的 HTML，复制到项目 workspace 后编辑器里整份代码挤在第 1 行，学生无法
 * 阅读、AI 也无法给出行号级指引（引导任务要求"改第 X 行的 <title>"）。
 *
 * 策略：CodeEditor 在挂载/换值时检测"严重单行"（平均行长 > 200 字符）自动
 * 格式化一次，经 onChange 回传父组件 → 自动保存把格式化结果写回 workspace，
 * 存量脏数据自愈。正常已排版的代码绝不重排（阈值保守）。
 *
 * 维护者：AI Agent
 */
import { html as htmlBeautify, css as cssBeautify, js as jsBeautify } from 'js-beautify';

/** 平均行长超过此值视为"严重单行"，允许自动格式化 */
const AVG_LINE_LEN_THRESHOLD = 200;

/** 是否需要自动格式化：只对 html/css/js 且明显挤成一行的代码出手 */
export function needsAutoFormat(code: string, language: string): boolean {
  if (!code) return false;
  if (!['html', 'css', 'javascript'].includes(language)) return false;
  const lines = code.split('\n').length;
  if (lines < 2) return code.length > 300; // 整份单行且有一定长度
  // 平均行长过长（压缩态）才格式化；正常代码不动
  return code.length / lines > AVG_LINE_LEN_THRESHOLD;
}

/** 格式化代码（html/css/js）。不支持的 language 原样返回。 */
export function formatCode(code: string, language: string): string {
  try {
    if (language === 'html') {
      return htmlBeautify(code, { indent_size: 2, preserve_newlines: false, end_with_newline: true });
    }
    if (language === 'css') {
      return cssBeautify(code, { indent_size: 2 });
    }
    if (language === 'javascript') {
      return jsBeautify(code, { indent_size: 2 });
    }
  } catch {
    // 格式化失败不影响原代码
  }
  return code;
}
