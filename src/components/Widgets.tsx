/**
 * 共享展示原语。设计纪律：
 * - 严重级 / 裁决 / 状态一律「带文字的徽章」，不用色点或纯色暗示；
 * - 指标卡靠排版（字号标尺 + tabular-nums）表达层级，不用图标色块；
 * - 颜色只走 tokens 的 CSS 变量，不接受裸色值 props。
 */
import type { ReactNode } from 'react'
import { Button, Empty, Typography } from 'antd'
import { t } from '../theme/tokens'
import {
  SEVERITY_LABELS,
  SEVERITY_TONE,
  VERDICT_LABELS,
  VERDICT_TONE,
  statusLabel,
} from '../constants/vocab'

export type Tone = 'default' | 'success' | 'attention' | 'danger' | 'accent'

/** 指标卡：标签 + 数值 + 可选单位/补充说明。无装饰。 */
export function StatCard({
  label,
  value,
  suffix,
  hint,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  suffix?: string
  hint?: string
  tone?: Tone
}) {
  const toneColor =
    tone === 'success'
      ? t.color.success
      : tone === 'attention'
        ? t.color.attention
        : tone === 'danger'
          ? t.color.danger
          : tone === 'accent'
            ? t.color.accent
            : t.color.text
  return (
    <div
      className="panel"
      style={{
        height: '100%',
        padding: `${t.space.lg}px ${t.space.xl}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: t.space.sm,
      }}
    >
      <div className="meta-sm t-medium">{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: t.space.xs }}>
        <span
          className="num"
          style={{
            fontSize: t.font.xxl,
            fontWeight: t.weight.semibold,
            color: toneColor,
            lineHeight: 1.2,
          }}
        >
          {value}
        </span>
        {suffix && <span className="meta-sm">{suffix}</span>}
      </div>
      {hint && <div className="meta-sm">{hint}</div>}
    </div>
  )
}

/** 状态点 + 文字（不做呼吸动画；运行态由文字表达）。 */
export function StatusDot({ status, withLabel = true }: { status?: string; withLabel?: boolean }) {
  const s = (status || '').toLowerCase()
  const cls =
    s === 'done' || s === 'merged' || s === 'approved' || s === 'pushed'
      ? 'ok'
      : s === 'failed' || s === 'rejected'
        ? 'err'
        : s === 'running' || s === 'pending' || s === 'await_confirm'
          ? 'run'
          : s === 'stale' || s === 'uncertain'
            ? 'warn'
            : 'mute'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
      <span className={`dot ${cls}`} style={withLabel ? undefined : { marginRight: 0 }} />
      {withLabel && <span className="t-sm">{statusLabel(status)}</span>}
    </span>
  )
}

/** 严重级徽章：critical/high/medium/low/info 带文字。 */
export function SeverityBadge({ severity }: { severity?: string }) {
  const key = (severity || '').toLowerCase()
  const tone = SEVERITY_TONE[key] || 'info'
  return <span className={`sev sev-${tone}`}>{SEVERITY_LABELS[key] || severity || '—'}</span>
}

/** 裁决徽章：approve / comment / request_changes。 */
export function VerdictBadge({ verdict }: { verdict?: string }) {
  const key = (verdict || '').toLowerCase()
  const tone = VERDICT_TONE[key] || 'info'
  return <span className={`sev sev-${tone}`}>{VERDICT_LABELS[key] || verdict || '—'}</span>
}

/** 面板容器：标题 + 右侧操作 + 内容。替代 className="glass" 的 Card。 */
export function Panel({
  title,
  extra,
  children,
  className,
  style,
  bodyStyle,
}: {
  title?: ReactNode
  extra?: ReactNode
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  bodyStyle?: React.CSSProperties
}) {
  return (
    <section className={className ? `panel ${className}` : 'panel'} style={style}>
      {(title || extra) && (
        <header className="panel-head">
          <span className="t-md t-semibold" style={{ flex: 1, minWidth: 0 }}>
            {title}
          </span>
          {extra}
        </header>
      )}
      <div className="panel-body" style={bodyStyle}>
        {children}
      </div>
    </section>
  )
}

/** 设计过的空态：标题 + 说明 + 可选主行动。 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div style={{ padding: `${t.space.huge}px ${t.space.lg}px`, textAlign: 'center' }}>
      <div className="t-md t-medium" style={{ color: t.color.text, marginBottom: t.space.xs }}>
        {title}
      </div>
      {description && (
        <div className="meta-sm" style={{ marginBottom: action ? t.space.lg : 0 }}>
          {description}
        </div>
      )}
      {action}
    </div>
  )
}

/** 空态（antd Empty 语义，统一视觉）。 */
export function EmptyHint({ description, action }: { description: string; action?: ReactNode }) {
  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={<span className="meta">{description}</span>}
      style={{ padding: `${t.space.xxl}px 0` }}
    >
      {action}
    </Empty>
  )
}

/** 元信息行：`id · kind · time` 之类的紧凑描述，用语义色而非 opacity。 */
export function MetaLine({ children, size = 'sm' }: { children: ReactNode; size?: 'sm' | 'xs' }) {
  return (
    <Typography.Text
      type="secondary"
      className={size === 'xs' ? 'meta-sm' : 'meta'}
      style={{ display: 'block' }}
    >
      {children}
    </Typography.Text>
  )
}

/**
 * 常驻加载错误条。列表/详情加载失败不能只弹一个会消失的 toast——
 * 否则用户看到的是「暂无数据」，分不清「真没数据」和「加载失败」。
 */
export function LoadError({ error, onRetry }: { error: string; onRetry: () => void }) {
  if (!error) return null
  return (
    <div
      className="panel"
      style={{
        padding: t.space.md,
        marginBottom: t.space.lg,
        borderColor: t.color.danger,
        display: 'flex',
        alignItems: 'center',
        gap: t.space.md,
      }}
    >
      <span className="t-sm" style={{ flex: 1, color: t.color.danger }}>
        {error}
      </span>
      <Button size="small" onClick={onRetry}>
        重试
      </Button>
    </div>
  )
}
