import { useState } from 'react'
import { App, Button, Form, Input, Select, Space, Table, Tag, Typography } from 'antd'
import { UserAddOutlined, CopyOutlined, LinkOutlined } from '@ant-design/icons'
import { api, errMsg, type InviteRow, type MemberRow } from '../api/client'
import { fmtTime } from '../constants/vocab'
import { useAuth } from '../auth/AuthContext'
import { useApi } from '../hooks/useApi'
import { Panel } from '../components/Widgets'
import { t } from '../theme/tokens'

const ROLE_OPTIONS = [
  { value: 'viewer', label: 'viewer — 只读' },
  { value: 'auditor', label: 'auditor — 只读 + 审计' },
  { value: 'operator', label: 'operator — 可创建审查任务' },
  { value: 'maintainer', label: 'maintainer — 审批 / 合并 / 推送' },
]

/** 有效期预设（小时）；邀请默认 3 天。 */
const TTL_OPTIONS = [
  { value: 24, label: '1 天' },
  { value: 72, label: '3 天' },
  { value: 168, label: '7 天' },
  { value: 720, label: '30 天' },
]

/** 角色展示文案（值域以 storage 角色常量为准，此处仅展示）。 */
const ROLE_LABEL: Record<string, string> = {
  viewer: '只读',
  auditor: '审计',
  operator: '可建任务',
  maintainer: '审批 / 合并',
  admin: '管理员',
}

/** 邀请状态标签（服务端派生 pending|used|expired；点 + 文案，不用彩色 Tag）。 */
const INVITE_STATUS: Record<string, { text: string; dot: string }> = {
  pending: { text: '待接受', dot: 'run' },
  used: { text: '已使用', dot: 'ok' },
  expired: { text: '已过期', dot: 'mute' },
}

interface InviteResult {
  invite_id: string
  token: string
  role: string
  expires_at: number
}

interface CreateInviteValues {
  role: string
  username?: string
  ttl_hours: number
}

/** 角色徽章：中文名 + 原始值（中性 Tag，语义色由文本层级表达）。 */
function RoleTag({ role }: { role: string }) {
  return (
    <Tag>
      {ROLE_LABEL[role] || role}
      <Typography.Text type="secondary"> · {role}</Typography.Text>
    </Tag>
  )
}

/** 邀请状态（StatusDot 视觉语言，标签为邀请语境）。 */
function InviteStatusDot({ status }: { status: string }) {
  const st = INVITE_STATUS[status] || { text: status, dot: 'mute' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
      <span className={`dot ${st.dot}`} />
      <span className="t-sm">{st.text}</span>
    </span>
  )
}

