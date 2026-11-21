import { Layout, Menu, Tag, Typography, Space, Button, Avatar, Dropdown } from 'antd'
import {
  DashboardOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  MergeCellsOutlined,
  SendOutlined,
  RobotOutlined,
  UserAddOutlined,
  IdcardOutlined,
  LogoutOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { palette } from '../theme/theme'

const { Header, Sider, Content } = Layout

const NAV = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '总览' },
  { key: '/tasks', icon: <RocketOutlined />, label: '审查任务' },
  { key: '/approvals', icon: <SafetyCertificateOutlined />, label: '修复审批' },
  { key: '/merges', icon: <MergeCellsOutlined />, label: '合并资格门' },
  { key: '/fix-push', icon: <SendOutlined />, label: '受控推送' },
  { key: '/assistant', icon: <RobotOutlined />, label: 'Argus 助手' },
  { key: '/invites', icon: <UserAddOutlined />, label: '邀请成员' },
  { key: '/me', icon: <IdcardOutlined />, label: '我的权限' },
]

export default function AppLayout() {
  const nav = useNavigate()
  const loc = useLocation()
  const { user, logout, can } = useAuth()

  const items = NAV.filter((n) => {
    if (n.key === '/invites') return !user?.permissions || can('manage_membership')
    return true
  }).map((n) => ({ ...n, onClick: () => nav(n.key) }))

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <Header
        className="top-glow"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 24px',
          background: 'rgba(10,16,30,0.8)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(88,148,255,0.12)',
          position: 'sticky',
          top: 0,
          zIndex: 20,
          height: 56,
          lineHeight: '56px',
        }}
      >
        <ThunderboltOutlined style={{ fontSize: 22, color: palette.cyan }} />
        <Typography.Text strong style={{ fontSize: 18, letterSpacing: 1 }}>
          <span className="grad-text">ARGUS</span>
        </Typography.Text>
        <Tag color="cyan" style={{ marginLeft: 4 }}>
          审查工作台
        </Tag>
        <div style={{ flex: 1 }} />
        <Space>
          <Tag color="purple">{user?.role || user?.scope || '—'}</Tag>
          <Typography.Text type="secondary">{user?.username}</Typography.Text>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                  onClick: async () => {
                    await logout()
                    nav('/login')
                  },
                },
              ],
            }}
          >
            <Avatar
              style={{
                background: 'linear-gradient(135deg,#22d3ee,#8b5cf6)',
                cursor: 'pointer',
                color: '#041018',
                fontWeight: 700,
              }}
            >
              {(user?.username || 'U').slice(0, 1).toUpperCase()}
            </Avatar>
          </Dropdown>
        </Space>
      </Header>

      <Layout>
        <Sider
          width={200}
          style={{
            background: 'rgba(10,16,30,0.55)',
            borderRight: '1px solid rgba(88,148,255,0.1)',
            paddingTop: 12,
          }}
          breakpoint="lg"
          collapsedWidth={0}
        >
          <Menu
            mode="inline"
            selectedKeys={[loc.pathname]}
            items={items}
            style={{ borderInlineEnd: 'none', background: 'transparent' }}
          />
          <div style={{ padding: 16 }}>
            <Button
              block
              className="glow-btn"
              icon={<ThunderboltOutlined />}
              onClick={() => nav('/tasks')}
            >
              新建审查
            </Button>
          </div>
        </Sider>

        <Content style={{ minHeight: 360 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
