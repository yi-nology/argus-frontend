import { useEffect, useState } from 'react'
import {
  App, Button, Card, Col, Empty, Progress, Row, Space, Statistic, Table, Tag, Tooltip, Typography,
} from 'antd'
import {
  BarChartOutlined, BugOutlined, ControlOutlined, ReloadOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

interface RepoStat {
  platform: string
  owner: string
  repo: string
  tasks_done: number
  verdict_approve: number
  verdict_comment: number
  verdict_request_changes: number
  tokens_used: number
  findings_suppressed: number
  reply_throttled: number
  silenced_floor: number
  silenced_cap: number
}

interface UsageRow {
  platform: string
  owner: string
  repo: string
  tokens: number
  tasks: number
}

/** 千分位数字（token 量级大，可读性优先）。 */
function fmtNum(n?: number): string {
  return (n ?? 0).toLocaleString('en-US')
}

/** 百分比（预算水位；无预算=0）。 */
function pct(used?: number, budget?: number): number {
  if (!budget || budget <= 0) return 0
  return Math.min(100, Math.round(((used ?? 0) / budget) * 100))
}

/**
 * 质量运营（v8.6）：把 /stats/overview（审查质量/回复控制）与
 * /usage/monthly（配额/实销/预留三账本）汇总成一页，供研发/运维按仓巡检。
 */
export default function Quality() {
  const { message } = App.useApp()
  const nav = useNavigate()
  const [stats, setStats] = useState<any>(null)
  const [usage, setUsage] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [s, u] = await Promise.all([
        api.statsOverview({ days: 30 }).catch(() => null),
        api.usageMonthly().catch(() => null),
      ])
      setStats(s)
      setUsage(u)
      if (!s && !u) message.error('加载失败（需要 read 档 token 且仓库在授权范围内）')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const repos: RepoStat[] = stats?.repos ?? []
  const verdicts = stats?.verdicts ?? {}
  const usageRows: UsageRow[] = usage?.repos ?? []

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            <BarChartOutlined /> 质量运营
          </Typography.Title>
          <Typography.Paragraph type="secondary">
            近 30 天审查态势 + 本月 token 三账本（done 口径 / 逐调用实销 / 活跃预留）。
            按仓巡检：意见治理与回复控制配置直达。
          </Typography.Paragraph>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>刷新</Button>
          <Button type="primary" ghost icon={<BarChartOutlined />}
            onClick={() => window.open('/api/console', '_blank')}>
            服务端质量台
          </Button>
        </Space>
      </Space>

      {/* ===== 30 天 KPI ===== */}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={4}><Card size="small"><Statistic title="审查任务（done）" value={fmtNum(stats?.tasks_done)} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="APPROVE" value={fmtNum(verdicts.approve)} valueStyle={{ color: '#34d399' }} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="COMMENT" value={fmtNum(verdicts.comment)} valueStyle={{ color: '#fbbf24' }} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="REQUEST_CHANGES" value={fmtNum(verdicts.request_changes)} valueStyle={{ color: '#fb7185' }} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Token 消耗" value={fmtNum(stats?.tokens_used)} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="误报抑制（历史）" value={fmtNum(stats?.findings_suppressed)} /></Card></Col>
      </Row>

      {/* ===== 回复控制生效面 ===== */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={8}>
          <Card size="small">
            <Statistic title="节流跳过回帖" value={fmtNum(stats?.reply_throttled)} suffix="次"
              valueStyle={{ color: stats?.reply_throttled ? '#fbbf24' : undefined }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small">
            <Statistic title="低于级别地板静默" value={fmtNum(stats?.silenced_floor)} suffix="条" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small">
            <Statistic title="超出数量上限静默" value={fmtNum(stats?.silenced_cap)} suffix="条" />
          </Card>
        </Col>
      </Row>

      {/* ===== 本月 token 三账本 ===== */}
      <Card
        size="small"
        style={{ marginTop: 16 }}
        title={<Space><ThunderboltOutlined />本月 Token 用量（{usage?.month || '—'}）</Space>}
        extra={<Button type="link" onClick={() => nav('/settings/repos')}>按仓预算设置 →</Button>}
      >
        <Row gutter={[24, 12]}>
          <Col xs={24} md={8}>
            <Typography.Text type="secondary">配额口径（done 任务）</Typography.Text>
            <Progress percent={pct(usage?.total, usage?.budget)} status={pct(usage?.total, usage?.budget) >= 100 ? 'exception' : 'normal'} />
            <Typography.Text style={{ fontSize: 12 }}>
              {fmtNum(usage?.total)} / {fmtNum(usage?.budget)}（每仓月度上限参考）
            </Typography.Text>
          </Col>
          <Col xs={24} md={8}>
            <Typography.Text type="secondary">逐调用实销（含失败/重试）</Typography.Text>
            <Progress percent={pct(usage?.real_total, usage?.real_budget)} status={pct(usage?.real_total, usage?.real_budget) >= 100 ? 'exception' : 'normal'} />
            <Typography.Text style={{ fontSize: 12 }}>
              {fmtNum(usage?.real_total)} / {fmtNum(usage?.real_budget)}
            </Typography.Text>
          </Col>
          <Col xs={24} md={8}>
            <Typography.Text type="secondary">活跃预留（执行前承诺）</Typography.Text>
            <Statistic value={fmtNum(usage?.reserved_total)} />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>在途消耗；随任务完成转入实销</Typography.Text>
          </Col>
        </Row>
        <Table<UsageRow>
          size="small"
          style={{ marginTop: 12 }}
          rowKey={(r) => `${r.platform}:${r.owner}/${r.repo}`}
          dataSource={usageRows}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          columns={[
            { title: '仓库', render: (_, r) => `${r.platform}/${r.owner}/${r.repo}` },
            { title: '任务', dataIndex: 'tasks', width: 80 },
            { title: 'tokens（配额口径）', dataIndex: 'tokens', width: 160, render: (v: number) => fmtNum(v) },
          ]}
        />
      </Card>

      {/* ===== 按仓质量巡检 ===== */}
      <Card size="small" style={{ marginTop: 16 }} title="按仓质量巡检（近 30 天）">
        {repos.length === 0 ? <Empty description="近 30 天暂无已完成审查任务" /> : (
          <Table<RepoStat>
            size="small"
            rowKey={(r) => `${r.platform}:${r.owner}/${r.repo}`}
            dataSource={repos}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            columns={[
              { title: '仓库', render: (_, r) => `${r.platform}/${r.owner}/${r.repo}` },
              { title: '任务', dataIndex: 'tasks_done', width: 70 },
              {
                title: '裁决分布', width: 220,
                render: (_, r) => (
                  <Space size={4} wrap>
                    <Tag color="success">A {r.verdict_approve}</Tag>
                    <Tag color="warning">C {r.verdict_comment}</Tag>
                    <Tag color="error">RC {r.verdict_request_changes}</Tag>
                  </Space>
                ),
              },
              { title: 'tokens', dataIndex: 'tokens_used', width: 100, render: (v: number) => fmtNum(v) },
              { title: '误报抑制', dataIndex: 'findings_suppressed', width: 86 },
              {
                title: '回复控制生效', width: 190,
                render: (_, r) => (
                  <Space size={4} wrap>
                    {r.reply_throttled > 0 && <Tag color="orange">节流 {r.reply_throttled}</Tag>}
                    {r.silenced_floor > 0 && <Tag>floor {r.silenced_floor}</Tag>}
                    {r.silenced_cap > 0 && <Tag>cap {r.silenced_cap}</Tag>}
                    {r.reply_throttled + r.silenced_floor + r.silenced_cap === 0 && <Typography.Text type="secondary">—</Typography.Text>}
                  </Space>
                ),
              },
              {
                title: '操作', width: 180,
                render: (_, r) => (
                  <Space size={4}>
                    <Tooltip title="查看该仓意见指纹，抑制误报/恢复">
                      <Button size="small" icon={<BugOutlined />}
                        onClick={() => nav(`/findings?platform=${encodeURIComponent(r.platform)}&owner=${encodeURIComponent(r.owner)}&repo=${encodeURIComponent(r.repo)}`)}>
                        意见
                      </Button>
                    </Tooltip>
                    <Button size="small" icon={<ControlOutlined />}
                      onClick={() => nav('/settings/repos')}>设置</Button>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Card>
    </div>
  )
}