export default function Invites() {
  const { can, user } = useAuth()
  const { message } = App.useApp()
  const [result, setResult] = useState<InviteResult | null>(null)
  const [form] = Form.useForm()
  const [inviteStatus, setInviteStatus] = useState('')

  const allowed = !user?.permissions || can('manage_membership')

  const {
    data: members = [],
    loading: membersLoading,
    errorText: membersErr,
    refresh: loadMembers,
  } = useApi(
    async () => {
      if (!allowed) return []
      const res = await api.members()
      return res?.members ?? []
    },
    { refreshDeps: [allowed], errorFallback: '成员清单加载失败' },
  )

  const {
    data: invites = [],
    loading: invitesLoading,
    errorText: invitesErr,
    refresh: loadInvites,
  } = useApi(
    async () => {
      if (!allowed) return []
      const res = await api.inviteHistory()
      return res?.invites ?? []
    },
    { refreshDeps: [allowed], errorFallback: '邀请历史加载失败' },
  )

  const visibleInvites = inviteStatus ? invites.filter((i) => i.status === inviteStatus) : invites

  const { run: onCreate, loading: busy } = useApi(
    (v: CreateInviteValues) =>
      api.createInvite({ role: v.role, username: v.username || undefined, ttl_hours: v.ttl_hours }),
    {
      manual: true,
      onSuccess: (r) => {
        setResult(r)
        form.resetFields()
        message.success('邀请已生成')
        void loadInvites()
      },
      onError: (e) => message.error(errMsg(e, '创建失败')),
    },
  )

  const acceptUrl = result ? `${window.location.origin}/accept-invite?token=${result.token}` : ''

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      message.success('已复制')
    } catch {
      message.warning('复制失败，请手动选择链接复制')
    }
  }

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        邀请成员
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        生成一次性邀请链接，新成员通过链接设置用户名与密码。管理员（admin）角色不能通过邀请授予，只能由部署侧创建。
      </Typography.Paragraph>

      {!allowed ? (
        <Panel>
          <Typography.Text type="warning">仅 admin 角色可创建邀请。</Typography.Text>
        </Panel>
      ) : (
        <Panel title="生成邀请">
          <Form form={form} layout="vertical" onFinish={onCreate} style={{ maxWidth: 420 }}>
            <Form.Item name="role" initialValue="maintainer" label="角色">
              <Select options={ROLE_OPTIONS} />
            </Form.Item>
            <Form.Item name="username" label="预定用户名（可选）">
              <Input placeholder="留空则由受邀者自行设置" />
            </Form.Item>
            <Form.Item name="ttl_hours" initialValue={72} label="有效期">
              <Select options={TTL_OPTIONS} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={busy} icon={<UserAddOutlined />}>
              生成邀请链接
            </Button>
          </Form>
        </Panel>
      )}

      {allowed && (
        <Panel
          className="section"
          title={`现有成员（${members.length}）`}
          extra={
            <Button size="small" onClick={() => void loadMembers()} loading={membersLoading}>
              刷新
            </Button>
          }
        >
          {membersErr ? (
            <Typography.Text type="danger">{membersErr}</Typography.Text>
          ) : (
            <Table<MemberRow>
              size="small"
              rowKey="username"
              loading={membersLoading}
              dataSource={members}
              pagination={false}
              scroll={{ x: 600 }}
              columns={[
                {
                  title: '用户名',
                  dataIndex: 'username',
                  render: (v: string) => <span className="mono">{v}</span>,
                },
                {
                  title: '角色',
                  dataIndex: 'role',
                  width: 160,
                  render: (v: string) => <RoleTag role={v} />,
                },
                {
                  title: '创建时间',
                  dataIndex: 'created_at',
                  width: 160,
                  render: (v: number) => <span className="mono meta-sm">{fmtTime(v)}</span>,
                },
              ]}
            />
          )}
        </Panel>
      )}

      {allowed && (
        <Panel
          className="section"
          title={`邀请历史（${visibleInvites.length}）`}
          extra={
            <Space>
              <Select
                size="small"
                style={{ width: 120 }}
                value={inviteStatus}
                onChange={setInviteStatus}
                options={[
                  { value: '', label: '全部状态' },
                  { value: 'pending', label: '待接受' },
                  { value: 'used', label: '已使用' },
                  { value: 'expired', label: '已过期' },
                ]}
              />
              <Button size="small" onClick={() => void loadInvites()} loading={invitesLoading}>
                刷新
              </Button>
            </Space>
          }
        >
          {invitesErr ? (
            <Typography.Text type="danger">{invitesErr}</Typography.Text>
          ) : (
            <Table<InviteRow>
              size="small"
              rowKey="invite_id"
              loading={invitesLoading}
              dataSource={visibleInvites}
              pagination={{
                pageSize: 20,
                showSizeChanger: false,
                showTotal: (total) => `共 ${total} 条`,
              }}
              scroll={{ x: 960 }}
              columns={[
                {
                  title: '角色',
                  dataIndex: 'role',
                  width: 150,
                  render: (v: string) => <RoleTag role={v} />,
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  width: 100,
                  render: (v: string) => <InviteStatusDot status={v} />,
                },
                {
                  title: '预定用户名',
                  dataIndex: 'username',
                  width: 140,
                  render: (v?: string) =>
                    v || <Typography.Text type="secondary">—</Typography.Text>,
                },
                {
                  title: '创建者',
                  dataIndex: 'created_by',
                  width: 120,
                  render: (v?: string) => v || '—',
                },
                {
                  title: '创建时间',
                  dataIndex: 'created_at',
                  width: 150,
                  render: (v?: number) => <span className="mono meta-sm">{fmtTime(v)}</span>,
                },
                {
                  title: '到期时间',
                  dataIndex: 'expires_at',
                  width: 150,
                  render: (v?: number) => <span className="mono meta-sm">{fmtTime(v)}</span>,
                },
                {
                  title: '使用时间',
                  dataIndex: 'used_at',
                  width: 150,
                  render: (v?: number) => (
                    <span className="mono meta-sm">{v ? fmtTime(v) : '—'}</span>
                  ),
                },
              ]}
            />
          )}
        </Panel>
      )}

      {result && (
        <Panel className="section" title="邀请已创建">
          <Space orientation="vertical" style={{ width: '100%' }} size={t.space.md}>
            <Typography.Text type="secondary" className="meta-sm">
              把下面的链接发给受邀者（只显示一次，请立即保存）：
            </Typography.Text>
            <div
              className="panel"
              style={{
                padding: t.space.md,
                display: 'flex',
                gap: t.space.sm,
                alignItems: 'center',
              }}
            >
              <LinkOutlined style={{ color: t.color.accent }} />
              <span className="mono t-xs" style={{ wordBreak: 'break-all' }}>
                {acceptUrl}
              </span>
            </div>
            <Space>
              <Button icon={<CopyOutlined />} onClick={() => copy(acceptUrl)}>
                复制邀请链接
              </Button>
              <Button type="text" icon={<CopyOutlined />} onClick={() => copy(result.token)}>
                仅复制 token
              </Button>
            </Space>
            <div style={{ display: 'grid', gap: t.space.sm, maxWidth: 520 }}>
              {(
                [
                  ['邀请 ID', result.invite_id],
                  ['角色', result.role],
                  ['到期时间', fmtTime(result.expires_at)],
                ] as const
              ).map(([k, v]) => (
                <div
                  key={k}
                  style={{ display: 'flex', justifyContent: 'space-between', gap: t.space.md }}
                >
                  <Typography.Text type="secondary" className="meta-sm">
                    {k}
                  </Typography.Text>
                  <span className="mono meta-sm">{v}</span>
                </div>
              ))}
            </div>
          </Space>
        </Panel>
      )}
    </div>
  )
}
