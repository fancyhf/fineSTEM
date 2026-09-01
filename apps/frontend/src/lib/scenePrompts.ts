/**
 * 场景化系统提示词（2026-07-31 Q-038）
 *
 * 背景：主聊天链路是 WS 直连 ZeroClaw daemon，daemon 只读 config.toml 内嵌的
 * PBL 导向 system_prompt，不感知"问问题/解释代码/写报告"等场景差异。
 * 后端 zeroclaw_provider.SCENE_SYSTEM_PROMPTS 早已定义好差异化提示词，
 * 本模块从 GET /agent/scene-prompts 拉取并缓存，由 useStreamingChat 注入
 * WS 消息文本的 <scene_instructions> 块（daemon 一定会读消息文本）。
 *
 * 降级策略：后端不可达时使用内置精简版兜底，保证场景约束不至于完全丢失。
 */
import { agentApi } from '../services/api';

const CACHE_KEY = 'scene_prompts_cache_v1';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 分钟，提示词很少变

// 内置精简兜底（与后端语义保持一致，仅在接口不可用时启用）
const FALLBACK_PROMPTS: Record<string, string> = {
  问问题:
    '当前场景：问问题（纯问答）。请直接、准确地回答学生的 STEM 问题，用类比和实例帮助理解。' +
    '不要启动 PBL 九步项目流程、不要调用 project_creator 创建项目，除非学生明确表示想动手做项目。',
  解释代码:
    '当前场景：解释代码。请逐段讲解代码逻辑、标注关键语法、指出潜在问题与改进空间。' +
    '不要启动 PBL 九步项目流程、不要创建项目。',
  开始项目:
    '当前场景：开始项目。帮助学生明确项目目标，评估可行性，规划分阶段步骤，鼓励从最小可行版本开始。',
  写报告:
    '当前场景：写报告。帮助学生组织报告结构（引言→方法→结果→讨论→结论），引导用项目证据支撑论点。' +
    '不要创建新项目。',
  // MVP2 P0-05：复制项目任务引导。后端 /agent/scene-prompts 不可达时的降级文本。
  copy_project_guidance:
    '当前场景：复制项目任务引导。学生进入的是从 Demo 复制来的项目。' +
    '按顺序执行：先调用 skill_state_reader 读取 mode/current_stage/teaching_mode/metadata（含 copy_guidance），' +
    '再调用 project_code_reader 读取真实文件，然后根据 metadata.copy_guidance.current_task 判断当前任务，' +
    '一次只给一项任务及其完成条件，并用 ask_question 给出选项卡。学生表示完成时必须调用 copy_guidance_verifier，' +
    '不要凭学生口述判断通过。verifier 通过则用 evidence_saver 保存证据、解释知识点后再询问是否进入下一项；' +
    '未通过只指出 first_issue 并给一层 next_hint。' +
    '任务序列（通用 ID，verifier 按来源 Demo 自动解析）：replace_first_card → add_card_data → modify_interaction → fix_error → explain_changes。' +
    '【验收语义】个性化任务（replace_first_card）的完成标准是"与 Demo 原文不同"，' +
    '学生改成任何自己的内容（包括只加后缀）都算完成，严禁要求必须改成项目名等特定文案；' +
    'claimed_changes 填学生自己说的实际新内容，不要臆造期望值。' +
    '【重要】验证结论（通过/未通过、first_issue 具体内容、next_hint）必须写在回复正文的第一句，' +
    '不得只写在思考过程里——思考过程学生看不到。' +
    '【收官】verifier 返回 all_tasks_completed=true（全部任务完成）时：正文第一句祝贺，' +
    '必须用 ask_question 询问「🚀 推进到展示与反思并生成成果档案卡 / 🤔 先不推进」；' +
    '学生同意后先调 stage_advancer（target_stage=step_3）再调 achievement_card（light step_3 已放行），' +
    '不得跳过询问自动推进；session_status=completed 的项目再次进入时引导收官或自由改造，不重新布置任务。' +
    '不允许一次给出完整答案，不得擅自调用 stage_advancer。' +
    '教学模式按 metadata.teachingMode 生效（guided/demo/hands_on/lecture），复制项目默认偏 hands_on。',
};

// 所有场景通用的输出规则（含语言约束 + 可见性规则）
export const OUTPUT_VISIBILITY_RULE =
  '【输出规则】' +
  '1. 语言：**必须使用中文（简体中文）回答所有问题**。代码注释也用中文写。严禁用英文回复学生，即使代码术语也要用中文解释后再附英文原文。' +
  '2. 可见性：你的思考过程（thinking/reasoning）不会展示给学生，学生只能看到正文。' +
  '对学生问题的完整回答、总结、讲解必须写在正文里，先直接回答问题（至少 2-4 句实质内容），' +
  '再给选项卡（如需要）。严禁把答案只写在思考里、正文只留一句引导语。' +
  '3. 工具结论必须入正文：调用任何工具（验证器、代码读取、阶段推进等）后，工具的关键结论' +
  '（通过/未通过、原因、下一步怎么做）必须写在正文的第一句，不得只写在思考里。' +
  '学生如果在正文里看不到工具执行结果，视为失败回复。' +
  '4. 工具与工件只是副本：evidence_saver、artifact_writer 等保存类工具的输出学生**看不到**。' +
  '讲解、总结、验证结果必须**完整写在回复正文**里，先给学生看全文，再（如需要）另存一份到工具；' +
  '严禁用"已经保存/已沉淀到文档"代替正文讲解——学生要的是正文里的完整内容。';

let memoryCache: Record<string, string> | null = null;
let inflight: Promise<Record<string, string>> | null = null;

function readSessionCache(): Record<string, string> | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: Record<string, string> };
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeSessionCache(data: Record<string, string>) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // sessionStorage 不可用时忽略，仅靠内存缓存
  }
}

/** 拉取（或复用缓存的）全量场景提示词表 */
export async function loadScenePrompts(): Promise<Record<string, string>> {
  if (memoryCache) return memoryCache;
  const cached = readSessionCache();
  if (cached) {
    memoryCache = cached;
    return cached;
  }
  if (!inflight) {
    inflight = agentApi
      .scenePrompts()
      .then((res) => {
        const data = (res as { data?: Record<string, string> })?.data;
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          memoryCache = data;
          writeSessionCache(data);
          return data;
        }
        return FALLBACK_PROMPTS;
      })
      .catch(() => FALLBACK_PROMPTS)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/**
 * 获取指定场景的提示词（未命中返回空串）。
 * scene 取值与 Create 页场景区一致：问问题 / 解释代码 / 开始项目 / 写报告。
 */
export async function getScenePrompt(scene: string | null | undefined): Promise<string> {
  if (!scene) return '';
  const prompts = await loadScenePrompts();
  return prompts[scene] || FALLBACK_PROMPTS[scene] || '';
}

/** 页面加载后预热缓存，避免首条消息多等一个 HTTP 往返 */
export function prefetchScenePrompts(): void {
  void loadScenePrompts();
}
