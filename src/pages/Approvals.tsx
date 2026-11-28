import { useState } from 'react'
import { App, Button, Input, Modal, Popconfirm, Space, Table, Tag, Typography } from 'antd'
import { CheckOutlined, CloseOutlined, SearchOutlined } from '@ant-design/icons'
import { useSearchParams } from '@umijs/max'
import { api, errMsg, isApiError, type FixTicket, type TaskRow } from '../api/client'
import { Panel, SeverityBadge, StatusDot, LoadError } from '../components/Widgets'
import RepoPicker, { useConsoleOptions, type Coords } from '../components/RepoPicker'
import RecentTaskPicker from '../components/RecentTaskPicker'
import PRPicker from '../components/PRPicker'
import { PermissionBanners, useCanDecide } from '../components/PermissionBanners'
import { useDeepLink } from '../hooks/useDeepLink'
import { useApi } from '../hooks/useApi'
import { fmtTime } from '../constants/vocab'
import { t } from '../theme/tokens'

/** 审批票状态文案（值域以 FixTicket.status 为准；色档由 StatusDot 表达）。 */
const STATUS_TEXT: Record<string, string> = {
  approved: '已批准',
  rejected: '已拒绝',
  stale: '已过期（head 变更）',
  pending: '待裁决',
}

export default function Approvals() {
  const { message } = App.useApp()
  /** 业务裁定面：maintainer / 静态超管 token；平台 admin 刻意无此权限。 */
  const canDecide = useCanDecide()
  const [params] = useSearchParams()
  const opts = useConsoleOptions()
  const [forbidden, setForbidden] = useState(false)
  // 首帧坐标预填（部分深链只带三元组时先亮在选择条上；完整坐标由 useDeepLink 自动查询）。
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

  const {
    data,
    loading,
    errorText,
    run: runQuery,
  } = useApi((c: Coords, n: number) => api.listFixApprovals({ ...c, number: String(n) }), {
    manual: true,
    errorFallback: '查询失败',
    onError: (e) => {
      if (isApiError(e) && e.status === 403) {
        setForbidden(true)
        message.warning('无业务裁定权限：当前账号不能查询/裁决审批票')
      }
    },
  })
  const tickets = data?.tickets ?? []
  // 待裁决数：后端 pending_count 是「当前 head」口径，head 未解析时返回 0；
  // 列表里明明有 pending 票时以列表实数为准（避免 0 与红点票自相矛盾）。
  const pending =
    (data?.pending_count ?? 0) || tickets.filter((row) => row.status === 'pending').length
  /** 加载失败原因（常驻；否则失败看起来像「暂无数据」）。403 走权限横幅 + toast，不进 LoadError。 */
  const loadErr = forbidden ? '' : errorText

  const query = (c: Coords = coords, n: number | null = number) => {
    if (!c.platform || !c.owner || !c.repo || !n) {
      message.warning('请完整选择仓库并填写 PR 号')
      return
    }
    setForbidden(false)
    void runQuery(c, n)
  }

  const { run: decide } = useApi(
    (id: string, decision: 'approved' | 'rejected', reason: string) =>
      api.decideFixApproval({ id, decision, reason }),
    {
      manual: true,
      onSuccess: (r, [, decision]) => {
        message.success(r.message || (decision === 'approved' ? '已批准' : '已拒绝'))
        void query()
      },
      onError: (e) => message.error(errMsg(e, '裁决失败')),
    },
  )

  /** 从最近任务载入坐标（审批页最常见的入口：任务详情跳转同理）。 */
  const pickTask = (task: TaskRow) => {
    const c: Coords = {
      platform: task.platform || '',
      owner: task.owner || '',
      repo: task.repo || '',
    }
    const n = Number(task.number) || null
    setCoords(c)
    setNumber(n)
    void query(c, n)
  }

  // 深链自动执行（与 FixPush 页同语义）：带完整坐标即自动查询；同路由换参数也重跑。
  useDeepLink((c, n) => {
    setCoords(c)
    setNumber(n)
    void query(c, n)
  })

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        修复审批
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        critical / high 级修复需要逐票批准；缺票视为未批准，head 变更后旧票自动过期。
      </Typography.Paragraph>

      <PermissionBanners canDecide={canDecide} forbidden={forbidden} />

      <Panel style={{ marginBottom: t.space.lg }}>
        <Space orientation="vertical" size={t.space.md} style={{ width: '100%' }}>
          <RecentTaskPicker onPick={pickTask} disabled={!canDecide} />
          <Space wrap size={t.space.md}>
            <RepoPicker value={coords} onChange={setCoords} disabled={!canDecide} />
            <PRPicker
              coords={coords}
              value={number}
              style={{ width: 170 }}
              disabled={!canDecide}
              onChange={(v) => setNumber(v ?? null)}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              loading={loading}
              disabled={!canDecide}
              onClick={() => query()}
            >
              查询审批票
            </Button>
          </Space>
        </Space>
      </Panel>

      <LoadError error={loadErr} onRetry={() => void query()} />

      <Panel
        title={
          <span>
            票列表 <Tag>待裁决 {pending}</Tag>
          </span>
        }
      >
        <Table<FixTicket>
          rowKey="id"
          loading={loading}
          dataSource={tickets}
          scroll={{ x: 900 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条`,
          }}
          columns={[
            {
              title: 'ID',
              dataIndex: 'id',
              width: 130,
              render: (v: string) => <span className="mono t-xs">{v.slice(0, 14)}</span>,
            },
            {
              title: '指纹',
              dataIndex: 'print',
              width: 130,
              render: (v: string) => <span className="mono t-xs">{(v || '').slice(0, 12)}</span>,
            },
            {
              title: '级别',
              dataIndex: 'severity',
              width: 100,
              render: (v: string) => <SeverityBadge severity={v} />,
            },
            { title: '文件', dataIndex: 'file', ellipsis: true },
            {
              title: '状态',
              dataIndex: 'status',
              width: 150,
              render: (s: string) => (
                <Space size={t.space.sm}>
                  <StatusDot status={s} withLabel={false} />
                  <Tag>{STATUS_TEXT[s] || s}</Tag>
                </Space>
              ),
            },
            {
              title: '创建时间',
              dataIndex: 'created_at',
              width: 150,
              render: (v: number) => <span className="mono t-xs">{fmtTime(v)}</span>,
            },
            {
              title: '操作',
              width: 180,
              render: (_, ticket) => {
                if (ticket.status !== 'pending') {
                  return (
                    <span className="meta-sm">
                      {ticket.reason || STATUS_TEXT[ticket.status] || ticket.status}
                    </span>
                  )
                }
                if (!canDecide) {
                  return <span className="meta-sm">无裁定权限</span>
                }
                return (
                  <Space>
                    <Popconfirm
                      title="批准该修复票？"
                      description="批准后该修复可进入受控推送；head 变更后本票自动过期。"
                      okText="批准"
                      cancelText="取消"
                      onConfirm={() => decide(ticket.id, 'approved', '工作台批准')}
                    >
                      <Button size="small" type="primary" icon={<CheckOutlined />}>
                        批准
                      </Button>
                    </Popconfirm>
                    <Button
                      size="small"
                      danger
                      icon={<CloseOutlined />}
                      onClick={() => {
                        setRejecting(ticket)
                        setRejectReason('工作台拒绝')
                      }}
                    >
                      拒绝
                    </Button>
                  </Space>
                )
              },
            },
          ]}
        />
      </Panel>

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
        <Typography.Paragraph type="secondary" className="meta-sm">
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
