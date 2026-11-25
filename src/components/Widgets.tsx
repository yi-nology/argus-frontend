import { Typography } from 'antd'
import type { ReactNode } from 'react'
import { palette } from '../theme/theme'

/** 指标卡：平铺面板 + 纯色图标底色（无渐变装饰）。 */
export function StatCard({
  label,
  value,
  icon,
  accent = palette.cyan,
  suffix,
}: {
  label: string
  value: ReactNode
  icon: ReactNode
  accent?: string
  suffix?: string
}) {
  return (
    <div
      className="glass glass-hover"
      style={{ height: '100%', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            display: 'grid',
            placeItems: 'center',
            background: `${accent}1c`,
            color: accent,
            fontSize: 16,
          }}
        >
          {icon}
        </div>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {label}
        </Typography.Text>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span className="mono" style={{ fontSize: 26, fontWeight: 600, color: accent }}>
          {value}
        </span>
        {suffix && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {suffix}
          </Typography.Text>
        )}
      </div>
    </div>
  )
}

export function StatusDot({ status }: { status?: string }) {
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
  return <span className={`dot ${cls}`} />
}