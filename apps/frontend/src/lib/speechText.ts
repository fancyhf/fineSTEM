/**
 * 语音朗读文本清洗与分句
 *
 * AI 回复是屏幕阅读导向的 Markdown；数字人朗读前需要剥掉代码块/表格/
 * 符号噪音，并切成适合逐句 TTS 的短句队列（单句一次合成请求，控制计费
 * 粒度 + 降低首句延迟）。
 */

/** 单句最大字符数：超过则按逗号/顿号二次切分（GLM-TTS 单次请求不宜过长） */
const MAX_SENTENCE_CHARS = 120;

/** 剥掉对朗读无意义的内容，返回"说出口"的文本 */
export function toSpeakableText(raw: string): string {
  if (!raw) return '';
  let text = raw;

  // 1. 代码块：整体跳过，代码念出来是灾难
  text = text.replace(/```[\s\S]*?```/g, ' ');
  // 2. 行内代码：保留里面的词，去掉反引号
  text = text.replace(/`([^`]+)`/g, '$1');
  // 3. 图片
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  // 4. 链接：只留链接文字
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  // 5. Markdown 标记：标题井号、加粗斜体星号、表格竖线、引用
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/^\s*\|.*\|\s*$/gm, ' ');  // 整行表格
  text = text.replace(/^>\s?/gm, '');
  text = text.replace(/^\s*[-*+]\s+/gm, '');      // 列表符号（保留列表文字）
  text = text.replace(/^\s*\d+\.\s+/gm, '');      // 有序列表序号
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');    // 分隔线
  // 6. question XML（万一上游没剥干净）
  text = text.replace(/<question[^>]*>[\s\S]*?<\/question>/gi, ' ');
  // 6b. 选项卡机制口播（2026-11-07 用户反馈：她描述"三张选项卡从上往下依次是"
  // 与屏幕上的分步卡片对不上）。提示词是主防线；这里对漏网的 meta 句做安全剥离：
  //    "……点下面的卡片选一个就行：选项卡已经发出来啦，……" → 剥冒号后的卡片播报段
  //    "……三张选项卡都已经发出去了，从上往下依次是：……" → 剥含"从上往下依次"的整句
  text = text.replace(/[：:][^。！？\n]*选项卡已经?发出[^。！？\n]*[。！？]?/g, '，我们来看第一个问题。');
  text = text.replace(/[^。！？\n]*(选项卡|卡片)[^。！？\n]*(从上往下|依次是|都已经发出)[^。！？\n]*[。！？]/g, ' ');
  text = text.replace(/[^。！？\n]*从上往下依次[^。！？\n]*[。！？]/g, ' ');
  // 7. emoji / 颜文字与零宽符号（TTS 念不出来或念怪）
  // 用 Unicode 属性类避免手写区间误伤组合序列（no-misleading-character-class）
  // ZWJ 单独处理：规则不允许它出现在字符类里
  text = text.replace(/\u{200D}/gu, ' ');
  text = text.replace(
    /[\p{Extended_Pictographic}\u{FE0F}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}]/gu,
    ' ',
  );
  // 8. 常见 Markdown 残留符号：反斜杠转义、行内反引号
  text = text.replace(/\\([.`*_[\]()#>-])/g, '$1');
  // 9. 压缩空白
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{2,}/g, '\n');

  return text.trim();
}

/** 把清洗后的文本切成朗读句队列。保证不产出空句。 */
export function splitIntoSpeakableSentences(text: string): string[] {
  const clean = toSpeakableText(text);
  if (!clean) return [];

  // 按中文/英文句末标点切；换行也视为句边界
  const roughParts = clean
    .split(/(?<=[。！？!?；;：:])\s*|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const sentences: string[] = [];
  for (const part of roughParts) {
    if (part.length <= MAX_SENTENCE_CHARS) {
      // 超短句（<6字）向前粘合，避免"好。""来。"每字一顿太机械；
      // 正常长度的句子保持独立，字幕节奏自然、首句音频更快出来
      const prev = sentences[sentences.length - 1];
      if (
        prev &&
        (prev.length < 6 || part.length < 6) &&
        prev.length + part.length <= MAX_SENTENCE_CHARS
      ) {
        sentences[sentences.length - 1] = `${prev}${part}`;
      } else {
        sentences.push(part);
      }
      continue;
    }
    // 超长句：按逗号/顿号/空格二次切
    let buffer = '';
    for (const seg of part.split(/(?<=[，,、])/)) {
      if ((buffer + seg).length > MAX_SENTENCE_CHARS && buffer) {
        sentences.push(buffer.trim());
        buffer = seg;
      } else {
        buffer += seg;
      }
    }
    if (buffer.trim()) sentences.push(buffer.trim());
  }
  return sentences.filter((s) => /[\u4e00-\u9fa5a-zA-Z0-9]/.test(s));
}
