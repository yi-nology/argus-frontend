import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Empty, Row, Statistic, Tag, Typography, Spin } from 'antd'
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
import { VERDICT_COLOR, VERDICT_LABELS, fmtTime, kindLabel } from '../constants/vocab'
import { useAuth } from '../auth/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [stats, setStats] = useState<any>(null)
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = async () => {
    setLoading(true)
    setErr('')
    try {
      const [s, t] = await Promise.all([
        api.statsOverview({ days: 30 }),
        api.listTasks({ limit: 8 }),
      ])
      setStats(s)
      setTasks(Array.isArray(t) ? t : ((t as any).tasks ?? []))
    } catch (e: any) {
      setErr(e?.message || '概览加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const verdicts = stats?.verdicts || {}

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        {user?.username ? `${user.username} 的工作台` : '工作台'}
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        近 30 天审查态势。所有写操作（合并 / 推送 / 审批）都需要预览确认，失败会给出明确原因。
      </Typography.Paragraph>

      {err && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title={err}
          action={<Button size="small" onClick={load}>重试</Button>}
        />
      )}

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}>
            <StatCard label="审查任务（已完成）" value={stats?.tasks_done ?? '—'} icon={<RocketOutlined />} />
          </Col>
          <Col xs={12} md={6}>
            <StatCard
              label="通过"
              value={verdicts.approve ?? '—'}
              icon={<CheckCircleOutlined />}
              accent="#34d399"
            />
          </Col>
          <Col xs={12} md={6}>
            <StatCard
              label="建议修改"
              value={verdicts.comment ?? '—'}
              icon={<CommentOutlined />}
              accent="#f0b429"
            />
          </Col>
          <Col xs={12} md={6}>
            <StatCard
              label="需修改"
              value={verdicts.request_changes ?? '—'}
              icon={<CloseCircleOutlined />}
              accent="#f07178"
            />
          </Col>
        </Row>
      </Spin>

      <Card
        className="glass"
        size="small"
        style={{ marginTop: 16 }}
        title={<span><CommentOutlined /> 回复控制（30 天）</span>}
        extra={<Button type="link" onClick={() => nav('/settings/repos')}>按仓设置</Button>}
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
        title={<span><FireOutlined style={{ color: '#f0b429', marginRight: 6 }} />最近任务</span>}
        extra={<Button type="link" onClick={() => nav('/tasks')}>查看全部</Button>}
      >
        {tasks.length === 0 && !loading ? (
          <Empty description="还没有审查任务" style={{ padding: '16px 0' }}>
            <Button type="primary" onClick={() => nav('/tasks')}>创建第一个审查</Button>
          </Empty>
        ) : (
          <div>
            {tasks.map((t) => (
              <div
                key={t.id || t.task_id}
                onClick={() => nav(`/tasks/${t.id || t.task_id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                  padding: '10px 8px', borderRadius: 8, borderBottom: '1px solid rgba(148,163,184,0.08)',
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
                    head {(t.head_sha || '').slice(0, 10) || '—'} · {kindLabel(t.kind)} · {fmtTime(t.updated_at)}
                  </div>
                </div>
                <Tag color={VERDICT_COLOR[t.verdict || ''] || 'default'}>
                  {VERDICT_LABELS[t.verdict || ''] || t.verdict || '—'}
                </Tag>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}