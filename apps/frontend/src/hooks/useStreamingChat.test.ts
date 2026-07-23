/**
 * useStreamingChat 工具函数单元测试（2026-07-22 测试体系重构）
 *
 * 覆盖本次重构修复的核心前端逻辑：
 * - normalizeToolName：剥离 finestem__ 前缀（选项卡不显示的根因）
 * - parseMcpOutput：解析 MCP 双层 JSON（工具返回值丢失的根因）
 *
 * 用 2026-07-22 抓帧得到的真实数据验证。
 */
import { describe, it, expect } from 'vitest';
import { normalizeToolName, parseMcpOutput } from './useStreamingChat';

describe('normalizeToolName', () => {
  it('剥离 finestem__ 前缀', () => {
    expect(normalizeToolName('finestem__ask_question')).toBe('ask_question');
    expect(normalizeToolName('finestem__project_creator')).toBe('project_creator');
    expect(normalizeToolName('finestem__stage_advancer')).toBe('stage_advancer');
    expect(normalizeToolName('finestem__project_code_writer')).toBe('project_code_writer');
  });

  it('已是短名则原样返回', () => {
    expect(normalizeToolName('ask_question')).toBe('ask_question');
    expect(normalizeToolName('code_runner')).toBe('code_runner');
  });

  it('空值/非字符串返回空串', () => {
    expect(normalizeToolName(undefined)).toBe('');
    expect(normalizeToolName(null)).toBe('');
    expect(normalizeToolName(123)).toBe('');
    expect(normalizeToolName('')).toBe('');
  });

  it('其他前缀不剥离（只处理 finestem__）', () => {
    expect(normalizeToolName('other__tool')).toBe('other__tool');
    expect(normalizeToolName('mcp__ask_question')).toBe('mcp__ask_question');
  });

  it('所有 12 个 finestem 工具名都能正确归一化', () => {
    const allTools = [
      'skill_state_reader', 'ask_question', 'skill_state_writer',
      'stage_advancer', 'artifact_reader', 'artifact_writer',
      'evidence_saver', 'code_runner', 'project_code_writer',
      'resource_searcher', 'project_creator', 'achievement_card',
    ];
    for (const name of allTools) {
      expect(normalizeToolName(`finestem__${name}`)).toBe(name);
    }
  });
});

describe('parseMcpOutput', () => {
  // 构造与真实抓帧一致的 MCP 双层 JSON
  function buildRealOutput(innerData: object, isError = false): string {
    return JSON.stringify({
      content: [{ type: 'text', text: JSON.stringify(innerData) }],
      isError,
    });
  }

  it('解析标准 MCP 双层 JSON，提取内层 data', () => {
    const inner = { success: true, data: { title: '你现在是哪个年级？', options: [] } };
    const result = parseMcpOutput(buildRealOutput(inner));
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ title: '你现在是哪个年级？', options: [] });
  });

  it('isError=true 时 success=false', () => {
    const inner = { success: true, data: { x: 1 } };
    const result = parseMcpOutput(buildRealOutput(inner, true));
    expect(result.success).toBe(false);
  });

  it('内层 success=false 时返回 success=false', () => {
    const inner = { success: false, error: '门禁拦截' };
    const result = parseMcpOutput(buildRealOutput(inner));
    expect(result.success).toBe(false);
  });

  it('null 输入返回 success=true, data=null', () => {
    const result = parseMcpOutput(null);
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it('纯文本（非 JSON）原样返回，按 error/failed 判定 success', () => {
    const result = parseMcpOutput('这是一段纯文本输出');
    expect(result.success).toBe(true);
    expect(result.data).toBe('这是一段纯文本输出');
  });

  it('含 error 字样的纯文本判定为失败', () => {
    const result = parseMcpOutput('Execution failed with error');
    expect(result.success).toBe(false);
  });

  it('内层 JSON 缺少 success 字段时，按 isError 判定', () => {
    const inner = { some_field: 'value' };
    const result = parseMcpOutput(buildRealOutput(inner));
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ some_field: 'value' });
  });

  it('内层不是合法 JSON 时返回文本', () => {
    const outer = JSON.stringify({
      content: [{ type: 'text', text: '这不是合法JSON' }],
      isError: false,
    });
    const result = parseMcpOutput(outer);
    expect(result.success).toBe(true);
    expect(result.data).toBe('这不是合法JSON');
  });

  it('直接传对象（非字符串）也能处理', () => {
    const obj = { content: [{ type: 'text', text: JSON.stringify({ success: true, data: { a: 1 } }) }] };
    const result = parseMcpOutput(obj);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ a: 1 });
  });
});
