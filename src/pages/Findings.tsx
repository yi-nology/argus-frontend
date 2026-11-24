import { useEffect, useState } from 'react'
import {
  App, Button, Card, Col, Empty, Input, Popconfirm, Row, Segmented, Select, Space,
  Statistic, Table, Tag, Tooltip, Typography,
} from 'antd'
import {
  BugOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined, UndoOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { api, type FindingRow } from '../api/client'
import { PLATFORMS } from '../constants/platforms'

/** 级别配色（critical 最高；与报告渲染的严重度词表一致）。 */
const SEVERITY_COLOR: Record<string, string> = {
  critical: 'magenta', high: 'red', medium: 'orange', low: 'blue',
}

const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '未抑制', value: 'open' },
  { label: '已抑制', value: 'suppressed' },
]

function fmtTime(unix?: number): string {
  if (!unix) return '—'
  return dayjs.unix(unix).format('MM-DD HH:mm')
}

/**
 * 意见治理台（v8.5.0）：跨 PR 浏览 finding_prints，人工抑制误报 / 恢复。
 * 抑制是信任边界写操作（后端 admin 档 + 仓库维度判定）；清单 read 档即可。
 */
export default function Findings() {
  const { message } = App.useApp()
  const [platform, setPlatform] = useState('gitlab')
  const [owner, setOwner] = useState('')
  const [repo, setRepo] = useState('')
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<FindingRow[]>([])
  const [counts, setCounts] = useState<{ total: number; open: number; suppressed: number } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = async (p = platform, o = owner, r = repo, st = status) => {
    if (!o || !r) {
      message.warning('请填写 owner 与 repo')
      return
    }
    setLoading(true)
    try {
      const res = await api.listFindings({
        platform: p, owner: o, repo: r,
        status: st || undefined,
        limit: 200,
      })
      setRows(res?.findings ?? [])
      setCounts(res?.counts ?? null)
      setLoaded(true)
    } catch (e: any) {
      message.error(e?.message || '查询失败（需要 read 档 token 且仓库在授权范围内）')
    } finally {
      setLoading(false)
    }
  }

  // 切换状态过滤：已加载过仓库则立即重查（未加载时只更新选择）
  useEffect(() => {
    if (loaded) load(platform, owner, repo, status)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

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

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        <BugOutlined /> 意见治理
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        跨 PR 浏览已上报意见的指纹账本：抑制误报后，后续轮次在合并/报告阶段自动剔除；
        恢复后下一轮重新可见。抑制与恢复都需要 <strong>admin 档 token</strong>。
      </Typography.Paragraph>

      {/* 仓库选择条 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap size={12}>
          <Select
            value={platform}
            style={{ width: 150 }}
            onChange={(v) => { setPlatform(v); setLoaded(false) }}
            options={PLATFORMS.map((p) => ({ label: p, value: p }))}
          />
          <Input
            placeholder="owner / 组织"
            style={{ width: 180 }}
            value={owner}
            onChange={(e) => { setOwner(e.target.value); setLoaded(false) }}
          />
          <span style={{ color: '#666' }}>/</span>
          <Input
            placeholder="仓库名"
            style={{ width: 200 }}
            value={repo}
            onChange={(e) => { setRepo(e.target.value); setLoaded(false) }}
            onPressEnter={() => load()}
          />
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={() => load()}>
            加载意见
          </Button>
          {loaded && (
            <Button icon={<ReloadOutlined />} onClick={() => load()}>刷新</Button>
          )}
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
              <Card size="small"><Statistic title="指纹总数" value={counts?.total ?? 0} /></Card>
            </Col>
            <Col xs={8}>
              <Card size="small">
                <Statistic title="未抑制" value={counts?.open ?? 0}
                  valueStyle={{ color: counts?.open ? '#fbbf24' : undefined }} />
              </Card>
            </Col>
            <Col xs={8}>
              <Card size="small"><Statistic title="已抑制" value={counts?.suppressed ?? 0} /></Card>
            </Col>
          </Row>

          <Card
            size="small"
            title="意见指纹清单"
            extra={(
              <Segmented
                value={status}
                onChange={(v) => setStatus(v as string)}
                options={STATUS_OPTIONS}
              />
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
              dataSource={rows}
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
                    <Tooltip title={`历史被 R3.5 反思剔除 ${r.regret_count ?? 0} 次`}>
                      <span>{r.times_seen ?? 0} 次</span>
                    </Tooltip>
                  ),
                },
                { title: '最近出现', width: 120, render: (_, r) => fmtTime(r.last_seen_at) },
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
                  render: (_, r) => (
                    r.status === 'suppressed' ? (
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
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  )
}