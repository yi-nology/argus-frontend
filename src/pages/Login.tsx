import { Button, Form, Input, Typography, App } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from '@umijs/max'
import { useAuth } from '../auth/AuthContext'
import { errMsg } from '../api/client'
import { useApi } from '../hooks/useApi'
import { t } from '../theme/tokens'

/** 居中登录卡宽度（与 AcceptInvite 同节奏）。 */
const CARD_MAX_W = 400

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const { message } = App.useApp()
  const invite = sp.get('invite') || ''

  const { run: submit, loading: busy } = useApi(login, {
    manual: true,
    onSuccess: () => {
      message.success('登录成功')
      nav('/dashboard')
    },
    onError: (e) => message.error(errMsg(e, '登录失败')),
  })

  const onFinish = (v: { username: string; password: string }) => {
    void submit(v.username.trim(), v.password)
  }

  return (
    <div
      style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: t.space.xxl }}
    >
      <div style={{ width: '100%', maxWidth: CARD_MAX_W }}>
        <div style={{ textAlign: 'center', marginBottom: t.space.xxl }}>
          <Typography.Title level={3} style={{ marginBottom: t.space.xs }}>
            Argus
          </Typography.Title>
          <Typography.Text type="secondary">代码审查工作台</Typography.Text>
        </div>

        <div
          className="panel"
          style={{ padding: `${t.space.xxl}px ${t.space.xxl}px ${t.space.md}px` }}
        >
          {invite && (
            <Typography.Paragraph type="warning" className="t-xs">
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
