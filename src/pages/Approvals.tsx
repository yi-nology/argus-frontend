import { useEffect, useRef, useState } from 'react'
import {
  Alert, App, Button, Card, Input, InputNumber, Modal, Popconfirm, Space, Table, Tag, Typography,
} from 'antd'
import { CheckOutlined, CloseOutlined, SearchOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { api, type FixTicket, type TaskRow } from '../api/client'
import { StatusDot } from '../components/Widgets'
import RepoPicker, { useConsoleOptions, type Coords } from '../components/RepoPicker'
import RecentTaskPicker from '../components/RecentTaskPicker'
import { fmtTime } from '../constants/vocab'
import { useAuth } from '../auth/AuthContext'

const statusColor: Record<string, string> = {
  approved: 'success', rejected: 'error', stale: 'warning', pending: 'processing',
}

const statusText: Record<string, string> = {
  approved: '已批准', rejected: '已拒绝', stale: '已过期（head 变更）', pending: '待裁决',
}

export default function Approvals() {
  const { message } = App.useApp()
  const { user, can } = useAuth()
  /** 业务裁定面：maintainer / 静态超管 token；平台 admin 刻意无此权限。 */
  const canDecide = can('decide_review')
  const [params] = useSearchParams()
  const opts = useConsoleOptions()
  const [tickets, setTickets] = useState<FixTicket[]>([])
  const [pending, setPending] = useState(0)
  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(false)
  const [coords, setCoords] = useState<Coords>({
    platform: params.get('platform') || opts?.platforms?.[0] || '',
    owner: params.get('owner') || '',
    repo: params.get('repo') || '',
  })
  const [number, setNumber] = useState<number | null>(
    params.get('number') ? Number(params.get('number')) : null,
  )
  const [rejecting, setRejecting] = useState<FixTicket | null>(null)
  const [rejectReason, setRejectReason] = useState('工作台拒绝')

  const load = async (c: Coords = coords, n: number | null = number) => {
    if (!c.platform || !c.owner || !c.repo || !n) {
      message.warning('请完整选择仓库并填写 PR 号')
      return
    }
    setLoading(true)
    setForbidden(false)
    try {
      const res = await api.listFixApprovals({
        platform: c.platform, owner: c.owner, repo: c.repo, number: String(n),
      })
      const rows = res.tickets || []
      setTickets(rows)
      // 待裁决数：后端 pending_count 是「当前 head」口径，head 未解析时返回 0；
      // 列表里明明有 pending 票时以列表实数为准（避免 0 与红点票自相矛盾）。
      setPending((res.pending_count ?? 0) || rows.filter((t) => t.status === 'pending').length)
    } catch (e: any) {
      setTickets([])
      setPending(0)
      if (e?.status === 403) {
        setForbidden(true)
        message.warning('无业务裁定权限：当前账号不能查询/裁决审批票')
      } else {
        message.error(e?.message || '查询失败')
      }
    } finally {
      setLoading(false)
    }
  }

  const decide = async (id: string, decision: 'approved' | 'rejected', reason: string) => {
    try {
      const r = await api.decideFixApproval({ id, decision, reason })
      message.success(r.message || (decision === 'approved' ? '已批准' : '已拒绝'))
      void load()
    } catch (e: any) {
      message.error(e?.message || '裁决失败')
    }
  }

  /** 从最近任务载入坐标（审批页最常见的入口：任务详情跳转同理）。 */
  const pickTask = (t: TaskRow) => {
    const c: Coords = { platform: t.platform || '', owner: t.owner || '', repo: t.repo || '' }
    const n = Number(t.number) || null
    setCoords(c)
    setNumber(n)
    void load(c, n)
  }

  // 深链自动执行（与 FixPush 页同语义）：带完整坐标即自动查询；同路由换参数也重跑。
  const deepLink = params.toString()
  const lastDeepLink = useRef('')
  useEffect(() => {
    if (!deepLink || deepLink === lastDeepLink.current) return
    lastDeepLink.current = deepLink
    const p = params.get('platform')
    const o = params.get('owner')
    const r = params.get('repo')
    const n = params.get('number')
    if (p && o && r && n) {
      const c = { platform: p, owner: o, repo: r }
      setCoords(c)
      setNumber(Number(n) || null)
      void load(c, Number(n) || null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink])

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        修复审批
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        critical / high 级修复需要逐票批准；缺票视为未批准，head 变更后旧票自动过期。
      </Typography.Paragraph>

      {!canDecide && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="当前账号无业务裁定权限"
          description={`审批属于 maintainer 角色；当前角色为 ${user?.role || '—'}。read 档仍可查看审查结果与报告。`}
        />
      )}
      {forbidden && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="审批票查询被拒绝（403）"
          description="该接口要求 admin 档 + 业务裁定角色（maintainer）。平台 admin 刻意无裁定权，防止平台管理员越权改码。"
        />
      )}

      <Card className="glass" style={{ marginBottom: 16 }}>
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <RecentTaskPicker onPick={pickTask} disabled={!canDecide} />
          <Space wrap size={10}>
            <RepoPicker value={coords} onChange={setCoords} disabled={!canDecide} />
            <InputNumber
              placeholder="PR #"
              style={{ width: 110 }}
              min={1}
              value={number}
              disabled={!canDecide}
              onChange={(v) => setNumber(v ?? null)}
              onPressEnter={() => load()}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              loading={loading}
              disabled={!canDecide}
              onClick={() => load()}
            >
              查询审批票
            </Button>
          </Space>
        </Space>
      </Card>

      <Card
        className="glass"
        title={<span>票列表 <Tag color="blue">待裁决 {pending}</Tag></span>}
      >
        <Table<FixTicket>
          rowKey="id"
          loading={loading}
          dataSource={tickets}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          columns={[
            {
              title: 'ID', dataIndex: 'id', width: 130,
              render: (v: string) => <span className="mono" style={{ fontSize: 12 }}>{v.slice(0, 14)}</span>,
            },
            {
              title: '指纹', dataIndex: 'print', width: 130,
              render: (v: string) => <span className="mono" style={{ fontSize: 12 }}>{(v || '').slice(0, 12)}</span>,
            },
            {
              title: '级别', dataIndex: 'severity', width: 100,
              render: (v: string) =>
                v === 'critical' ? <Tag color="error">critical</Tag> : <Tag color="warning">{v || '—'}</Tag>,
            },
            { title: '文件', dataIndex: 'file', ellipsis: true },
            {
              title: '状态', dataIndex: 'status', width: 150,
              render: (s: string) => (
                <span>
                  <StatusDot status={s} /> <Tag color={statusColor[s]}>{statusText[s] || s}</Tag>
                </span>
              ),
            },
            {
              title: '创建时间', dataIndex: 'created_at', width: 150,
              render: (v: number) => <span className="mono" style={{ fontSize: 12 }}>{fmtTime(v)}</span>,
            },
            {
              title: '操作', width: 180,
              render: (_, t) => {
                if (t.status !== 'pending') {
                  return <span style={{ opacity: 0.7, fontSize: 12 }}>{t.reason || statusText[t.status] || t.status}</span>
                }
                if (!canDecide) {
                  return <span style={{ opacity: 0.6, fontSize: 12 }}>无裁定权限</span>
                }
                return (
                  <Space>
                    <Popconfirm
                      title="批准该修复票？"
                      description="批准后该修复可进入受控推送；head 变更后本票自动过期。"
                      okText="批准"
                      cancelText="取消"
                      onConfirm={() => decide(t.id, 'approved', '工作台批准')}
                    >
                      <Button size="small" type="primary" icon={<CheckOutlined />}>批准</Button>
                    </Popconfirm>
                    <Button
                      size="small" danger icon={<CloseOutlined />}
                      onClick={() => { setRejecting(t); setRejectReason('工作台拒绝') }}
                    >
                      拒绝
                    </Button>
                  </Space>
                )
              },
            },
          ]}
        />
      </Card>

      <Modal
        open={!!rejecting}
        title="拒绝修复票"
        okText="确认拒绝"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        onCancel={() => setRejecting(null)}
        onOk={async () => {
          if (!rejecting) return
          await decide(rejecting.id, 'rejected', rejectReason.trim() || '工作台拒绝')
          setRejecting(null)
        }}
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          拒绝原因会记入审批票，可在票列表中回溯。
        </Typography.Paragraph>
        <Input
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="拒绝原因"
          maxLength={200}
        />
      </Modal>
    </div>
  )
}