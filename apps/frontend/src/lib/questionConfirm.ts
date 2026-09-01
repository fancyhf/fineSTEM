/**
 * 问题卡片二次确认辅助（Q-003 彻底修复，2026-07-27）
 *
 * 用途：前端文本兜底解析出候选问题卡片后，调后端 /chat/verify-question 做权威二次判断，
 *      拦截被误识别的功能介绍/状态汇报。仅用于文本兜底路径，ask_question 工具路径不需确认。
 *
 * 降级策略：后端确认失败/超时时降级为"放行"（保守策略，宁可偶发误识别也不漏真问题）。
 *
 * links: apps/frontend/src/lib/questionParser.ts（前端第一防线）
 *        apps/backend/app/services/question_verifier.py（后端权威判断）
 */
import { chatApi, type VerifyQuestionOption } from '../services/api';
import type { QuestionData } from '../components/QuestionCard';

/**
 * 把 QuestionData 转成后端确认接口需要的选项格式。
 */
function toVerifyOptions(q: QuestionData): VerifyQuestionOption[] {
  return (q.options || []).map((o) => ({
    label: o.label || '',
    description: o.description,
  }));
}

/**
 * 对一组候选卡片做后端二次确认，返回通过确认的子集。
 *
 * @param candidates 文本兜底解析出的候选卡片
 * @param timeoutMs 单次确认超时（默认 3000ms）
 * @returns 通过后端确认的卡片（is_real_question=true）；失败/超时降级为原样返回全部
 */
export async function confirmQuestions(
  candidates: QuestionData[],
  timeoutMs = 3000,
): Promise<QuestionData[]> {
  if (!candidates || candidates.length === 0) return [];

  // 并发确认每张卡片
  const results = await Promise.all(
    candidates.map(async (q) => {
      try {
        const res = await chatApi.verifyQuestion(q.title, toVerifyOptions(q));
        const isReal = res.data?.is_real_question;
        // 降级：接口异常或返回结构异常时放行
        if (isReal === undefined || isReal === null) {
          console.warn('[questionConfirm] 后端确认返回异常，降级放行:', q.title, res.data);
          return { q, pass: true };
        }
        if (!isReal) {
          console.info('[questionConfirm] 后端拦截误识别卡片:', q.title, '→', res.data?.reason);
        }
        return { q, pass: !!isReal };
      } catch (e) {
        // 降级：网络错误/超时 → 放行（不漏真问题）
        console.warn('[questionConfirm] 后端确认失败，降级放行:', q.title, e);
        return { q, pass: true };
      }
    }),
  );

  return results.filter((r) => r.pass).map((r) => r.q);
}

/**
 * 便捷封装：确认后只对通过的卡片调用 show 回调。
 *
 * @param candidates 候选卡片
 * @param show 渲染回调（通常是 showPendingQuestions）
 */
export async function confirmAndShow(
  candidates: QuestionData[],
  show: (questions: QuestionData[]) => void,
): Promise<void> {
  const confirmed = await confirmQuestions(candidates);
  if (confirmed.length > 0) {
    show(confirmed);
  }
}
