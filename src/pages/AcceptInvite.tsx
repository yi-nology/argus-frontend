import { useState } from 'react'
import { App, Button, Form, Input, Typography } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'

export default function AcceptInvite() {
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const { message } = App.useApp()
  const [busy, setBusy] = useState(false)

  const onFinish = async (v: { token: string; username: string; password: string }) => {
    setBusy(true)
    try {
      const res = await api.acceptInvite({
        token: v.token.trim(),
        username: v.username.trim(),
        password: v.password,
      })
      message.success(`账号已创建：${res.username}（${res.role}）`)
      setTimeout(() => nav('/login'), 1200)
    } catch (e: any) {
      message.error(e?.message || '接受邀请失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="gradient-border" style={{ width: '100%', maxWidth: 440 }}>
        <div className="inner">
          <Typography.Title level={4}>接受邀请</Typography.Title>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
            邀请永不授予 admin 角色（平台管理与业务裁定分离）。
          </Typography.Paragraph>
          <Form
            layout="vertical"
            onFinish={onFinish}
            initialValues={{ token: sp.get('token') || '' }}
            size="large"
          >
            <Form.Item name="token" rules={[{ required: true, message: '邀请 token 必填' }]}>
              <Input placeholder="邀请 token" className="mono" />
            </Form.Item>
            <Form.Item name="username" rules={[{ required: true, message: '用户名必填' }]}>
              <Input placeholder="用户名" />
            </Form.Item>
            <Form.Item
              name="password"
              rules={[
                { required: true, message: '密码必填' },
                { min: 8, message: '至少 8 位' },
              ]}
            >
              <Input.Password placeholder="密码（≥8 位）" />
            </Form.Item>
            <Button block htmlType="submit" className="glow-btn" loading={busy}>
              创建账号
            </Button>
            <Button type="link" block onClick={() => nav('/login')}>
              返回登录
            </Button>
          </Form>
        </div>
      </div>
    </div>
  )
}
