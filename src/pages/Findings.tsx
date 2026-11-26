import { useEffect, useRef, useState } from 'react'
import {
  App, AutoComplete, Button, Card, Col, Empty, Popconfirm, Row, Segmented, Select, Space,
  Statistic, Table, Tag, Tooltip, Typography,
} from 'antd'
import {
  BugOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined, UndoOutlined,
} from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { api, type FindingRow, type TaskRow } from '../api/client'
import RepoPicker, { useConsoleOptions, type Coords } from '../components/RepoPicker'
import RecentTaskPicker from '../components/RecentTaskPicker'
import { SEVERITY_COLOR, SEVERITY_OPTIONS, fmtAgo } from '../constants/vocab'
import { useAuth } from '../auth/AuthContext'

/** 分布展示的固定顺序（未知级别归 other）。 */
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'other']

const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '未抑制', value: 'open' },
  { label: '已抑制', value: 'suppressed' },
]

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
  const [rows, setRows] = useState<FindingRow[]>([])
  const [counts, setCounts] = useState<{ total: number; open: number; suppressed: number } | null>(null)
  const [sevCounts, setSevCounts] = useState<Record<string, number>>({})
  const [topFiles, setTopFiles] = useState<{ file: string; total: number; suppressed: number }[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = async (c: Coords = coords, st = status) => {
    if (!c.platform || !c.owner || !c.repo) {
      message.warning('请完整选择平台、owner 与仓库')
      return
    }
    setLoading(true)
    try {
      const res = await api.listFindings({
        platform: c.platform, owner: c.owner, repo: c.repo,
        status: st || undefined,
        limit: 200,
      })
      setRows(res?.findings ?? [])
      setCounts(res?.counts ?? null)
      setSevCounts(res?.severity_counts ?? {})
      setTopFiles(res?.top_files ?? [])
      setLoaded(true)
    } catch (e: any) {
      message.error(e?.message || '查询失败（需要 read 档 token 且仓库在授权范围内）')
    } finally {
      setLoading(false)
    }
  }

  // 从任务详情/质量运营跳转（带 platform/owner/repo）自动加载；同路由换参数也重跑。
  const deepLink = params.toString()
  const lastDeepLink = useRef('')
  useEffect(() => {
    if (!deepLink || deepLink === lastDeepLink.current) return
    lastDeepLink.current = deepLink
    const p = params.get('platform')
    const o = params.get('owner')
    const r = params.get('repo')
    if (p && o && r) {
      const c = { platform: p, owner: o, repo: r }
      setCoords(c)
      void load(c, '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink])

  // 切换状态过滤：已加载过仓库则立即重查（未加载时只更新选择）
  useEffect(() => {
    if (loaded) void load(coords, status)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const pickTask = (t: TaskRow) => {
    const c: Coords = { platform: t.platform || '', owner: t.owner || '', repo: t.repo || '' }
    setCoords(c)
    void load(c, status)
  }

  const suppress = async (row: FindingRow) => {
    try {
      const res = await api.suppressFinding({
        platform: row.platform, owner: row.owner, repo: row.repo,
        number: row.number, fingerprint: row.fingerprint,
      })
      message.success(res.matched ? '已抑制（下一轮审查起不再上报）' : '已登记抑制（下轮起生效）')
      await load()
    } catch (e: any) {
      message.error(e?.message || '抑制失败（需要 admin 档 token 且仓库在授权范围内）')
    }
  }

  const restore = async (row: FindingRow) => {
    try {
      const res = await api.restoreFinding({
        platform: row.platform, owner: row.owner, repo: row.repo,
        number: row.number, fp: row.fingerprint,
      })
      if (res.matched) message.success('已恢复（下一轮审查起重新可见）')
      else message.warning('未找到该指纹的抑制记录')
      await load()
    } catch (e: any) {
      message.error(e?.message || '恢复失败（需要 admin 档 token）')
    }
  }

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
        <BugOutlined style={{ marginRight: 8 }} />
        意见治理
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        跨 PR 浏览已上报意见的指纹账本：抑制误报后，后续轮次自动从报告与评论中剔除；恢复后下一轮重新可见。
      </Typography.Paragraph>

      {/* 仓库选择条 */}
      <Card className="glass" style={{ marginBottom: 16 }}>
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <RecentTaskPicker onPick={pickTask} />
          <Space wrap size={10}>
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
              <Button icon={<ReloadOutlined />} onClick={() => load()}>刷新</Button>
            )}
          </Space>
        </Space>
      </Card>

      {!loaded && (
        <Empty description="选择仓库并加载意见清单" style={{ margin: '64px 0' }} />
      )}

      {loaded && (
        <>
          {/* 计数卡 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={8}>
              <Card className="glass" size="small"><Statistic title="指纹总数" value={counts?.total ?? 0} /></Card>
            </Col>
            <Col xs={8}>
              <Card className="glass" size="small">
                <Statistic title="未抑制" value={counts?.open ?? 0}
                  styles={{ content: { color: counts?.open ? '#f0b429' : undefined } }} />
              </Card>
            </Col>
            <Col xs={8}>
              <Card className="glass" size="small"><Statistic title="已抑制" value={counts?.suppressed ?? 0} /></Card>
            </Col>
          </Row>

          {/* 分布与噪声文件 */}
          {(Object.keys(sevCounts).length > 0 || topFiles.length > 0) && (
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col xs={24} md={10}>
                <Card className="glass" size="small" title="严重度分布">
                  <Space wrap>
                    {SEVERITY_ORDER.filter((k) => sevCounts[k]).map((k) => (
                      <Tag key={k} color={SEVERITY_COLOR[k] || 'default'}>
                        {k.toUpperCase()} {sevCounts[k]}
                      </Tag>
                    ))}
                  </Space>
                </Card>
              </Col>
              <Col xs={24} md={14}>
                <Card
                  className="glass"
                  size="small"
                  title="高频噪声文件"
                  extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>点击文件名筛选</Typography.Text>}
                >
                  {topFiles.length === 0 ? (
                    <Typography.Text type="secondary">暂无</Typography.Text>
                  ) : topFiles.map((f) => (
                    <div
                      key={f.file}
                      onClick={() => setKw(f.file)}
                      style={{ display: 'flex', gap: 8, cursor: 'pointer', padding: '3px 0' }}
                    >
                      <Typography.Text className="mono" style={{ fontSize: 12, flex: 1 }} ellipsis>
                        {f.file}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        共 {f.total} · 抑制 {f.suppressed}
                      </Typography.Text>
                    </div>
                  ))}
                </Card>
              </Col>
            </Row>
          )}

          <Card
            className="glass"
            size="small"
            title="意见指纹清单"
            extra={(
              <Space wrap size={8}>
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
                    String(opt?.value ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  onChange={(v: string) => setKw(v)}
                />
              </Space>
            )}
          >
            {(() => {
              const expected = status === 'open' ? counts?.open
                : status === 'suppressed' ? counts?.suppressed
                  : counts?.total
              if (!counts || (expected ?? 0) <= rows.length) return null
              return (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  仅显示最近 {rows.length} 条（共 {expected} 条）；可用状态过滤缩小范围。
                </Typography.Text>
              )
            })()}
            <Table<FindingRow>
              rowKey={(r) => `${r.number}:${r.fingerprint}`}
              loading={loading}
              dataSource={visibleRows}
              pagination={{ pageSize: 20, showSizeChanger: false }}
              columns={[
                {
                  title: '级别', width: 96,
                  render: (_, r) => (
                    <Tag color={SEVERITY_COLOR[(r.severity || '').toLowerCase()] || 'default'}>
                      {(r.severity || '—').toUpperCase()}
                    </Tag>
                  ),
                },
                {
                  title: '位置', width: 260,
                  render: (_, r) => (
                    <div>
                      <span className="mono" style={{ fontSize: 12 }}>
                        {r.file ? `${r.file}:${r.line ?? 0}` : '—'}
                      </span>
                      {r.plugin && (
                        <div><Typography.Text type="secondary" style={{ fontSize: 11 }}>插件：{r.plugin}</Typography.Text></div>
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
                { title: 'PR', width: 80, render: (_, r) => <span className="mono">#{r.number}</span> },
                {
                  title: '出现', width: 96,
                  render: (_, r) => (
                    <Tooltip title={`历史被反思环节剔除 ${r.regret_count ?? 0} 次`}>
                      <span>{r.times_seen ?? 0} 次</span>
                    </Tooltip>
                  ),
                },
                { title: '最近出现', width: 110, render: (_, r) => fmtAgo(r.last_seen_at) },
                {
                  title: '状态', width: 100,
                  render: (_, r) => (
                    <Tag color={r.status === 'suppressed' ? 'default' : 'green'}>
                      {r.status === 'suppressed' ? '已抑制' : '未抑制'}
                    </Tag>
                  ),
                },
                {
                  title: '操作', width: 110,
                  render: (_, r) => {
                    if (!canWrite) {
                      return (
                        <Tooltip title="抑制/恢复需要 admin 档 token">
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>只读</Typography.Text>
                        </Tooltip>
                      )
                    }
                    return r.status === 'suppressed' ? (
                      <Popconfirm
                        title="恢复该意见？"
                        description="下一轮审查起重新出现在报告中。"
                        okText="恢复" cancelText="取消"
                        onConfirm={() => restore(r)}
                      >
                        <Button size="small" icon={<UndoOutlined />}>恢复</Button>
                      </Popconfirm>
                    ) : (
                      <Popconfirm
                        title="抑制该意见？"
                        description="后续轮次自动从报告/评论中剔除；误抑制可用同页恢复。"
                        okText="抑制" okButtonProps={{ danger: true }} cancelText="取消"
                        onConfirm={() => suppress(r)}
                      >
                        <Button size="small" danger icon={<DeleteOutlined />}>抑制</Button>
                      </Popconfirm>
                    )
                  },
                },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  )
}