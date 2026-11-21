import { useEffect, useState } from 'react'
import { Card, Col, List, Row, Tag, Typography, Button, Spin } from 'antd'
import {
  RocketOutlined,
  CheckCircleOutlined,
  CommentOutlined,
  CloseCircleOutlined,
  FireOutlined,
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
        <List
          dataSource={tasks.slice(0, 8)}
          locale={{ emptyText: '暂无任务，去创建一个审查吧' }}
          renderItem={(t) => (
            <List.Item
              style={{ cursor: 'pointer', borderRadius: 10 }}
              onClick={() => nav(`/tasks/${t.id || t.task_id}`)}
              actions={[
                <Tag key="v" color={verdictColor[t.verdict || ''] || 'default'}>
                  {t.verdict || '—'}
                </Tag>,
              ]}
            >
              <List.Item.Meta
                title={
                  <span>
                    <StatusDot status={t.status} />{' '}
                    <span className="mono" style={{ fontSize: 12, opacity: 0.75 }}>
                      {(t.id || t.task_id || '').slice(0, 14)}
                    </span>{' '}
                    {t.platform}/{t.owner}/{t.repo}#{t.number}
                  </span>
                }
                description={
                  <span className="mono" style={{ fontSize: 11 }}>
                    head {(t.head_sha || '').slice(0, 10) || '—'} · {t.kind || 'review'} ·{' '}
                    {(t.updated_at || '').slice(0, 19)}
                  </span>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  )
}
