/**
 * 问题/选项解析器 —— 纯函数模块，不依赖 React，可独立单元测试。
 *
 * 用途：从 AI 回复文本（XML 或 markdown）中解析出结构化的问题卡片（QuestionData[]），
 * 供前端渲染成可点击的选项卡片（QuestionCard）。
 *
 * 设计目标（2026-07-19）：
 *   - 支持多卡：一条 AI 回复里可以有多个问题，每个独立成卡
 *   - 支持多选项：一张卡片上可以有多个 option（2-8 个）
 *   - 支持单选/多选：type="single" 单选，type="multiple"/"multi" 多选
 *   - 主路径解析 <question> XML（AI 显式输出的标准格式）
 *   - fallback 解析 markdown 列表（AI 没用 XML 时的兜底，带严格过滤）
 *
 * 维护者：AI Agent
 * links: apps/frontend/src/hooks/useStreamingChat.ts, apps/frontend/src/pages/Create.tsx
 */

// ===== 类型定义（与 QuestionCard.tsx 保持一致，内联以避免循环依赖）=====

export interface QuestionOption {
  id: string;
  label: string;
  description?: string;
  recommended?: boolean;
  groupId?: string;
  groupTitle?: string;
}

export interface QuestionOptionGroup {
  id: string;
  title: string;
  optionIds: string[];
}

export interface QuestionData {
  id: string;
  title: string;
  subtitle?: string;
  options: QuestionOption[];
  optionGroups?: QuestionOptionGroup[];
  requireEachGroup?: boolean;
  multiple?: boolean;
  allowCustom?: boolean;
  step?: number;
  totalSteps?: number;
  stage?: string;
  isStageFinal?: boolean;
}

// ===== 主路径：解析单个 <question> XML 块 =====

/**
 * 从文本中解析**第一个** `<question>` XML 块。
 * 兼容多种格式变体：
 *   - <question type="single" title="xxx"> + <option id="opt1" label="yyy">desc</option>
 *   - <option label="yyy"> （id 可选）
 *   - <option id="opt1">标签</option> （label 用子标签或正文）
 *   - <question><title>xxx</title>...</question> （title 用子标签）
 */
