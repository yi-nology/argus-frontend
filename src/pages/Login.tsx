import { useState } from 'react'
import { Button, Form, Input, Typography, App } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const { message } = App.useApp()
  const [busy, setBusy] = useState(false)
  const invite = sp.get('invite') || ''

  const onFinish = async (v: { username: string; password: string }) => {
    setBusy(true)
    try {
      await login(v.username.trim(), v.password)
      message.success('登录成功')
      nav('/dashboard')
    } catch (e: any) {
      message.error(e?.message || '登录失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Typography.Title level={3} style={{ marginBottom: 4, letterSpacing: 1 }}>
            Argus
          </Typography.Title>
          <Typography.Text type="secondary">代码审查工作台</Typography.Text>
        </div>

        <div className="glass" style={{ padding: '24px 24px 12px' }}>
          {invite && (
            <Typography.Paragraph type="warning" style={{ fontSize: 12 }}>
              检测到邀请链接，请先在「接受邀请」页创建账号。
            </Typography.Paragraph>
          )}
          <Form layout="vertical" onFinish={onFinish} size="large">
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input prefix={<UserOutlined />} placeholder="用户名" autoComplete="username" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="密码"
                autoComplete="current-password"
              />
            </Form.Item>
            <Button block type="primary" htmlType="submit" loading={busy}>
              登录
            </Button>
          </Form>
          <Button
            type="link"
            block
            onClick={() => nav('/accept-invite' + (invite ? `?token=${invite}` : ''))}
          >
            使用邀请链接注册
          </Button>
        </div>
      </div>
    </div>
  )
}