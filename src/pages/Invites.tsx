import { useState } from 'react'
import { Card, Form, Input, Select, Space, Tag, Typography, App, Button, List } from 'antd'
import { UserAddOutlined, CopyOutlined, LinkOutlined } from '@ant-design/icons'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'

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
      message.success('邀请已生成')
    } catch (e: any) {
      message.error(e?.message || '创建失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        邀请成员 <span className="grad-text">/ Invitations</span>
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        邀请永不授予 admin · 角色→scope：viewer/auditor=read · operator=ci · maintainer=admin
      </Typography.Paragraph>

      {!allowed ? (
        <Card className="glass">
          <Typography.Text type="warning">仅 admin 角色可创建邀请。</Typography.Text>
        </Card>
      ) : (
        <Card className="glass" title="生成邀请">
          <Form form={form} layout="vertical" onFinish={onCreate} style={{ maxWidth: 420 }}>
            <Form.Item name="role" initialValue="maintainer" label="角色">
              <Select
                options={[
                  { value: 'viewer', label: 'viewer — 只读' },
                  { value: 'auditor', label: 'auditor — 只读' },
                  { value: 'operator', label: 'operator — 可建任务' },
                  { value: 'maintainer', label: 'maintainer — 审批 / 合并' },
                ]}
              />
            </Form.Item>
            <Form.Item name="username" label="预定用户名（可选）">
              <Input />
            </Form.Item>
            <Form.Item name="ttl_hours" initialValue={72} label="有效期（小时）">
              <Input type="number" min={1} max={720} />
            </Form.Item>
            <Button type="primary" htmlType="submit" className="glow-btn" loading={busy} icon={<UserAddOutlined />}>
              生成邀请 token
            </Button>
          </Form>
        </Card>
      )}

      {result && (
        <Card className="glass" style={{ marginTop: 16 }} title="邀请已创建">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Tag color="cyan" icon={<LinkOutlined />}>
              {window.location.origin}/accept-invite?token={result.token}
            </Tag>
            <Button icon={<CopyOutlined />} onClick={() => navigator.clipboard?.writeText(result.token)}>
              复制 token
            </Button>
            <List
              size="small"
              dataSource={[
                ['invite_id', result.invite_id],
                ['role', result.role],
                ['expires', new Date((result.expires_at || 0) * 1000).toISOString()],
              ]}
              renderItem={([k, v]) => (
                <List.Item>
                  <span style={{ opacity: 0.6 }}>{k}</span>
                  <span className="mono">{v}</span>
                </List.Item>
              )}
            />
          </Space>
        </Card>
      )}
    </div>
  )
}
