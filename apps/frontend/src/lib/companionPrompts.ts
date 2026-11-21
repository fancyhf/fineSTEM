/**
 * 数字人导师「小知」的语音相关常量与开关
 *
 * 产品模型（2026-11-06 晚定调）：小知是聊天界面的化身（首页智能对话区 +
 * Create 聊天框），不是独立悬浮组件。本模块：
 *   1. 开场白（打招呼+教用法）
 *   2. 语音朗读开启时的回复风格提示词（注入 Create 的场景指令）
 *   3. 朗读开关的 sessionStorage 标记（Create 发消息前读取）
 */

export const COMPANION_NAME = '小知';

/** 小知的开场白：先打招呼、教怎么用（2026-11-07 用户要求）。进站首次手势后朗读，每会话一次 */
export const COMPANION_GREETING =
  '嗨，我是小知！点一下我就能直接跟我说话，按住下面的麦克风说话也行，打字也可以。' +
  '我回答的时候会念给你听；屏幕上出现选择题的时候，点卡片选一个就好。';

/** 屏幕气泡用的一行用法提示（不打扰，配合开场白语音） */
export const COMPANION_USAGE_HINT =
  '点我可以直接说话，按住 🎤 也行；选择题点卡片选一个就好～';

/** Create 主聊天在语音朗读开启时追加的风格段（叠加在原场景指令之后） */
export const COMPANION_VOICE_STYLE_INSTRUCTIONS = [
  '【语音朗读模式】学生的回复会由数字人' + COMPANION_NAME + '朗读出来。',
  '请在正常完成任务的前提下：开头一两句先说人话（结论/共情/下一步），',
  '再给必要的结构化内容；避免连续超过 5 行的纯文字段落；',
  '列表每项控制在一行；代码块保持正常（朗读时会被跳过）。',
  '【选项卡朗读纪律（重要）】你发出 ask_question 选项卡时，屏幕上已经能看到卡片了：',
  '朗读只说问题本身（例如"你现在在哪个年级？在卡片里选一个就好"），',
  '严禁描述选项卡的数量/张数/排列顺序（如"三张选项卡从上往下依次是"），',
  '严禁逐条念出全部选项文字——孩子自己看得见，念了反而和屏幕对不上。',
].join('\n');

/** sessionStorage 标记：Create 页据此给主聊天追加语音风格提示词 */
export const VOICE_MODE_STORAGE_KEY = 'finestem_companion_voice_on';

export function setVoiceModeOn(on: boolean): void {
  try {
    sessionStorage.setItem(VOICE_MODE_STORAGE_KEY, on ? '1' : '0');
  } catch { /* 隐身模式等无存储环境 */ }
}

export function isVoiceModeOn(): boolean {
  // 默认开启（语音伴学是本功能核心；用户显式关过才关闭）
  try {
    return sessionStorage.getItem(VOICE_MODE_STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}
