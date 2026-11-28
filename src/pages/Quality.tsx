import { Button, Col, Progress, Row, Space, Table, Tooltip, Typography } from 'antd'
import {
  BugOutlined,
  ControlOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useNavigate } from '@umijs/max'
import {
  api,
  type RepoStatsRow,
  type RepoTokenUsage,
  type StatsOverview,
  type UsageMonthly,
} from '../api/client'
import { EmptyHint, MetaLine, Panel, StatCard, VerdictBadge } from '../components/Widgets'
import { scopeQuery } from '../hooks/useDeepLink'
import { useApi } from '../hooks/useApi'
import { fmtNum, VERDICT_LABELS } from '../constants/vocab'
import { t } from '../theme/tokens'

/** 预算水位（0-100 整数，喂 antd Progress；字符串百分比文案用 vocab.pct）。 */
function budgetPct(used?: number | null, budget?: number | null): number {
  if (!budget || budget <= 0) return 0
  return Math.min(100, Math.round(((used ?? 0) / budget) * 100))
}

/**
 * 质量运营：近 30 天审查态势 + 本月 token 三账本（完成口径 / 逐调用实销 /
 * 活跃预留）。按仓巡检：意见治理与回复控制配置直达。
 */
export default function Quality() {
  const nav = useNavigate()
  // 两本账独立兜底：部分失败保留已取到的部分，持续提示未取到的（不只弹一次 toast）。
  const { data, loading, refresh } = useApi(async () => {
    const [stats, usage] = await Promise.all([
      api.statsOverview({ days: 30 }).catch(() => null),
      api.usageMonthly().catch(() => null),
    ])
    return { stats, usage }
  })
  const stats: StatsOverview | null = data?.stats ?? null
  const usage: UsageMonthly | null = data?.usage ?? null
  const failed: string[] = []
  if (data && !stats) failed.push('近 30 天态势')
  if (data && !usage) failed.push('本月 token 用量')
  const loadWarn = failed.length
    ? `${failed.join('、')}加载失败（需要 read 档 token 且仓库在授权范围内）`
    : ''

  const repos: RepoStatsRow[] = stats?.repos ?? []
  const verdicts = stats?.verdicts
  const usageRows: RepoTokenUsage[] = usage?.repos ?? []
  const monthBudget = usage?.budget ?? 0
  const realBudget = usage?.real_budget ?? 0
  const realPct = budgetPct(usage?.real_total, realBudget)

  return (
    <div className="page">
      <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Typography.Title level={3} className="page-title">
            质量运营
          </Typography.Title>
          <Typography.Paragraph className="page-sub">
            近 30 天审查态势与本月 token 用量（完成口径 / 实销 /
            预留）。可按仓跳转意见治理与回复控制配置。
          </Typography.Paragraph>
        </div>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void refresh()}>
          刷新
        </Button>
      </Space>

      {loadWarn && (
        <div
          className="panel"
          style={{ padding: t.space.lg, marginBottom: t.space.lg, borderColor: t.color.attention }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: t.space.md }}>
            <span className="t-sm" style={{ flex: 1, color: t.color.attention }}>
              {loadWarn}
            </span>
            <Button size="small" onClick={() => void refresh()}>
              重试
            </Button>
          </div>
        </div>
      )}

      {/* ===== 30 天 KPI ===== */}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={4}>
          <StatCard
            label="审查任务（已完成）"
            value={fmtNum(stats?.tasks_done ?? null)}
            hint="窗口 30 天"
          />
        </Col>
        <Col xs={12} md={4}>
          <StatCard
            label={VERDICT_LABELS.approve}
            value={fmtNum(verdicts?.approve ?? null)}
            tone="success"
            hint="verdict = approve"
          />
        </Col>
        <Col xs={12} md={4}>
          <StatCard
            label={VERDICT_LABELS.comment}
            value={fmtNum(verdicts?.comment ?? null)}
            tone="attention"
            hint="verdict = comment"
          />
        </Col>
        <Col xs={12} md={4}>
          <StatCard
            label={VERDICT_LABELS.request_changes}
            value={fmtNum(verdicts?.request_changes ?? null)}
            tone="danger"
            hint="verdict = request_changes"
          />
        </Col>
        <Col xs={12} md={4}>
          <StatCard label="Token 消耗" value={fmtNum(stats?.tokens_used ?? null)} />
        </Col>
        <Col xs={12} md={4}>
          <StatCard label="误报抑制（历史）" value={fmtNum(stats?.findings_suppressed ?? null)} />
        </Col>
      </Row>

      {/* ===== 回复控制生效面 ===== */}
      <Row gutter={[16, 16]} style={{ marginTop: t.space.lg }}>
        <Col xs={24} md={8}>
          <StatCard
            label="节流跳过回帖"
            value={fmtNum(stats?.reply_throttled ?? null)}
            suffix="次"
            tone={stats?.reply_throttled ? 'attention' : 'default'}
          />
        </Col>
        <Col xs={24} md={8}>
          <StatCard
            label="低于级别地板静默"
            value={fmtNum(stats?.silenced_floor ?? null)}
            suffix="条"
          />
        </Col>
        <Col xs={24} md={8}>
          <StatCard
            label="超出数量上限静默"
            value={fmtNum(stats?.silenced_cap ?? null)}
            suffix="条"
          />
        </Col>
      </Row>

      {/* ===== 本月 token 三账本 ===== */}
      <Panel
        className="section"
        title={
          <Space>
            <ThunderboltOutlined />
            本月 Token 用量（{usage?.month || '—'}）
          </Space>
        }
        extra={
          <Button type="link" onClick={() => nav('/settings/repos')}>
            按仓预算设置
          </Button>
        }
      >
        <Row gutter={[24, 12]}>
          <Col xs={24} md={8}>
            <MetaLine size="xs">完成口径（全部仓库合计）</MetaLine>
            <div className="num t-lg">{fmtNum(usage?.total ?? null)}</div>
            <MetaLine size="xs">
              {monthBudget > 0 ? (
                <>每仓月度上限 {fmtNum(monthBudget)}；按仓水位见下表</>
              ) : (
                <>未设每仓月度上限（可在仓库设置中按仓配置）</>
              )}
            </MetaLine>
          </Col>
          <Col xs={24} md={8}>
            <MetaLine size="xs">逐调用实销（含失败与重试）</MetaLine>
            {realBudget > 0 ? (
              <>
                <Progress percent={realPct} status={realPct >= 100 ? 'exception' : 'normal'} />
                <div className="num t-xs">
                  {fmtNum(usage?.real_total ?? null)} / {fmtNum(realBudget)}
                </div>
              </>
            ) : (
              <>
                <div className="num t-lg">{fmtNum(usage?.real_total ?? null)}</div>
                <MetaLine size="xs">未设月度上限（实销仅作观测）</MetaLine>
              </>
            )}
          </Col>
          <Col xs={24} md={8}>
            <MetaLine size="xs">活跃预留（执行前承诺）</MetaLine>
            <div className="num t-lg">{fmtNum(usage?.reserved_total ?? null)}</div>
            <MetaLine size="xs">在途消耗；任务完成后转入实销</MetaLine>
          </Col>
        </Row>
        {usageRows.length === 0 ? (
          <EmptyHint description="本月暂无 token 用量" />
        ) : (
          <Table<RepoTokenUsage>
            size="small"
            style={{ marginTop: t.space.md }}
            loading={loading}
            rowKey={(r) => `${r.platform}:${r.owner}/${r.repo}`}
            dataSource={usageRows}
            scroll={{ x: 640 }}
            pagination={{
              pageSize: 20,
              showSizeChanger: false,
              showTotal: (total) => `共 ${total} 条`,
            }}
            columns={[
              { title: '仓库', render: (_, r) => `${r.platform}/${r.owner}/${r.repo}` },
              { title: '任务', dataIndex: 'tasks', width: 80 },
              {
                title: 'tokens（完成口径）',
                dataIndex: 'tokens',
                width: 160,
                render: (v: number) => fmtNum(v),
              },
              {
                title: '配额水位',
                width: 180,
                render: (_, r) =>
                  monthBudget > 0 ? (
                    <Progress
                      size="small"
                      percent={budgetPct(r.tokens, monthBudget)}
                      status={budgetPct(r.tokens, monthBudget) >= 100 ? 'exception' : 'normal'}
                    />
                  ) : (
                    <Typography.Text type="secondary">未设上限</Typography.Text>
                  ),
              },
            ]}
          />
        )}
      </Panel>

      {/* ===== 按仓质量巡检 ===== */}
      <Panel className="section" title="按仓质量巡检（近 30 天）">
        {repos.length === 0 ? (
          <EmptyHint description="近 30 天暂无已完成审查任务" />
        ) : (
          <Table<RepoStatsRow>
            size="small"
            loading={loading}
            rowKey={(r) => `${r.platform}:${r.owner}/${r.repo}`}
            dataSource={repos}
            scroll={{ x: 1000 }}
            pagination={{
              pageSize: 20,
              showSizeChanger: false,
              showTotal: (total) => `共 ${total} 条`,
            }}
            columns={[
              { title: '仓库', render: (_, r) => `${r.platform}/${r.owner}/${r.repo}` },
              { title: '任务', dataIndex: 'tasks_done', width: 70 },
              {
                title: '裁决分布',
                width: 240,
                render: (_, r) => (
                  <Space size={t.space.md} wrap>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: t.space.xs }}>
                      <VerdictBadge verdict="approve" />
                      <span className="num t-sm">{r.verdict_approve}</span>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: t.space.xs }}>
                      <VerdictBadge verdict="comment" />
                      <span className="num t-sm">{r.verdict_comment}</span>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: t.space.xs }}>
                      <VerdictBadge verdict="request_changes" />
                      <span className="num t-sm">{r.verdict_request_changes}</span>
                    </span>
                  </Space>
                ),
              },
              {
                title: 'tokens',
                dataIndex: 'tokens_used',
                width: 100,
                render: (v: number) => fmtNum(v),
              },
              { title: '误报抑制', dataIndex: 'findings_suppressed', width: 86 },
              {
                title: '回复控制生效',
                width: 190,
                render: (_, r) => (
                  <Space size={t.space.xs} wrap>
                    {r.reply_throttled > 0 && (
                      <span className="sev sev-attention">节流 {r.reply_throttled}</span>
                    )}
                    {r.silenced_floor > 0 && (
                      <span className="sev sev-info">级别静默 {r.silenced_floor}</span>
                    )}
                    {r.silenced_cap > 0 && (
                      <span className="sev sev-info">数量静默 {r.silenced_cap}</span>
                    )}
                    {r.reply_throttled + r.silenced_floor + r.silenced_cap === 0 && (
                      <Typography.Text type="secondary">—</Typography.Text>
                    )}
                  </Space>
                ),
              },
              {
                title: '操作',
                width: 180,
                render: (_, r) => (
                  <Space size={t.space.xs}>
                    <Tooltip title="查看该仓意见指纹，抑制误报/恢复">
                      <Button
                        size="small"
                        icon={<BugOutlined />}
                        onClick={() =>
                          nav(
                            `/findings${scopeQuery({ platform: r.platform, owner: r.owner, repo: r.repo })}`,
                          )
                        }
                      >
                        意见
                      </Button>
                    </Tooltip>
                    <Button
                      size="small"
                      icon={<ControlOutlined />}
                      onClick={() =>
                        nav(
                          `/settings/repos${scopeQuery({ platform: r.platform, owner: r.owner, repo: r.repo })}`,
                        )
                      }
                    >
                      设置
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Panel>
    </div>
  )
}
