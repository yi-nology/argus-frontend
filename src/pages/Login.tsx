import { useState } from 'react'
import { Button, Form, Input, Typography, App } from 'antd'
import { LockOutlined, UserOutlined, ThunderboltOutlined } from '@ant-design/icons'
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
      message.success('欢迎回来')
      nav('/dashboard')
    } catch (e: any) {
      message.error(e?.message || '登录失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <ThunderboltOutlined style={{ fontSize: 44, color: '#5b8def' }} />
          <Typography.Title level={2} style={{ marginTop: 8, marginBottom: 0 }}>
            <span className="grad-text">ARGUS</span>
          </Typography.Title>
          <Typography.Text type="secondary">受控变更审查工作台</Typography.Text>
        </div>

        <div className="gradient-border">
          <div className="inner">
            {invite && (
              <Typography.Paragraph type="warning" style={{ fontSize: 12 }}>
                检测到邀请链接，请先在「接受邀请」页建号。
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
              <Button block htmlType="submit" className="glow-btn" loading={busy}>
                登录工作台
              </Button>
            </Form>
            <Button
              type="link"
              block
              onClick={() => nav('/accept-invite' + (invite ? `?token=${invite}` : ''))}
            >
              使用邀请码注册
            </Button>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              首管引导：ARGUS_BOOTSTRAP_ADMIN_USER / PASS · 邀请永不授予 admin
            </Typography.Text>
          </div>
        </div>
      </div>
    </div>
  )
}
