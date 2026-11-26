import { Menu, Tag, Typography, Space, Button, Avatar, Dropdown } from 'antd'
import {
  ControlOutlined,
  DashboardOutlined,
  BarChartOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  MergeCellsOutlined,
  SendOutlined,
  QuestionCircleOutlined,
  UserAddOutlined,
  IdcardOutlined,
  LogoutOutlined,
  PlusOutlined,
  BugOutlined,
  AppstoreOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { palette } from '../theme/theme'
import type { PermissionBits } from '../api/client'

/**
 * 侧栏用固定列 + inline Menu，**不用 Layout.Sider**：
 * antd 的 Sider 会通过 context 把 collapsed 传给 Menu（inlineCollapsed），
 * 一旦 Sider 进入折叠态（响应式/历史会话状态），整个导航会塌成图标且
 * 文字不可见——v8.6.4 曾用 flex 宽度兜底过一次，仍会复发。这里显式
 * inlineCollapsed={false}，从根上没有折叠路径。
 */
interface NavItem {
  key: string
  icon: React.ReactNode
  label: string
  /** 可见所需权限（缺省=所有登录用户可见，与后端 read 档对齐）。 */
  perm?: keyof PermissionBits
}

const NAV: NavItem[] = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '总览' },
  { key: '/quality', icon: <BarChartOutlined />, label: '质量运营' },
  { key: '/tasks', icon: <RocketOutlined />, label: '审查任务' },
  { key: '/findings', icon: <BugOutlined />, label: '意见治理' },
  { key: '/approvals', icon: <SafetyCertificateOutlined />, label: '修复审批', perm: 'decide_review' },
  { key: '/merges', icon: <MergeCellsOutlined />, label: '合并资格门', perm: 'decide_review' },
  { key: '/fix-push', icon: <SendOutlined />, label: '受控推送', perm: 'decide_review' },
  { key: '/assistant', icon: <QuestionCircleOutlined />, label: '审查问答' },
  { key: '/agents', icon: <AppstoreOutlined />, label: '插件能力' },
  { key: '/settings/repos', icon: <ControlOutlined />, label: '仓库设置' },
  { key: '/invites', icon: <UserAddOutlined />, label: '邀请成员', perm: 'manage_membership' },
  { key: '/me', icon: <IdcardOutlined />, label: '我的权限' },
]

/** 当前路径命中的菜单项（/tasks/:id → /tasks；取最长前缀匹配）。 */
function selectedKey(pathname: string): string {
  let best = ''
  for (const n of NAV) {
    if (pathname === n.key || pathname.startsWith(n.key + '/')) {
      if (n.key.length > best.length) best = n.key
    }
  }
  return best
}

export default function AppLayout() {
  const nav = useNavigate()
  const loc = useLocation()
  const { user, logout, can } = useAuth()

  const items = NAV.filter((n) => {
    if (!n.perm) return true
    // 静态超管 token（无 permissions 投影）默认全可见；服务端仍二次判定。
    if (!user?.permissions) return true
    return can(n.perm)
  }).map((n) => ({ key: n.key, icon: n.icon, label: n.label, onClick: () => nav(n.key) }))

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 24px',
          background: 'rgba(11,15,22,0.86)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(148,163,184,0.12)',
          position: 'sticky',
          top: 0,
          zIndex: 20,
          height: 56,
        }}
      >
        <Typography.Text strong style={{ fontSize: 17, letterSpacing: 0.4 }}>
          Argus
        </Typography.Text>
        <Tag style={{ marginInlineEnd: 0 }}>审查工作台</Tag>
        <div style={{ flex: 1 }} />
        <Space>
          <Tag color="blue">{user?.role || user?.scope || '—'}</Tag>
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
                background: palette.cyan,
                cursor: 'pointer',
                color: '#0b1220',
                fontWeight: 600,
              }}
            >
              {(user?.username || 'U').slice(0, 1).toUpperCase()}
            </Avatar>
          </Dropdown>
        </Space>
      </header>

      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <aside
          style={{
            width: 200,
            minWidth: 200,
            flex: '0 0 200px',
            position: 'sticky',
            top: 56,
            alignSelf: 'flex-start',
            height: 'calc(100vh - 56px)',
            overflowY: 'auto',
            background: 'rgba(11,15,22,0.55)',
            borderRight: '1px solid rgba(148,163,184,0.1)',
            paddingTop: 12,
          }}
        >
          <Menu
            mode="inline"
            inlineCollapsed={false}
            selectedKeys={[selectedKey(loc.pathname)]}
            items={items}
            style={{ borderInlineEnd: 'none', background: 'transparent', width: '100%' }}
          />
          <div style={{ padding: 16 }}>
            <Button block type="primary" icon={<PlusOutlined />} onClick={() => nav('/tasks')}>
              新建审查
            </Button>
          </div>
        </aside>

        <main style={{ flex: 1, minWidth: 0, minHeight: 360 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}