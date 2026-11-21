/**
 * 语音朗读文本清洗与分句 单元测试
 */
import { describe, it, expect } from 'vitest';
import { toSpeakableText, splitIntoSpeakableSentences } from './speechText';

describe('toSpeakableText', () => {
  it('剥掉代码块（代码念出来是灾难）', () => {
    const raw = '好的，这是代码：\n```python\nprint("hello")\n```\n运行看看效果。';
    const out = toSpeakableText(raw);
    expect(out).not.toContain('print');
    expect(out).toContain('运行看看效果');
  });

  it('行内代码保留文字、去掉反引号', () => {
    expect(toSpeakableText('用 `for` 循环')).toBe('用 for 循环');
  });

  it('链接只留链接文字', () => {
    expect(toSpeakableText('看[这个文档](https://x.com)了解')).toBe('看这个文档了解');
  });

  it('去掉 markdown 标记（标题/加粗/列表符号）', () => {
    const out = toSpeakableText('## 第一步\n**重要**：\n- 苹果\n- 香蕉\n1. 先做');
    expect(out).not.toContain('#');
    expect(out).not.toContain('**');
    expect(out).not.toContain('- ');
    expect(out).toContain('第一步');
    expect(out).toContain('苹果');
    expect(out).toContain('先做');
  });

  it('剥掉 question XML', () => {
    const raw = '你想选哪个？<question><title>选题</title><option id="a"><label>机器人</label></option></question>';
    expect(toSpeakableText(raw)).not.toContain('question');
  });

  it('剥掉选项卡机制口播（2026-11-07 用户反馈：语音与卡片 UI 对不上）', () => {
    // 冒号后的卡片播报段 → 换成自然的过渡语
    const a = toSpeakableText('点下面的卡片选一个就行：选项卡已经发出来啦，点一下就能回答，不用打字。');
    expect(a).not.toContain('选项卡已经');
    expect(a).toContain('我们来看第一个问题');
    // "从上往下依次是"式整句枚举 → 整句剥掉（孩子看得见卡片）
    const b = toSpeakableText('三张选项卡都已经发出去了，从上往下依次是：年级卡、主题卡、功能卡。下一个问题。');
    expect(b).not.toContain('从上往下');
    expect(b).toContain('下一个问题');
    // 正常问题句不受影响
    const c = toSpeakableText('你现在在哪个年级？在卡片里选一个就好。');
    expect(c).toContain('在卡片里选一个就好');
  });

  it('去掉 emoji', () => {
    const out = toSpeakableText('太棒了🎉 继续加油🚀');
    expect(out).toBe('太棒了 继续加油');
  });

  it('空内容返回空字符串', () => {
    expect(toSpeakableText('')).toBe('');
    expect(toSpeakableText('```\n```')).toBe('');
  });
});

describe('splitIntoSpeakableSentences', () => {
  it('按句末标点切句（超短开场白向前粘合）', () => {
    const out = splitIntoSpeakableSentences('你好呀！我是小知。想做什么项目呢？');
    expect(out).toEqual(['你好呀！我是小知。', '想做什么项目呢？']);
  });

  it('连续超短句合并避免机械一顿一顿', () => {
    const out = splitIntoSpeakableSentences('好。来。看。这个。');
    // 都是超短句 → 粘合成一条
    expect(out).toEqual(['好。来。看。这个。']);
  });

  it('超长句按逗号二次切分（≤120字）', () => {
    const longSentence = '这是一个特别长的句子，'.repeat(20); // ~220字
    const out = splitIntoSpeakableSentences(longSentence);
    expect(out.length).toBeGreaterThan(1);
    for (const s of out) {
      expect(s.length).toBeLessThanOrEqual(120);
    }
  });

  it('代码块被剥掉后不产出空句', () => {
    const out = splitIntoSpeakableSentences('```html\n<div></div>\n```\n好了！');
    expect(out).toEqual(['好了！']);
  });

  it('纯符号/纯代码内容产出空数组', () => {
    expect(splitIntoSpeakableSentences('```python\nx=1\n```')).toEqual([]);
    expect(splitIntoSpeakableSentences('')).toEqual([]);
  });

  it('换行视为句边界', () => {
    const out = splitIntoSpeakableSentences('第一行的内容\n第二行的内容');
    expect(out).toEqual(['第一行的内容', '第二行的内容']);
  });
});
