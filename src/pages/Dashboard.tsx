import { Button, Col, Row, Spin, Typography } from 'antd'
import { useNavigate } from '@umijs/max'
import { api, type StatsOverview, type TaskRow } from '../api/client'
import {
  EmptyHint,
  LoadError,
  MetaLine,
  Panel,
  StatCard,
  StatusDot,
  VerdictBadge,
} from '../components/Widgets'
import { fmtNum, fmtTime, kindLabel } from '../constants/vocab'
import { useAuth } from '../auth/AuthContext'
import { useApi } from '../hooks/useApi'
import { t } from '../theme/tokens'

/** 任务 id 紧凑展示长度（全站统一，不再散落 14/16/20）。 */
const ID_LEN = 12

export default function Dashboard() {
  const { user } = useAuth()
  const nav = useNavigate()
  const { data, loading, errorText, refresh } = useApi(
    async () => {
      const [stats, tasks] = await Promise.all([
        api.statsOverview({ days: 30 }),
        api.listTasks({ limit: 8 }),
      ])
      return { stats, tasks }
    },
    { errorFallback: '概览加载失败' },
  )
  const stats: StatsOverview | null = data?.stats ?? null
  const tasks: TaskRow[] = data?.tasks ?? []
  const verdicts = stats?.verdicts

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        {user?.username ? `${user.username} 的工作台` : '工作台'}
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        近 30 天审查态势。所有写操作（合并 / 推送 / 审批）都需要预览确认，失败会给出明确原因。
      </Typography.Paragraph>

      <LoadError error={errorText} onRetry={() => void refresh()} />

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}>
            <StatCard
              label="审查任务（已完成）"
              value={fmtNum(stats?.tasks_done ?? null)}
              hint="窗口 30 天"
            />
          </Col>
          <Col xs={12} md={6}>
            <StatCard
              label="通过"
              value={fmtNum(verdicts?.approve ?? null)}
              tone="success"
              hint="verdict = approve"
            />
          </Col>
          <Col xs={12} md={6}>
            <StatCard
              label="建议修改"
              value={fmtNum(verdicts?.comment ?? null)}
              tone="attention"
              hint="verdict = comment"
            />
          </Col>
          <Col xs={12} md={6}>
            <StatCard
              label="需修改"
              value={fmtNum(verdicts?.request_changes ?? null)}
              tone="danger"
              hint="verdict = request_changes"
            />
          </Col>
        </Row>
      </Spin>

      <Panel
        className="section"
        title="回复控制（30 天）"
        extra={
          <Button type="link" onClick={() => nav('/settings/repos')}>
            按仓设置
          </Button>
        }
      >
        <Row gutter={[16, 8]}>
          <Col xs={24} md={8}>
            <MetaLine size="xs">节流跳过回帖</MetaLine>
            <div className="num t-lg">{fmtNum(stats?.reply_throttled ?? null)} 次</div>
          </Col>
          <Col xs={24} md={8}>
            <MetaLine size="xs">低于级别地板静默</MetaLine>
            <div className="num t-lg">{fmtNum(stats?.silenced_floor ?? null)} 条</div>
          </Col>
          <Col xs={24} md={8}>
            <MetaLine size="xs">超出数量上限静默</MetaLine>
            <div className="num t-lg">{fmtNum(stats?.silenced_cap ?? null)} 条</div>
          </Col>
        </Row>
      </Panel>

      <Panel
        className="section"
        title="最近任务"
        extra={
          <Button type="link" onClick={() => nav('/tasks')}>
            查看全部
          </Button>
        }
        bodyStyle={{ paddingTop: t.space.sm, paddingBottom: t.space.sm }}
      >
        {tasks.length === 0 && !loading ? (
          <EmptyHint
            description="还没有审查任务"
            action={
              <Button type="primary" onClick={() => nav('/tasks')}>
                创建第一个审查
              </Button>
            }
          />
        ) : (
          <div>
            {tasks.map((task) => {
              const id = task.id || task.task_id || ''
              return (
                <div
                  key={id}
                  className="list-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => nav(`/tasks/${id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      nav(`/tasks/${id}`)
                    }
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: t.space.sm,
                        flexWrap: 'wrap',
                      }}
                    >
                      <StatusDot status={task.status} />
                      <span className="mono meta-sm">{id.slice(0, ID_LEN)}</span>
                      <span className="t-sm">
                        {task.platform}/{task.owner}/{task.repo}#{task.number}
                      </span>
                    </div>
                    <MetaLine size="xs">
                      head {(task.head_sha || '').slice(0, 10) || '—'} · {kindLabel(task.kind)} ·{' '}
                      {fmtTime(task.updated_at)}
                    </MetaLine>
                  </div>
                  <VerdictBadge verdict={task.verdict} />
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}
