import { App, Button, Form, Input, Typography } from 'antd'
import { useNavigate, useSearchParams } from '@umijs/max'
import { api, errMsg } from '../api/client'
import { useApi } from '../hooks/useApi'
import { t } from '../theme/tokens'

/** 居中注册卡宽度（与 Login 同节奏）。 */
const CARD_MAX_W = 420
/** 注册成功提示停留时长（ms），让用户看清账号名再跳登录。 */
const NAV_DELAY_MS = 1200

export default function AcceptInvite() {
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const { message } = App.useApp()

  const { run: accept, loading: busy } = useApi(api.acceptInvite, {
    manual: true,
    onSuccess: (res) => {
      message.success(`账号已创建：${res.username}（${res.role}）`)
      setTimeout(() => nav('/login'), NAV_DELAY_MS)
    },
    onError: (e) => message.error(errMsg(e, '接受邀请失败')),
  })

  const onFinish = (v: { token: string; username: string; password: string }) => {
    void accept({
      token: v.token.trim(),
      username: v.username.trim(),
      password: v.password,
    })
  }

  return (
    <div
      style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: t.space.xxl }}
    >
      <div
        className="panel"
        style={{
          width: '100%',
          maxWidth: CARD_MAX_W,
          padding: `${t.space.xxl}px ${t.space.xxl}px ${t.space.md}px`,
        }}
      >
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          接受邀请
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="t-xs">
          设置用户名与密码完成注册；邀请链接有效期有限，过期需联系管理员重新生成。
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
          <Button block type="primary" htmlType="submit" loading={busy}>
            创建账号
          </Button>
        </Form>
        <Button type="link" block onClick={() => nav('/login')}>
          返回登录
        </Button>
      </div>
    </div>
  )
}
