import { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic, Tag, Typography, Button, Spin } from 'antd'
import {
  RocketOutlined,
  CheckCircleOutlined,
  CommentOutlined,
  CloseCircleOutlined,
  FireOutlined,
  EyeInvisibleOutlined,
  MinusCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { api, type TaskRow } from '../api/client'
import { StatCard, StatusDot } from '../components/Widgets'
import { useAuth } from '../auth/AuthContext'

const verdictColor: Record<string, string> = {
  approve: 'success',
  comment: 'warning',
  request_changes: 'error',
}

export default function Dashboard() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [stats, setStats] = useState<any>(null)
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [s, t] = await Promise.all([
          api.statsOverview({ days: 30 }).catch(() => null),
          api.listTasks({ limit: 12 }).catch(() => ({ tasks: [] as TaskRow[] })),
        ])
        if (!alive) return
        setStats(s)
        setTasks(Array.isArray(t) ? t : ((t as any).tasks ?? []))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const verdicts = stats?.verdicts || {}

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        欢迎，{user?.username} <span className="grad-text">· 30 天审查态势</span>
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        受控变更 · 资格门 · 审批票 —— 全部写操作 preview → confirm
      </Typography.Paragraph>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}>
            <StatCard label="任务总量" value={stats?.total_tasks ?? '—'} icon={<RocketOutlined />} />
          </Col>
          <Col xs={12} md={6}>
            <StatCard
              label="APPROVE"
              value={verdicts.approve ?? '—'}
              icon={<CheckCircleOutlined />}
              accent="#34d399"
            />
          </Col>
          <Col xs={12} md={6}>
            <StatCard
              label="COMMENT"
              value={verdicts.comment ?? '—'}
              icon={<CommentOutlined />}
              accent="#fbbf24"
            />
          </Col>
          <Col xs={12} md={6}>
            <StatCard
              label="REQUEST_CHANGES"
              value={verdicts.request_changes ?? '—'}
              icon={<CloseCircleOutlined />}
              accent="#fb7185"
            />
          </Col>
        </Row>
      </Spin>

      <Card
        className="glass"
        size="small"
        style={{ marginTop: 16 }}
        title={<span><CommentOutlined /> 回复控制（30 天）</span>}
        extra={<Button type="link" onClick={() => nav('/settings/repos')}>按仓设置 →</Button>}
      >
        <Row gutter={[16, 8]}>
          <Col xs={8}>
            <Statistic
              title={<span><ClockCircleOutlined /> 节流跳过回帖</span>}
              value={stats?.reply_throttled ?? 0}
              suffix="次"
            />
          </Col>
          <Col xs={8}>
            <Statistic
              title={<span><EyeInvisibleOutlined /> 低于级别地板静默</span>}
              value={stats?.silenced_floor ?? 0}
              suffix="条"
            />
          </Col>
          <Col xs={8}>
            <Statistic
              title={<span><MinusCircleOutlined /> 超出数量上限静默</span>}
              value={stats?.silenced_cap ?? 0}
              suffix="条"
            />
          </Col>
        </Row>
      </Card>

      <Card
        className="glass"
        style={{ marginTop: 20 }}
        title={
          <span>
            <FireOutlined style={{ color: '#fb7185' }} /> 最近任务
          </span>
        }
        extra={
          <Button type="link" onClick={() => nav('/tasks')}>
            查看全部 →
          </Button>
        }
      >
        <div>
          {tasks.slice(0, 8).map((t) => (
            <div
              key={t.id || t.task_id}
              onClick={() => nav(`/tasks/${t.id || t.task_id}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                padding: '10px 8px', borderRadius: 10, borderBottom: '1px solid rgba(88,148,255,0.08)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <StatusDot status={t.status} />
                  <span className="mono" style={{ fontSize: 12, opacity: 0.7 }}>
                    {(t.id || t.task_id || '').slice(0, 14)}
                  </span>
                  <span style={{ fontSize: 13 }}>
                    {t.platform}/{t.owner}/{t.repo}#{t.number}
                  </span>
                </div>
                <div className="mono" style={{ fontSize: 11, opacity: 0.55, marginTop: 2 }}>
                  head {(t.head_sha || '').slice(0, 10) || '—'} · {t.kind || 'review'} ·{' '}
                  {(t.updated_at || '').slice(0, 19)}
                </div>
              </div>
              <Tag color={verdictColor[t.verdict || ''] || 'default'}>{t.verdict || '—'}</Tag>
            </div>
          ))}
          {tasks.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', opacity: 0.6, fontSize: 13 }}>
              暂无任务，去创建一个审查吧
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