export function parseQuestionBlock(text: string): QuestionData | null {
  if (!text) return null;

  const match = text.match(/<question[^>]*>([\s\S]*?)<\/question>/i);
  if (!match) return null;
  const raw = match[1].trim();
  if (!raw) return null;

  const tagAttrMatch = text.match(/<question[^>]*title=["']([^"']*)["']/i);
  const titleMatch = raw.match(/<title>([\s\S]*?)<\/title>/i);
  let title = '请选择';
  if (titleMatch) {
    title = titleMatch[1].trim();
  } else if (tagAttrMatch) {
    title = tagAttrMatch[1].trim();
  } else if (!/<option\s/.test(raw.split('\n')[0])) {
    title = raw.split('\n')[0].slice(0, 200);
  }

  const options: QuestionOption[] = [];
  // id 属性可选；label/id 属性顺序不固定；label 也可用子标签 <label>xxx</label>
  const optPattern = /<option\s+([^>]*)>([\s\S]*?)<\/option>/gi;
  let om: RegExpExecArray | null;
  while ((om = optPattern.exec(raw)) !== null) {
    const attrs = om[1] || '';
    const optBody = (om[2] || '').trim();
    const idMatch = attrs.match(/\bid=["']([^"']*)["']/i);
    const labelAttrMatch = attrs.match(/\blabel=["']([^"']*)["']/i);
    const optId = idMatch ? idMatch[1].trim() : '';
    const attrLabel = labelAttrMatch ? labelAttrMatch[1].trim() : null;

    const childLabelMatch = optBody.match(/<label>([\s\S]*?)<\/label>/i);
    const descMatch = optBody.match(/<desc>([\s\S]*?)<\/desc>/i);

    let finalLabel = attrLabel;
    let finalDescription: string | undefined;
    if (descMatch) {
      finalDescription = descMatch[1].trim();
    }
    if (!finalLabel) {
      if (childLabelMatch) {
        finalLabel = childLabelMatch[1].trim();
        // label 来自子标签时，正文里剩余的非标签文本可作为 description
        if (!finalDescription) {
          const remaining = optBody
            .replace(/<label>[\s\S]*?<\/label>/i, '')
            .replace(/<desc>[\s\S]*?<\/desc>/i, '')
            .replace(/<\/?(?:label|desc)[^>]*>/g, '')
            .trim();
          if (remaining) finalDescription = remaining.slice(0, 200);
        }
      } else {
        const cleanBody = optBody.replace(/<\/?(?:label|desc)[^>]*>/g, '').trim();
        finalLabel = cleanBody.split('\n')[0].slice(0, 100);
      }
    } else {
      // label 来自 attrLabel（如 <option label="🎮 打游戏">喜欢电子游戏</option>）
      // 此时正文 optBody 应作为 description（如果没有显式 <desc>）
      if (!finalDescription) {
        const cleanBody = optBody.replace(/<\/?(?:label|desc)[^>]*>/g, '').trim();
        if (cleanBody) finalDescription = cleanBody.slice(0, 200);
      }
    }

    options.push({
      id: optId || `opt-${options.length}`,
      label: finalLabel,
      description: finalDescription,
      recommended: /推荐/.test(optBody) || /recommended/i.test(optBody),
    });
  }

  if (options.length === 0) return null;

  const rawMatch = text.match(/<question[^>]*>[\s\S]*?<\/question>/i);
  const source = rawMatch ? rawMatch[0] : raw;
  const multiple = /multiple|multi/i.test(source) || /多选/.test(source);
  const stepM = source.match(/\bstep\b\s*(?:=|:)\s*["']?(\d+)/i);
  const totalM = source.match(/\b(?:total_steps|totalSteps|total)\b\s*(?:=|:)\s*["']?(\d+)/i);

  const questionData: QuestionData = {
    id: `q-${Date.now()}`,
    title,
    options: options.slice(0, 8),
    multiple,
    allowCustom: true,
    step: stepM ? parseInt(stepM[1], 10) : undefined,
    totalSteps: totalM ? parseInt(totalM[1], 10) : undefined,
  };

  // 过滤掉无意义的通用问句
  const genericTitles = new Set([
    '请选择',
    '接下来你想怎么做？',
    '接下来你想怎么做',
    '你想怎么继续？',
    '你想怎么继续',
  ]);
  const genericOptionLabels = new Set(['继续', '详细说说', '换个方向', '了解更多', '其他']);
  const optLabels = new Set(
    options.map((o) => (o.label || '').trim()).filter(Boolean),
  );
  if (genericTitles.has(title.trim())) return null;
  if (optLabels.size > 0 && [...optLabels].every((l) => genericOptionLabels.has(l))) return null;

  return questionData;
}

/**
 * 从文本中提取**所有** `<question>` 块，返回多卡 QuestionData 数组。
 * 用全局正则 matchAll 遍历每个 <question>...</question>，逐块调用 parseQuestionBlock。
 * 支持一条 AI 回复里输出多个问题（多卡场景）。
 */
export function parseQuestionBlocks(text: string): QuestionData[] {
  if (!text) return [];
  const blocks = [...text.matchAll(/<question[^>]*>[\s\S]*?<\/question>/gi)];
  if (blocks.length === 0) return [];
  const results: QuestionData[] = [];
  for (const blockMatch of blocks) {
    const singleBlockText = blockMatch[0];
    const parsed = parseQuestionBlock(singleBlockText);
    if (parsed) {
      parsed.id = `q-${Date.now()}-${results.length}`;
      results.push(parsed);
    }
  }
  return results;
}

// ===== fallback：保守的 markdown 文本解析 =====

/**
 * 判断某行是否像"状态汇报"（应排除，不视为选项）。
 *
 * 状态汇报的可靠特征（任一命中即视为状态行）：
 *   - 含 stage_xx_yy 这种阶段标识
 *   - 含 current_stage/teaching_mode/project_id/brainstorm 等状态字段名
 *   - 含文件路径（docs/xxx、src/xxx）或代码扩展名（.json/.md/.py）
 *   - 含 ✅❌⚠️ 等状态符号
 *   - 含"已补/已生成/缺失/已完成/未完成/待完成"等状态词
 *   - 键值对格式且**值**部分是状态标识（stage_xx/guided/true/空白等），而非自然语言描述
 *
 * 注意：不能把所有"xxx：yyy"都当状态行，因为正常的选项格式就是"label：description"
 * （如"初中：适合刚接触编程"）。只过滤"值像状态标识"的那种。
 */
export function isStatusLine(line: string): boolean {
  const lower = line.toLowerCase();
  const trimmed = line.trim();
  // 硬特征：阶段标识、状态字段名、文件路径、代码扩展名
  if (/stage_\d+/.test(lower)) return true;
  if (/current_stage|teaching_mode|project_id|brainstorm|artifacts?/.test(lower)) return true;
  if (/\b(?:docs|src|assets|tests|reports|public|app|pages|components|backend|frontend)\//.test(line)) return true;
  if (/\.(json|md|py|ts|tsx|js|html|css)\b/.test(line)) return true;
  // 状态符号
  if (/[\u2705\u274c\u2714\u2718\u274e\u2611\u2612\u26a0\u2757\u2753]/.test(line)) return true;
  // 状态词
  if (/(已补|已生成|缺失|已完成|未完成|待完成)/.test(line)) return true;

  // 新增：常见状态汇报标题（这些通常是信息展示，不是选项）
  if (/^(项目现状|讨论历史|项目信息|当前状态|历史记录|基本信息)$/.test(trimmed)) return true;

  // 新增：包含 UUID/GUID 的行（如项目 ID）通常是状态信息
  if (/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(trimmed)) return true;

  // 键值对：xxx：yyy 格式，且**值**部分是状态标识（短英文/布尔/阶段名），而非自然语言描述
  //   是状态行："当前阶段：stage_01_brainstorm"、"教学模式：guided"、"项目已创建：true"
  //   不是状态行（是选项）："初中：适合刚接触编程的同学"、"网页开发：做网站和工具"
  // 区分方法：值的长度和内容。状态值通常短（≤8 字）且是英文/布尔/阶段名；描述值是自然语言（更长）
  const kvMatch = trimmed.match(/^([^：:]{2,12})[：:]\s*(.+)$/);
  if (kvMatch) {
    const value = kvMatch[2].trim();
    const key = kvMatch[1].trim();
    // 问句结尾的不是状态行
    if (/[？?]$/.test(value)) return false;
    // 值是状态标识：短（≤8 字）且是英文/数字/布尔/下划线
    if (value.length <= 8 && /^[a-z_0-9]+$/i.test(value)) return true;
    if (/^(true|false|none|null|空|空白|enabled|disabled)$/i.test(value)) return true;
    // key 本身是状态字段名（中文常见状态词）
    if (/^(当前阶段|教学模式|项目名|项目名称|工件状态|阶段状态|brainstorm|文档)$/.test(key)) return true;

    // 新增：key 是常见的状态汇报标题
    if (/^(项目现状|讨论历史|项目信息|当前状态|历史记录|基本信息|创建时间|修改时间)$/.test(key)) return true;
  }
  return false;
}

/**
 * 保守的 markdown 文本 fallback：从 AI 自由文本里识别"选择题"。
 *
 * 识别规则（同时满足才视为有效选项块）：
 *   1. 连续 2-6 行列表项（- xxx / * xxx / 1. xxx 等）
 *   2. label 较短（≤ 20 字，是"选项"而非"段落"）
 *   3. 不是状态汇报
 *   4. 不是对话式多问（编号项是问句 + 带子列表）
 *
 * 多卡支持：文本里有多个独立"标题 + 选项块"组合时，每个组合解析成一张卡片。
 */

/**
 * 智能分隔 option 的 label 与 description。
 *
 * 支持多种分隔符（按优先级匹配第一个出现的）：
 *   - 中文冒号 ：
 *   - 英文冒号 :（带空格，避免匹配时间/URL）
 *   - 破折号（em-dash — 或 en-dash –）
 *   - hyphen 带空格（前后都有空格，避免匹配复合词如 Web-App）
 *
 * 设计原则：不 hardcode 单一分隔符。AI 输出千变万化，可能用任何分隔符，
 * 这里用"第一个出现的分隔符"作为切点，前面是 label（通常短），后面是 description（说明）。
 *
 * 注意：括号（中文（）/英文()）**不作为分隔符**——括号在中文里常用于 label 内的补充说明
 * （如"初中（7-9 年级）"整个是 label），如果用括号分隔会把这些误切。
 *
 * 如果没有分隔符，整句作为 label（调用方负责处理长 label 截断）。
 */
function splitLabelAndDescription(body: string): { label: string; description?: string } {
  const text = body.trim();
  if (!text) return { label: '' };

  // 按优先级尝试各种分隔符。每个分隔符用独立正则，匹配第一个出现位置。
  const separators: Array<{ name: string; regex: RegExp }> = [
    // 中文冒号（最常见，label：description）
    { name: 'cn-colon', regex: /^(.+?)[\uFF1A](.+)$/u },
    // 英文冒号（要求冒号前不是纯数字避免匹配时间 12:30；后面要有空格或直接内容）
    { name: 'en-colon', regex: /^(.+?)(?<!\d):(?:\s+(.+)|(.+))$/u },
    // em-dash 破折号（中文长破折号 — U+2014 或 en-dash – U+2013）
    { name: 'emdash', regex: /^(.+?)\s*[\u2014\u2013]\s*(.+)$/u },
    // hyphen 带空格（- 前后都有空格，避免匹配复合词如 Web-App）
    { name: 'hyphen', regex: /^(.+?)\s+-\s+(.+)$/u },
  ];

  for (const sep of separators) {
    const m = text.match(sep.regex);
    if (m) {
      // en-colon 正则有两个捕获组（带空格/不带空格），取非 undefined 的那个
      const label = (m[1] || '').trim();
      const description = (m[2] || m[3] || '').trim();
      // label 不能太空（<2 字可能是误匹配），description 要有内容
      if (label.length >= 2 && description.length >= 2) {
        return { label, description: description || undefined };
      }
    }
  }

  // 无分隔符：整句作为 label
  return { label: text };
}

export function extractQuestionsFromMarkdown(text: string): QuestionData[] {
  const lines = text.split('\n').map((line) => line.replace(/\r/g, ''));
  // 列表项正则：- xxx / * xxx / • xxx / 1. xxx / 1) xxx / 1、xxx / ① xxx / 1️⃣ xxx
  const optionPattern = /^\s*(?:[-*•]\s+|(?:\d{1,2}|[A-Za-z]|[一二三四五六七八九十]+)[.)、]\s+|(?:[0-9]\uFE0F?\u20E3|[①②③④⑤⑥⑦⑧⑨⑩])\s*)(.+?)\s*$/u;
  const numberedItemPattern = /^\s*(?:\d{1,2}|[A-Za-z]|[一二三四五六七八九十]+)[.)、]\s+(.+?)\s*$/u;

  // 找所有连续的列表块（≥2 项才算）
  const blocks: Array<{ start: number; end: number; items: string[] }> = [];
  let curStart = -1;
  let curItems: string[] = [];
  lines.forEach((line, index) => {
    const m = line.match(optionPattern);
    if (m) {
      if (curStart < 0) curStart = index;
      curItems.push(m[1].trim());
    } else {
      if (curStart >= 0 && curItems.length >= 2) {
        blocks.push({ start: curStart, end: index, items: [...curItems] });
      }
      curStart = -1;
      curItems = [];
    }
  });
  if (curStart >= 0 && curItems.length >= 2) {
    blocks.push({ start: curStart, end: lines.length, items: [...curItems] });
  }

  // 注意：blocks 为空时不直接 return，继续到下方的表格解析（2026-07-22 修复）
  // 原因：AI 用 markdown 表格（|...|...|）表达选项时，列表解析找不到任何列表项，
  // 但表格解析能处理。如果在这里 return，表格解析代码永远到不了。

  // 过滤无效块
  const validBlocks = blocks.filter((block) => {
    const items = block.items;
    if (items.length > 6) return false; // 太多选项不像单选题
    // 状态汇报块（≥50% 行是状态行）排除
    const statusCount = items.filter((body) => isStatusLine(body)).length;
    if (items.length > 0 && statusCount / items.length >= 0.5) return false;
    // 对话式多问识别（关键场景）：
    //   形态：1. 问句？\n   - 选项A\n   - 选项B\n2. 问句？\n   - 选项C ...
    //   这种结构里，编号项本身是"问句"（含 ?/？），明显是连续问多个问题，不是单选题。
    //   判定：编号项 ≥ 2 个，且这些编号项里 ≥ 2 个是问句（含 ?/？） → 排除
    // 注意：必须识别出"哪些是编号项"——items 里的元素是去掉前缀的 body，
    //   需要用 lines 重新判断哪些行是编号项。
    const blockLines = lines.slice(block.start, block.end);
    const numberedQuestionLines = blockLines.filter((line) => {
      const m = line.match(numberedItemPattern);
      if (!m) return false;
      return /[？?]/.test(m[1]); // 编号项的 body 含问号
    });
    if (numberedQuestionLines.length >= 2) {
      // 编号问句 ≥ 2 个 → 对话式多问，排除
      return false;
    }
    // 备用判定：编号项多 + 平均长度长 + 含问句 → 排除
    const blockNumbered = items.filter((body) => /^\d/.test(body));
    const questionCount = items.filter((body) => /[？?]/.test(body)).length;
    const avgLen = items.reduce((s, b) => s + b.length, 0) / items.length;
    if (blockNumbered.length >= 2 && avgLen > 15 && items.length > 0 && questionCount / items.length >= 0.3) return false;
    // 对话式多问的子列表展开 → 排除
    // 场景：编号问句下方有缩进的项目符号子列表（如 "1. 你多大？\n   - 选项A\n   - 选项B"）
    // 这种子列表不是独立的单选题，而是编号问题的展开说明。
    // 检查：从 block.start 往上跳过空行，如果遇到编号问句（含 ?/？ 或 ：），则排除。
    for (let i = block.start - 1; i >= Math.max(0, block.start - 4); i -= 1) {
      const above = lines[i].trim();
      if (!above) continue; // 空行：继续往上找
      // 遇到编号项（1. xxx / 1) xxx / 1、xxx），且是问句或带冒号 → 这是对话式多问的子列表
      if (numberedItemPattern.test(above) && /[？?：:]/.test(above)) return false;
      // 遇到其他非空内容（如引导段落），停止往上找
      break;
    }
    return true;
  });

  // 注意：validBlocks 为空时不直接 return，继续到下方的表格解析（2026-07-22 修复）
  let questions: QuestionData[] = [];
  for (const block of validBlocks) {
    let title = '';
    for (let i = block.start - 1; i >= 0; i -= 1) {
      const candidate = lines[i].trim();
      if (!candidate) continue;
      if (optionPattern.test(candidate)) continue;
      if (/^\s*-{3,}\s*$/.test(candidate)) continue;
      if (isStatusLine(candidate)) continue;
      title = candidate.replace(/^[#\s]+/, '').replace(/[：:]\s*$/, '').trim();
      break;
    }
    if (!title) continue;

    // Q-003 修复：标题必须是疑问句（统一校验），拒绝功能介绍/列举引导句
    if (!isLikelyQuestionTitle(title)) continue;

    const options: QuestionOption[] = block.items.slice(0, 8).map((body, idx): QuestionOption | null => {
      // 智能分隔 label 与 description：支持多种分隔符，不 hardcode 单一字符。
      // 优先级：中文冒号 > 英文冒号 > 破折号(—/— 带空格) > 括号开始(（/()
      // 统一用正则匹配第一个出现的分隔符，前面是 label，后面是 description。
      const { label: rawLabel, description } = splitLabelAndDescription(body);
      let label = rawLabel.replace(/^[*_`\s]+|[*_`\s]+$/g, '').trim();
      // label 为空直接跳过；label 是状态行也跳过
      if (!label || isStatusLine(label)) return null;
      // 长 label 处理：截断到 20 字（保留前半），并把整句作为 description（如果还没有 description）
      let finalDescription = description;
      if (label.length > 20) {
        if (!finalDescription) finalDescription = body.trim();
        label = label.slice(0, 20);
      }
      return {
        id: `opt-${idx + 1}`,
        label,
        description: finalDescription ? finalDescription.slice(0, 200) : undefined,
      };
    }).filter((o): o is QuestionOption => o !== null);

    if (options.length < 2) continue;

    // Q-003 修复：功能描述清单拦截（番茄钟 case）
    if (isFunctionDescriptionList(options)) continue;

    questions.push({
      id: `q-fallback-${Date.now()}-${questions.length}`,
      title: title.slice(0, 120),
      options,
      multiple: false,
      allowCustom: true,
    });
  }

  // 多卡过滤：当列表解析产生 >1 张卡片时，可能把说明性列表误判为选择题。
  // 策略：如果有多张卡片，优先保留标题含选择意图词的（选/哪个/哪种/想要/请选择/来做/方式），
  //       过滤掉纯说明性列表（如"核心要素：1.标题 2.概述 3.标准"）。
  //       如果没有含选择意图词的，保留全部（向后兼容，不丢卡片）。
  if (questions.length > 1) {
    const intentPattern = /选|哪个|哪种|想要|请选择|来做|方式|你[想要喜欢]|感兴趣|pick|choose/i;
    const intentCards = questions.filter((q) => intentPattern.test(q.title));
    if (intentCards.length > 0) {
      questions = intentCards;
    }
  }

  // ===== markdown 表格解析（2026-07-22 新增）=====
  // 场景：AI 用 `| 方向 | 做什么 |` 表格表达选项，但不调用 ask_question 工具。
  // 表格结构：第一行是表头，第二行是 |---|---| 分隔，后续行是选项。
  // 策略：第一列作为 label，第二列作为 description。至少 2 个选项行才算。
  if (questions.length === 0) {
    const tableBlocks = extractTables(lines);
    for (const table of tableBlocks) {
      if (table.rows.length < 2 || table.rows.length > 8) continue;
      // 标题：从表格上方找引导句
      let title = '';
      for (let i = table.startLine - 1; i >= 0; i -= 1) {
        const candidate = lines[i].trim();
        if (!candidate) continue;
        if (optionPattern.test(candidate)) continue;
        if (/^\s*-{3,}\s*$/.test(candidate)) continue;
        if (isStatusLine(candidate)) continue;
        title = candidate.replace(/^[#\s]+/, '').replace(/[：:]\s*$/, '').trim();
        break;
      }
      if (!title) continue;
      const options: QuestionOption[] = table.rows.map((row, idx) => {
        const label = (row[0] || '').replace(/^[*_`\s]+|[*_`\s]+$/g, '').trim().slice(0, 20);
        const description = row[1] ? row[1].trim().slice(0, 200) : undefined;
        return { id: `opt-${idx + 1}`, label, description };
      }).filter((o) => o.label && !isStatusLine(o.label));
      if (options.length < 2) continue;
      questions.push({
        id: `q-table-${Date.now()}-${questions.length}`,
        title: title.slice(0, 120),
        options,
        multiple: false,
        allowCustom: true,
      });
    }
  }

  return questions;
}

/** 从 markdown 行中提取表格块（含表头行、分隔行、数据行）。 */
function extractTables(lines: string[]): Array<{
  startLine: number;
  headers: string[];
  rows: string[][];
}> {
  const tables: Array<{ startLine: number; headers: string[]; rows: string[][] }> = [];
  let i = 0;
  while (i < lines.length - 1) {
    const line = lines[i].trim();
    const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
    // 表格起始：当前行有 ≥2 个 | 分隔的单元格，下一行是 |---|---| 分隔行
    if (line.includes('|') && /^\|?[\s-:|]+\|[\s-:|]*$/.test(nextLine) && nextLine.includes('-')) {
      const headers = line.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length) {
        const rowLine = lines[j].trim();
        if (!rowLine.includes('|')) break;
        const cells = rowLine.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
        if (cells.length < 1) break;
        rows.push(cells);
        j += 1;
      }
      if (rows.length > 0) {
        tables.push({ startLine: i, headers, rows });
      }
      i = j;
    } else {
      i += 1;
    }
  }
  return tables;
}

// ===== 精确选项列表兜底（2026-07-23 Q-011）=====
//
// 背景：DeepSeek 模型约 10-15% 的轮次会在文字里列选项但不调 ask_question 工具。
// 之前的 markdown fallback（extractQuestionsFromMarkdown）太宽松，把总结/状态汇报
// 的编号列表也解析成了卡片（Q-003），所以被关闭。
//
// 这个函数是"极严格"的兜底：只在以下条件全部满足时才提取选项卡：
// 1. 上方紧邻的一句话含选择意图词（?/？/选/哪个/哪种/比如/想要/感兴趣/挑一个/选一个）
// 2. 列表项是短词（≤15 字，去掉 emoji/标点后）
// 3. 列表项不以句号结尾（句号 = 完整句子 = 不是选项）
// 4. 列表项不以 emoji ✅❌⏳ 开头（这些是状态标记，不是选项）
// 5. 列表至少 2 项，至多 8 项

/**
 * 选择意图词——列表上方紧邻行必须匹配才认为是选择题。
 * 极严格：只匹配明确的提问/选择场景，不匹配总结确认句。
 * - 问号（最可靠）
 * - "选一个/选几个/挑一个"（明确选择动词+量词）
 * - "想要/感兴趣"（意愿表达）
 * - "比如"（举例引导）
 * - 编码/教学场景关键词："编码方式/教学模式/学习方式/哪种方式/哪种模式/怎么学/如何学"
 * 注意：去掉了"哪些/哪个/你是/你在"——这些在总结确认句中太常见（如"你刚才说是哪3个？"）
 */
const CHOICE_INTENT_PATTERN = /[?？]|\b选\s*[一个几]|挑\s*[一个]|想要|感兴趣|比如|来选|选吧|你最想|编码方式|教学模式|学习方式|哪种方式|哪种模式|怎么学|如何学|选.*方式|选.*模式/;

/** 状态标记——以这些开头的列表项不是选项（只排除明确的勾叉标记，不排除装饰性 emoji） */
const STATUS_MARK = /^[✅❌✓✔☑×✗⚪⚫]/;

// ===== Q-003 彻底修复（2026-07-27）：前端第一防线 =====
// 根因：原 CHOICE_INTENT_PATTERN 用裸 [?？] 万能触发，AI 介绍性段落（如"你想做番茄钟吗？...包含：
//   - 25分钟倒计时 - 待办任务增删改查"）上方任何问号都放行，导致功能介绍被误识别成选项卡。
// 修复策略：把"标题是否是疑问句"和"标题是否是列举引导句"拆成两个独立判断，
//   并新增"选项是否是功能描述"启发式。两个 fallback 共用这套统一判断。

/**
 * 疑问句标题模式——标题必须像"在提问"，而不仅仅是"含问号"。
 *
 * 设计原则（区别于旧的 CHOICE_INTENT_PATTERN）：
 *   - 不再用裸 [?？]：问号必须出现在疑问句结构里（吗？/呢？/选...？/哪种...？/要不要...？/想不想...？），
 *     避免"你想做番茄钟吗？好的！这个应用包含：..."这种陈述+列举句被放行。
 *   - 保留明确选择动词+量词（选一个/挑一个/选哪种），这些不带问号也是提问。
 *   - 保留编码/教学场景关键词（Q-012 修复，不能退化）。
 */
const QUESTION_TITLE_PATTERN = /(?:吗|呢|啊|呀)\s*[?？]?$|选\s*[一几个]|挑\s*[一几个]|哪种|哪个|想要.*[?？]|要不要|想不想|选.*[?？]|做什么|喜欢什么|想做.{0,4}什么|做哪[类种个]|想选|比如|来选|选吧|编码方式|教学模式|学习方式|哪种方式|哪种模式|怎么学|如何学|选.*方式|选.*模式|风格|主题|样式|色调|配色|版式|想要什么|想用.{0,4}什么/;

/**
 * 列举引导词黑名单——标题含这些词时，几乎一定是"功能/特性介绍"，不是提问。
 *
 * 来源：番茄钟 case 实测 + AI 常见介绍性表达。
 * 即使标题同时含问号（如"...包含哪些？"），只要含列举词也拒绝——
 * 因为下方列表几乎一定是"功能清单"而非"可选项"。
 *
 * 2026-07-28 修正：移除"具备/特点/特性"——这些词在正常提问里太常见
 * （如"你想让它具备什么功能"、"它有什么特点"），误伤真问题。
 * 只保留明确的"列举+引导"组合词（包含/功能如下/分为/涵盖等）。
 */
const LISTING_INTENT_PATTERN = /包含|包括|主要有|功能如下|功能有|功能包含|组成为|结构如下|清单如下|内容如下|如下|分为|涵盖/;

/**
 * 功能描述动作词——选项含这些词时，更像是"功能特性描述"而非"可选项"。
 *
 * 来源：番茄钟 case（倒计时/增删改查/统计/合成音效）+ 常见技术功能动词。
 */
const FUNCTION_DESCRIPTION_WORDS = /倒计时|增删改查|增删改|统计|提醒|布局|持久化|合成|渲染|计时|管理|通知|存储|自动.*生成|实时|响应式|可视化|交互式|可视化图表/;

/**
 * 判断标题是否"像一个提问"（统一校验，两个 fallback 共用）。
 *
 * 规则：
 *   1. 必须匹配 QUESTION_TITLE_PATTERN（是疑问句 / 含选择动词 / 编码教学场景）
 *   2. 不能匹配 LISTING_INTENT_PATTERN（含列举引导词 = 功能介绍）
 *
 * @param titleLine 列表上方的标题行（原始，含可能的 # 前缀和冒号）
 * @returns true 表示可能是提问，false 表示几乎不是提问
 */
export function isLikelyQuestionTitle(titleLine: string): boolean {
  if (!titleLine) return false;
  const text = titleLine.trim();
  // 列举引导词黑名单优先：含这些词直接拒绝（即使同时含问号）
  if (LISTING_INTENT_PATTERN.test(text)) return false;
  // 必须像疑问句
  return QUESTION_TITLE_PATTERN.test(text);
}

/**
 * 判断一组选项是否"更像功能描述清单"而非"可选项"。
 *
 * 启发式：若 ≥50% 选项含技术功能动作词（倒计时/增删改查/统计...），
 * 几乎一定是项目功能介绍（如番茄钟的功能列表），拒绝。
 *
 * @param options 已解析的选项数组
 * @returns true 表示更像功能描述（应拒绝），false 表示可能是选项
 */
export function isFunctionDescriptionList(options: Array<{ label: string; description?: string }>): boolean {
  if (!options || options.length === 0) return false;
  const hitCount = options.filter((o) => {
    const text = `${o.label || ''} ${o.description || ''}`;
    return FUNCTION_DESCRIPTION_WORDS.test(text);
  }).length;
  return hitCount / options.length >= 0.5;
}

/**
 * 极严格的选项列表提取。
 * 只提取"上方有选择意图标题 + 下方是短词选项列表"的场景。
 * 总结/状态汇报/步骤说明不会被误提取。
 *
 * @returns QuestionData[] 如果匹配则返回卡片数组，否则返回空数组
 */
export function extractChoiceListStrict(text: string): QuestionData[] {
  if (!text || text.length < 20) return [];

  const lines = text.split('\n').map((l) => l.replace(/\r/g, ''));
  const questions: QuestionData[] = [];

  // 列表项正则：- xxx / * xxx / • xxx / 1. xxx（只匹配这些前缀）
  const listItemPattern = /^\s*(?:[-*•]\s+|(?:\d{1,2})[.)]\s+)(.+?)\s*$/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // 找列表起始：当前行是列表项
    if (!listItemPattern.test(line)) {
      i += 1;
      continue;
    }

    // 收集连续列表项
    const items: Array<{ text: string; lineIdx: number }> = [];
    let j = i;
    while (j < lines.length) {
      const m = lines[j].match(listItemPattern);
      if (m) {
        items.push({ text: m[1].trim(), lineIdx: j });
        j += 1;
      } else {
        break;
      }
    }

    // 条件 5：列表 2-8 项
    if (items.length < 2 || items.length > 8) {
      i = j;
      continue;
    }

    // 条件 1：上方紧邻行必须含选择意图词
    // 往上找第一个非空、非列表项、非分隔线的行
    let titleLine = '';
    for (let k = i - 1; k >= 0; k -= 1) {
      const candidate = lines[k].trim();
      if (!candidate) continue;
      if (listItemPattern.test(candidate)) continue;
      if (/^[-=]{3,}$/.test(candidate)) continue; // 分隔线
      titleLine = candidate;
      break;
    }
    if (!titleLine || !isLikelyQuestionTitle(titleLine)) {
      i = j;
      continue;
    }

    // 过滤列表项
    const validOptions: QuestionOption[] = [];
    for (const item of items) {
      const raw = item.text;
      // 条件 4：不以状态标记开头
      if (STATUS_MARK.test(raw)) continue;
      // 条件 3：不以句号结尾
      if (/[。.！!]$/.test(raw.trim())) continue;

      // 分离 label 和 description
      // 先尝试中文括号（label（description）格式），再用通用分隔符
      let label = '';
      let description: string | undefined;
      const cnParenMatch = raw.match(/^(.+?)[（(](.+)[)）]$/);
      if (cnParenMatch && cnParenMatch[1].trim().length >= 2) {
        label = cnParenMatch[1].trim();
        description = cnParenMatch[2].trim();
      } else {
        const split = splitLabelAndDescription(raw);
        label = split.label;
        description = split.description;
      }
      label = label.replace(/^[*_`\s]+|[*_`\s]+$/g, '').trim();

      // 条件 2：label 短词（≤15 字，含 emoji 计 1 字）
      // 去掉 emoji 后计算纯文字长度
      const textOnly = label.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '').trim();
      if (textOnly.length > 15) continue; // 太长 = 不是选项

      if (!label) continue;
      validOptions.push({
        id: `opt-${validOptions.length + 1}`,
        label,
        description: description ? description.slice(0, 200) : undefined,
      });
    }

    // 有效选项至少 2 个才生成卡片
    if (validOptions.length < 2) {
      i = j;
      continue;
    }

    // Q-003 修复：功能描述清单拦截（番茄钟 case）
    // 若 ≥50% 选项含技术动作词（倒计时/增删改查/统计...），判定为功能介绍，拒绝
    if (isFunctionDescriptionList(validOptions)) {
      i = j;
      continue;
    }

    // 提取标题（去掉尾部冒号/问号）
    const title = titleLine
      .replace(/^[#\s]+/, '')
      .replace(/[：:]\s*$/, '')
      .replace(/（可以多选）|（多选）/g, '（可多选）')
      .slice(0, 120);

    questions.push({
      id: `q-strict-${Date.now()}-${questions.length}`,
      title,
      options: validOptions,
      multiple: /多选|可以多选/.test(titleLine),
      allowCustom: true,
    });

    i = j;
  }

  return questions;
}

// ===== 主入口：两段式解析 =====

/**
 * 从 AI 回复文本中解析问题/选项，返回多卡 QuestionData 数组。
 *
 * 策略：
 *   1. 主路径：解析所有 <question> XML（最准确，支持多卡/多选项/单选多选）
 *   2. fallback：若无 XML，用保守的 markdown 文本解析（带严格过滤）
 *
 * 保留 fallback 的原因：LLM 不保证 100% 输出 XML，实际经常用 markdown 列表问选择题。
 * 废弃 fallback 会导致"AI 问了选项但没按钮可点"，比偶尔误判更糟。
 */
export function parseQuestionsFromText(text: string): QuestionData[] {
  if (!text) return [];

  // 主路径：XML
  const xmlQuestions = parseQuestionBlocks(text);
  if (xmlQuestions.length > 0) {
    return xmlQuestions;
  }

  // fallback：markdown
  return extractQuestionsFromMarkdown(text);
}

// ===== 工具调用路径：把 ask_question 工具的 args 转成 QuestionData =====

/**
 * ask_question 工具调用参数的结构（AI 通过工具调用表达的结构化提问）。
 */
export interface AskQuestionArgs {
  title?: string;
  multiple?: boolean;
  step?: number;
  total_steps?: number;
  options?: Array<{
    id?: string;
    label?: string;
    description?: string;
  }>;
}

/**
 * 把 ask_question 工具调用的 args 转成 QuestionData。
 *
 * 这是"工具调用路径"的核心：AI 调用 ask_question 工具时，参数就是结构化 JSON，
 * 不需要任何文本解析。AI 的意图（单选/多选、几个选项、问什么）直接体现在参数里。
 *
 * 校验：title 必填、options 至少 2 个。不满足返回 null。
 * 容错：option 缺 id 时自动生成 opt-1/opt-2；缺 label 时用"选项N"兜底。
 */
export function toolCallToQuestion(args: unknown, idHint?: number): QuestionData | null {
  if (!args || typeof args !== 'object') return null;
  const a = args as AskQuestionArgs;
  const title = (a.title || '').trim();
  if (!title) return null;
  const rawOptions = Array.isArray(a.options) ? a.options : [];
  if (rawOptions.length < 2) return null;

  const options: QuestionOption[] = rawOptions.slice(0, 8).map((opt, idx) => ({
    id: (opt.id || `opt-${idx + 1}`).toString(),
    label: (opt.label || `选项${idx + 1}`).trim(),
    description: opt.description?.trim() || undefined,
  }));

  return {
    id: `q-tool-${Date.now()}-${idHint ?? 0}`,
    title,
    options,
    multiple: a.multiple === true,
    allowCustom: true,
    step: typeof a.step === 'number' ? a.step : undefined,
    totalSteps: typeof a.total_steps === 'number' ? a.total_steps : undefined,
  };
}
