import { useState } from 'react'
import { Card, Form, Input, Select, Space, Tag, Typography, App, Button } from 'antd'
import { UserAddOutlined, CopyOutlined, LinkOutlined } from '@ant-design/icons'
import { api } from '../api/client'
import { fmtTime } from '../constants/vocab'
import { useAuth } from '../auth/AuthContext'

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

export default function Invites() {
  const { can, user } = useAuth()
  const { message } = App.useApp()
  const [result, setResult] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [form] = Form.useForm()

  const allowed = !user?.permissions || can('manage_membership')

  const onCreate = async (v: any) => {
    setBusy(true)
    try {
      const r = await api.createInvite({
        role: v.role,
        username: v.username || undefined,
        ttl_hours: v.ttl_hours,
      })
      setResult(r)
      form.resetFields()
      message.success('邀请已生成')
    } catch (e: any) {
      message.error(e?.message || '创建失败')
    } finally {
      setBusy(false)
    }
  }

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
        <Card className="glass">
          <Typography.Text type="warning">仅 admin 角色可创建邀请。</Typography.Text>
        </Card>
      ) : (
        <Card className="glass" title="生成邀请">
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
        </Card>
      )}

      {result && (
        <Card className="glass" style={{ marginTop: 16 }} title="邀请已创建">
          <Space orientation="vertical" style={{ width: '100%' }} size={12}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              把下面的链接发给受邀者（只显示一次，请立即保存）：
            </Typography.Text>
            <Tag color="blue" icon={<LinkOutlined />} style={{ whiteSpace: 'normal', wordBreak: 'break-all', padding: '6px 10px' }}>
              {acceptUrl}
            </Tag>
            <Space>
              <Button icon={<CopyOutlined />} onClick={() => copy(acceptUrl)}>
                复制邀请链接
              </Button>
              <Button type="text" icon={<CopyOutlined />} onClick={() => copy(result.token)}>
                仅复制 token
              </Button>
            </Space>
            <div style={{ display: 'grid', gap: 6, maxWidth: 520 }}>
              {([
                ['邀请 ID', result.invite_id],
                ['角色', result.role],
                ['到期时间', fmtTime(result.expires_at)],
              ] as const).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ opacity: 0.6, fontSize: 12 }}>{k}</span>
                  <span className="mono" style={{ fontSize: 12 }}>{v}</span>
                </div>
              ))}
            </div>
          </Space>
        </Card>
      )}
    </div>
  )
}