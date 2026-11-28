/**
 * 前端词表与格式化单源（v8.7.0 控制台可用性迭代）。
 *
 * 分工纪律：「有哪些值」由后端 /console/options 透出（platforms ←
 * config.SupportedPlatforms / kinds ← domain.taskkind registry / statuses ←
 * storage.AllTaskStatuses）；本文件只负责展示文案与颜色，不参与判定，不手抄
 * 可选值全集（防漂移）。
 */
import dayjs from 'dayjs'

/** 平台展示名（值域仍以 options.platforms 为准）。 */
export const PLATFORM_LABELS: Record<string, string> = {
  gitea: 'Gitea',
  forgejo: 'Forgejo',
  github: 'GitHub',
  gitlab: 'GitLab',
  gitee: 'Gitee',
  gitcode: 'GitCode',
  tencent_code: '腾讯工蜂',
}

export function platformLabel(p?: string): string {
  if (!p) return '—'
  return PLATFORM_LABELS[p] || p
}

/** 任务类型展示名（canonical 词表名 → 中文）。 */
export const KIND_LABELS: Record<string, string> = {
  requirement_compliance: '需求复核',
  code_review: '代码审查',
  visual_check: '视觉检查',
  describe: 'PR 描述',
  changelog: '变更日志',
  ci_analysis: 'CI 归因',
  diff_preview: 'Diff 预审',
}

export function kindLabel(k?: string): string {
  if (!k) return '—'
  return KIND_LABELS[k] || k
}

/** 任务状态展示名（值域以 options.statuses 为准）。 */
export const TASK_STATUS_LABELS: Record<string, string> = {
  pending: '排队中',
  running: '执行中',
  done: '已完成',
  failed: '失败',
  stale: '已过期',
}

export function statusLabel(s?: string): string {
  if (!s) return '—'
  return TASK_STATUS_LABELS[s] || s
}

/** 严重度选项（与报告/意见治理词表一致）。 */
export const SEVERITY_OPTIONS = [
  { label: '全部级别', value: '' },
  { label: 'critical（严重）', value: 'critical' },
  { label: 'high（高）', value: 'high' },
  { label: 'medium（中）', value: 'medium' },
  { label: 'low（低）', value: 'low' },
]

/** 回复级别地板选项（''=全报）。 */
export const SEVERITY_FLOOR_OPTIONS = [
  { label: '全部级别', value: '' },
  { label: 'low 及以上', value: 'low' },
  { label: 'medium 及以上', value: 'medium' },
  { label: 'high 及以上', value: 'high' },
  { label: '仅 critical', value: 'critical' },
]

/** 严重级文案 + 语义色档（sev-<tone> 徽章，不用 antd 预设名混色系）。 */
export const SEVERITY_LABELS: Record<string, string> = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
  info: '提示',
}

export type SevTone = 'critical' | 'high' | 'medium' | 'low' | 'info'

export const SEVERITY_TONE: Record<string, SevTone> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
  info: 'info',
}

/** 严重级排序（治理列表用）。 */
export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'] as const

/** 裁决文案 + 语义色档。 */
export type VerdictTone = 'success' | 'attention' | 'danger' | 'info'

export const VERDICT_TONE: Record<string, VerdictTone> = {
  approve: 'success',
  comment: 'attention',
  request_changes: 'danger',
}

export const VERDICT_COLOR: Record<string, string> = {
  approve: 'success',
  comment: 'warning',
  request_changes: 'error',
}

export const VERDICT_LABELS: Record<string, string> = {
  approve: '通过',
  comment: '建议修改',
  request_changes: '需修改',
}

/** 数字千分位（指标展示统一走这里）。 */
export function fmtNum(n?: number | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—'
  return n.toLocaleString('en-US')
}

/** 百分比（0-1 或 0-100 自动识别；空值为 —）。 */
export function pct(v?: number | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '—'
  const ratio = v <= 1 ? v : v / 100
  return `${(ratio * 100).toFixed(1)}%`
}

/** 统一时间格式（YYYY-MM-DD HH:mm；兼容 unix 秒与 ISO 字符串）。 */
export function fmtTime(v?: string | number): string {
  if (v === undefined || v === null || v === '') return '—'
  const d = typeof v === 'number' ? dayjs.unix(v) : dayjs(v)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : String(v)
}

/** 相对时间（列表紧凑展示用；超 7 天回落日期）。 */
export function fmtAgo(unix?: number): string {
  if (!unix) return '—'
  const d = dayjs.unix(unix)
  if (!d.isValid()) return '—'
  const diffMin = dayjs().diff(d, 'minute')
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} 小时前`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay <= 7) return `${diffDay} 天前`
  return d.format('MM-DD HH:mm')
}
