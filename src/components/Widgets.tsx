import { Typography } from 'antd'
import type { ReactNode } from 'react'
import { palette } from '../theme/theme'

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
    <div className="gradient-border glass-hover" style={{ height: '100%' }}>
      <div className="inner" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              display: 'grid',
              placeItems: 'center',
              background: `linear-gradient(135deg, ${accent}33, ${accent}11)`,
              color: accent,
              fontSize: 18,
              border: `1px solid ${accent}44`,
            }}
          >
            {icon}
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 12, letterSpacing: 1 }}>
            {label}
          </Typography.Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span className="mono" style={{ fontSize: 30, fontWeight: 700, color: accent }}>
            {value}
          </span>
          {suffix && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {suffix}
            </Typography.Text>
          )}
        </div>
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
