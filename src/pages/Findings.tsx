import { useEffect, useState } from 'react'
import {
  App,
  AutoComplete,
  Button,
  Col,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tooltip,
  Typography,
} from 'antd'
import {
  BugOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import { useSearchParams } from '@umijs/max'
import { api, errMsg, type FindingRow, type TaskRow } from '../api/client'
import { EmptyHint, LoadError, Panel, SeverityBadge, StatCard } from '../components/Widgets'
import RepoPicker, { useConsoleOptions, type Coords } from '../components/RepoPicker'
import RecentTaskPicker from '../components/RecentTaskPicker'
import { SEVERITY_OPTIONS, SEVERITY_ORDER, fmtAgo, fmtNum } from '../constants/vocab'
import { useDeepLink } from '../hooks/useDeepLink'
import { useApi } from '../hooks/useApi'
import { useLatestRef } from '../hooks/async'
import { useAuth } from '../auth/AuthContext'
import { t } from '../theme/tokens'

const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '未抑制', value: 'open' },
  { label: '已抑制', value: 'suppressed' },
]

/** 单次拉取上限（服务端按出现次数截断；超出走状态过滤缩小范围）。 */
const FINDINGS_LIMIT = 200

const PAGE_SIZE = 20

/**
 * 意见治理台：跨 PR 浏览 finding_prints，人工抑制误报 / 恢复。
 * 抑制是信任边界写操作（后端 admin 档 + 仓库维度判定）；清单 read 档即可。
 */
