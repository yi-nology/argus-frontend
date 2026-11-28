import type { RepoSettingsValues } from '../../api/client'

/**
 * 仓库设置表单态与预设（多卡片共用）。
 * FormState 与服务端 RepoSettingsValues 的映射收口在 toFormState / buildPayload。
 */

export interface FormState {
  throttle: number
  cap: number
  floor: string
  ocrEnabled: boolean
  monthlyBudget?: number
  taskBudget?: number
  maxDiffChars?: number
  reportTemplate: string
}

export const DEFAULTS: FormState = {
  throttle: 0,
  cap: 0,
  floor: '',
  ocrEnabled: true,
  reportTemplate: '',
}

/** 服务端值集 → 表单态。 */
export function toFormState(v: RepoSettingsValues): FormState {
  return {
    throttle: v.comment_throttle_minutes ?? 0,
    cap: v.findings_cap ?? 0,
    floor: v.severity_floor ?? '',
    ocrEnabled: v.ocr_delegate_enabled ?? true,
    monthlyBudget: v.monthly_token_budget,
    taskBudget: v.task_token_budget,
    maxDiffChars: v.max_diff_chars,
    reportTemplate: v.report_template ?? '',
  }
}

/** 一键预设：把三个回复旋钮组合成场景，降低「每个数字填多少」的理解成本。 */
export const PRESETS: { label: string; desc: string; values: Partial<FormState> }[] = [
  {
    label: '少打扰',
    desc: '4 小时节流 · 每 MR top5 · medium 及以上',
    values: { throttle: 240, cap: 5, floor: 'medium' },
  },
  {
    label: '标准',
    desc: '1 小时节流 · 每 MR top10 · low 及以上',
    values: { throttle: 60, cap: 10, floor: 'low' },
  },
  {
    label: '全量',
    desc: '不节流 · 不封顶 · 报告全部级别',
    values: { throttle: 0, cap: 0, floor: '' },
  },
]

export const REPORT_TEMPLATES = [
  { label: '跟随部署默认', value: '' },
  { label: 'standard（标准审查报告）', value: 'standard' },
  { label: 'analyst（分析师综合段）', value: 'analyst' },
  { label: 'minimal（极简）', value: 'minimal' },
]

/** 预算常用值预设（v8.8.0）：下拉一键填数，InputNumber 仍保留自由输入。 */
export const TOKEN_BUDGET_PRESETS = [
  { label: '跟随全局', value: 0 },
  { label: '10 万', value: 100_000 },
  { label: '50 万', value: 500_000 },
  { label: '100 万', value: 1_000_000 },
  { label: '500 万', value: 5_000_000 },
]

export const DIFF_CAP_PRESETS = [
  { label: '跟随全局', value: 0 },
  { label: '20 万字符', value: 200_000 },
  { label: '50 万字符', value: 500_000 },
  { label: '100 万字符', value: 1_000_000 },
]

/** 把旋钮翻译成人话（实时预览条）。 */
export function previewText(s: FormState): string {
  const parts: string[] = []
  if (s.cap > 0) parts.push(`每个 MR 最多 ${s.cap} 条意见（按严重度取 top ${s.cap}）`)
  else parts.push('意见数量不封顶')
  if (s.floor) parts.push(`只报告 ${s.floor} 及以上级别，更低级别静默（报告保留计数）`)
  else parts.push('报告全部级别')
  if (s.throttle > 0) parts.push(`同一 MR ${s.throttle} 分钟内不重复回帖（报告仍生成落库）`)
  else parts.push('回帖不节流')
  if (!s.ocrEnabled) parts.push('OCR 预检本仓关闭')
  return parts.join('；') + '。'
}