export default function Findings() {
  const { message } = App.useApp()
  const { user } = useAuth()
  const canWrite = user?.scope === 'admin' || user?.role === 'admin'
  const [params] = useSearchParams()
  const opts = useConsoleOptions()
  const [coords, setCoords] = useState<Coords>({
    platform: params.get('platform') || opts?.platforms?.[0] || '',
    owner: params.get('owner') || '',
    repo: params.get('repo') || '',
  })
  const [status, setStatus] = useState('')
  const [sev, setSev] = useState('')
  const [kw, setKw] = useState('')

  // manual 查询：加载意见按钮 / 深链 / 状态过滤联动触发。
  const {
    data: res,
    loading,
    errorText: loadErr,
    run: query,
  } = useApi(
    (c: Coords, st: string) =>
      api.listFindings({
        platform: c.platform,
        owner: c.owner,
        repo: c.repo,
        status: st || undefined,
        limit: FINDINGS_LIMIT,
      }),
    { manual: true, errorFallback: '查询失败（需要 read 档 token 且仓库在授权范围内）' },
  )
  // 首查成功后进入结果区（失败不进——否则「加载失败」看起来像「暂无数据」）。
  const loaded = res !== undefined
  const rows = res?.findings ?? []
  const counts = res?.counts ?? null
  const sevCounts = res?.severity_counts ?? {}
  const topFiles = res?.top_files ?? []

  const load = (c: Coords = coords, st = status) => {
    if (!c.platform || !c.owner || !c.repo) {
      message.warning('请完整选择平台、owner 与仓库')
      return
    }
    void query(c, st)
  }
  const latestRef = useLatestRef({ coords, status, loaded })

  // 从任务详情/质量运营跳转自动查询：意见治理是仓库域（三参即加载，PR 号可选）。
  useDeepLink(
    (c) => {
      setCoords(c)
      void query(c, '')
    },
    { requireNumber: false },
  )

  // 切换状态过滤：已加载过仓库则立即重查（未加载时只更新选择）。
  useEffect(() => {
    const { coords: c, status: st, loaded: ld } = latestRef.current
    if (ld) void query(c, st)
  }, [status, latestRef, query])

  const pickTask = (t: TaskRow) => {
    const c: Coords = { platform: t.platform || '', owner: t.owner || '', repo: t.repo || '' }
    setCoords(c)
    void load(c, status)
  }

  // 抑制/恢复是信任边界写操作：反馈走 message，成功后按当前筛选重查清单。
  const { run: suppressRun } = useApi(api.suppressFinding, {
    manual: true,
    onSuccess: (res) => {
      message.success(res.matched ? '已抑制（下一轮审查起不再上报）' : '已登记抑制（下轮起生效）')
      load()
    },
    onError: (e) => message.error(errMsg(e, '抑制失败（需要 admin 档 token 且仓库在授权范围内）')),
  })
  const { run: restoreRun } = useApi(api.restoreFinding, {
    manual: true,
    onSuccess: (res) => {
      if (res.matched) message.success('已恢复（下一轮审查起重新可见）')
      else message.warning('未找到该指纹的抑制记录')
      load()
    },
    onError: (e) => message.error(errMsg(e, '恢复失败（需要 admin 档 token）')),
  })
  const suppress = (row: FindingRow) =>
    void suppressRun({
      platform: row.platform,
      owner: row.owner,
      repo: row.repo,
      number: row.number,
      fingerprint: row.fingerprint,
    })
  const restore = (row: FindingRow) =>
    void restoreRun({
      platform: row.platform,
      owner: row.owner,
      repo: row.repo,
      number: row.number,
      fp: row.fingerprint,
    })

  const visibleRows = rows.filter((r) => {
    if (sev && (r.severity || '').toLowerCase() !== sev) return false
    if (kw) {
      const hay = `${r.file ?? ''} ${r.comment ?? ''} ${r.fingerprint}`
      if (!hay.toLowerCase().includes(kw.toLowerCase())) return false
    }
    return true
  })

  /** 搜索建议：高频噪声文件（已由服务端按出现次数排序）。 */
  const kwOptions = topFiles.map((f) => ({ value: f.file }))

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        <BugOutlined style={{ marginRight: t.space.sm }} />
        意见治理
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        跨 PR
        浏览已上报意见的指纹账本：抑制误报后，后续轮次自动从报告与评论中剔除；恢复后下一轮重新可见。
      </Typography.Paragraph>

      {/* 仓库选择条 */}
      <Panel className="section">
        <Space orientation="vertical" size={t.space.md} style={{ width: '100%' }}>
          <RecentTaskPicker onPick={pickTask} />
          <Space wrap size={t.space.md}>
            <RepoPicker value={coords} onChange={setCoords} />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              loading={loading}
              onClick={() => load()}
            >
              加载意见
            </Button>
            {loaded && (
              <Button icon={<ReloadOutlined />} onClick={() => load()}>
                刷新
              </Button>
            )}
          </Space>
        </Space>
      </Panel>

      {!loaded && <EmptyHint description="选择仓库并加载意见清单" />}

      {loaded && (
        <>
          {/* 计数卡 */}
          <Row gutter={[16, 16]} style={{ marginBottom: t.space.lg }}>
            <Col xs={12} md={6}>
              <StatCard label="指纹总数" value={fmtNum(counts?.total ?? 0)} />
            </Col>
            <Col xs={12} md={6}>
              <StatCard
                label="未抑制"
                value={fmtNum(counts?.open ?? 0)}
                tone={counts?.open ? 'attention' : 'default'}
              />
            </Col>
            <Col xs={12} md={6}>
              <StatCard label="已抑制" value={fmtNum(counts?.suppressed ?? 0)} />
            </Col>
            <Col xs={12} md={6}>
              <StatCard
                label="本轮未复现"
                value={fmtNum(counts?.stale ?? 0)}
                hint="历史报过、最近一轮没再出现；待人工确认（不等于已修复）"
                tone={counts?.stale ? 'attention' : 'default'}
              />
            </Col>
          </Row>

          {/* 分布与噪声文件 */}
          {(Object.keys(sevCounts).length > 0 || topFiles.length > 0) && (
            <Row gutter={[16, 16]} style={{ marginBottom: t.space.lg }}>
              <Col xs={24} md={10}>
                <Panel title="严重度分布">
                  <Space wrap size={t.space.md}>
                    {SEVERITY_ORDER.filter((k) => sevCounts[k]).map((k) => (
                      <span
                        key={k}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: t.space.xs }}
                      >
                        <SeverityBadge severity={k} />
                        <span className="num t-sm">{sevCounts[k]}</span>
                      </span>
                    ))}
                  </Space>
                </Panel>
              </Col>
              <Col xs={24} md={14}>
                <Panel
                  title="高频噪声文件"
                  extra={
                    <Typography.Text type="secondary" className="meta-sm">
                      点击文件名筛选
                    </Typography.Text>
                  }
                >
                  {topFiles.length === 0 ? (
                    <Typography.Text type="secondary">暂无</Typography.Text>
                  ) : (
                    topFiles.map((f) => (
                      <div
                        key={f.file}
                        className="list-row"
                        role="button"
                        tabIndex={0}
                        onClick={() => setKw(f.file)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setKw(f.file)
                          }
                        }}
                      >
                        <Typography.Text className="mono meta-sm" style={{ flex: 1 }} ellipsis>
                          {f.file}
                        </Typography.Text>
                        <Typography.Text className="meta-sm" style={{ whiteSpace: 'nowrap' }}>
                          共 {f.total} · 抑制 {f.suppressed}
                        </Typography.Text>
                      </div>
                    ))
                  )}
                </Panel>
              </Col>
            </Row>
          )}

          <LoadError error={loadErr} onRetry={() => void load()} />

          <Panel
            className="section"
            title="意见指纹清单"
            extra={
              <Space wrap size={t.space.sm}>
                <Segmented
                  value={status}
                  onChange={(v) => setStatus(v as string)}
                  options={STATUS_OPTIONS}
                />
                <Select
                  size="small"
                  style={{ width: 150 }}
                  value={sev}
                  onChange={setSev}
                  options={SEVERITY_OPTIONS}
                />
                <AutoComplete
                  size="small"
                  allowClear
                  placeholder="搜索文件 / 意见 / 指纹"
                  style={{ width: 220 }}
                  value={kw}
                  options={kwOptions}
                  filterOption={(input, opt) =>
                    String(opt?.value ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  onChange={(v: string) => setKw(v)}
                />
              </Space>
            }
          >
            {(() => {
              const expected =
                status === 'open'
                  ? counts?.open
                  : status === 'suppressed'
                    ? counts?.suppressed
                    : counts?.total
              if (!counts || (expected ?? 0) <= rows.length) return null
              return (
                <Typography.Text type="secondary" className="meta-sm">
                  仅显示最近 {rows.length} 条（共 {expected} 条）；可用状态过滤缩小范围。
                </Typography.Text>
              )
            })()}
            <Table<FindingRow>
              rowKey={(r) => `${r.number}:${r.fingerprint}`}
              loading={loading}
              dataSource={visibleRows}
              scroll={{ x: 1200 }}
              pagination={{
                pageSize: PAGE_SIZE,
                showSizeChanger: false,
                showTotal: (total) => `共 ${total} 条`,
              }}
              columns={[
                {
                  title: '级别',
                  width: 96,
                  render: (_, r) => <SeverityBadge severity={(r.severity || '').toLowerCase()} />,
                },
                {
                  title: '位置',
                  width: 260,
                  render: (_, r) => (
                    <div>
                      <span className="mono meta-sm">
                        {r.file ? `${r.file}:${r.line ?? 0}` : '—'}
                      </span>
                      {r.plugin && (
                        <div>
                          <Typography.Text type="secondary" className="meta-sm">
                            插件：{r.plugin}
                          </Typography.Text>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  title: '意见',
                  render: (_, r) => (
                    <Typography.Paragraph
                      style={{ marginBottom: 0, maxWidth: 460 }}
                      ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}
                    >
                      {r.comment || '—'}
                    </Typography.Paragraph>
                  ),
                },
                {
                  title: 'PR',
                  width: 80,
                  render: (_, r) => <span className="mono">#{r.number}</span>,
                },
                {
                  title: '出现',
                  width: 96,
                  render: (_, r) => (
                    <Tooltip title={`历史被反思环节剔除 ${r.regret_count ?? 0} 次`}>
                      <span>{r.times_seen ?? 0} 次</span>
                    </Tooltip>
                  ),
                },
                { title: '最近出现', width: 110, render: (_, r) => fmtAgo(r.last_seen_at) },
                {
                  title: '状态',
                  width: 150,
                  render: (_, r) => (
                    <Space size={4} wrap>
                      <span
                        className={r.status === 'suppressed' ? 'sev sev-info' : 'sev sev-success'}
                      >
                        {r.status === 'suppressed' ? '已抑制' : '未抑制'}
                      </span>
                      {/* 增量重审（G1）：本轮是否复现。stale≠已修复，只表示「没再看到」。 */}
                      {r.status !== 'suppressed' && r.staleness === 'stale' && (
                        <Tooltip
                          title={`最近一轮未复现；上次复现于提交 ${r.anchor_sha || '未知'}。可能是已修复，也可能不在本轮改动范围，请人工确认。`}
                        >
                          <span className="sev sev-attention">本轮未复现</span>
                        </Tooltip>
                      )}
                    </Space>
                  ),
                },
                {
                  title: '操作',
                  width: 110,
                  render: (_, r) => {
                    if (!canWrite) {
                      return (
                        <Tooltip title="抑制/恢复需要 admin 档 token">
                          <Typography.Text type="secondary" className="meta-sm">
                            只读
                          </Typography.Text>
                        </Tooltip>
                      )
                    }
                    return r.status === 'suppressed' ? (
                      <Popconfirm
                        title="恢复该意见？"
                        description="下一轮审查起重新出现在报告中。"
                        okText="恢复"
                        cancelText="取消"
                        onConfirm={() => restore(r)}
                      >
                        <Button size="small" icon={<UndoOutlined />}>
                          恢复
                        </Button>
                      </Popconfirm>
                    ) : (
                      <Popconfirm
                        title="抑制该意见？"
                        description="后续轮次自动从报告/评论中剔除；误抑制可用同页恢复。"
                        okText="抑制"
                        okButtonProps={{ danger: true }}
                        cancelText="取消"
                        onConfirm={() => suppress(r)}
                      >
                        <Button size="small" danger icon={<DeleteOutlined />}>
                          抑制
                        </Button>
                      </Popconfirm>
                    )
                  },
                },
              ]}
            />
          </Panel>
        </>
      )}
    </div>
  )
}
