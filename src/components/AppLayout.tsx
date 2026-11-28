import { useState } from 'react'
import { Menu, Tag, Typography, Space, Button, Avatar, Dropdown, Drawer, Grid } from 'antd'
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
  MenuOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from '@umijs/max'
import { useAuth } from '../auth/AuthContext'
import { t } from '../theme/tokens'
import type { PermissionBits } from '../api/client'
import type { MenuProps } from 'antd'

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
  /** 导航分组。 */
  group: 'workspace' | 'review' | 'govern' | 'admin'
}

const NAV: NavItem[] = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '总览', group: 'workspace' },
  { key: '/quality', icon: <BarChartOutlined />, label: '质量运营', group: 'workspace' },
  { key: '/tasks', icon: <RocketOutlined />, label: '审查任务', group: 'review' },
  { key: '/assistant', icon: <QuestionCircleOutlined />, label: '审查问答', group: 'review' },
  { key: '/agents', icon: <AppstoreOutlined />, label: '插件能力', group: 'review' },
  { key: '/findings', icon: <BugOutlined />, label: '意见治理', group: 'govern' },
  {
    key: '/approvals',
    icon: <SafetyCertificateOutlined />,
    label: '修复审批',
    perm: 'decide_review',
    group: 'govern',
  },
  {
    key: '/merges',
    icon: <MergeCellsOutlined />,
    label: '合并资格门',
    perm: 'decide_review',
    group: 'govern',
  },
  {
    key: '/fix-push',
    icon: <SendOutlined />,
    label: '受控推送',
    perm: 'decide_review',
    group: 'govern',
  },
  { key: '/settings/repos', icon: <ControlOutlined />, label: '仓库设置', group: 'admin' },
  {
    key: '/invites',
    icon: <UserAddOutlined />,
    label: '邀请成员',
    perm: 'manage_membership',
    group: 'admin',
  },
  { key: '/me', icon: <IdcardOutlined />, label: '我的权限', group: 'admin' },
]

const GROUP_LABELS: Record<NavItem['group'], string> = {
  workspace: '工作台',
  review: '审查',
  govern: '治理',
  admin: '管理',
}

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
  // md(768) 以下：固定侧栏让位给 Drawer 抽屉。useBreakpoint 首帧返回
  // 空对象 → compact=false（先渲染桌面形态），匹配结果到达后再切换，
  // 避免宽屏首帧闪抽屉。
  const screens = Grid.useBreakpoint()
  const compact = screens.md === false
  const [drawerOpen, setDrawerOpen] = useState(false)

  const visible = NAV.filter((n) => {
    if (!n.perm) return true
    // 静态超管 token（无 permissions 投影）默认全可见；服务端仍二次判定。
    if (!user?.permissions) return true
    return can(n.perm)
  })

  const items: MenuProps['items'] = (['workspace', 'review', 'govern', 'admin'] as const).flatMap(
    (g) => {
      const group = visible.filter((n) => n.group === g)
      if (group.length === 0) return []
      return [
        { type: 'divider' as const },
        {
          type: 'group' as const,
          label: <span className="meta-sm">{GROUP_LABELS[g]}</span>,
          key: `grp-${g}`,
        },
        ...group.map((n) => ({
          key: n.key,
          icon: n.icon,
          label: n.label,
          onClick: () => {
            nav(n.key)
            setDrawerOpen(false)
          },
        })),
      ]
    },
  )

  const menu = (
    <Menu
      mode="inline"
      inlineCollapsed={false}
      selectedKeys={[selectedKey(loc.pathname)]}
      items={items}
      style={{ borderInlineEnd: 'none', background: 'transparent', width: '100%' }}
    />
  )

  const newTaskBtn = (
    <div style={{ padding: t.space.lg }}>
      <Button
        block
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => {
          nav('/tasks')
          setDrawerOpen(false)
        }}
      >
        新建审查
      </Button>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: t.color.canvas }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: t.space.md,
          padding: compact ? `0 ${t.space.md}px` : `0 ${t.space.xxl}px`,
          background: t.color.surface,
          borderBottom: `1px solid ${t.color.borderMuted}`,
          position: 'sticky',
          top: 0,
          zIndex: 20,
          height: 56,
        }}
      >
        {compact && (
          <Button
            type="text"
            aria-label="打开导航"
            icon={<MenuOutlined style={{ fontSize: t.font.lg, color: t.color.text }} />}
            onClick={() => setDrawerOpen(true)}
            style={{ flex: '0 0 auto' }}
          />
        )}
        <Typography.Text strong style={{ fontSize: t.font.lg, letterSpacing: 0.2 }}>
          Argus
        </Typography.Text>
        {!compact && <Tag style={{ marginInlineEnd: 0 }}>审查工作台</Tag>}
        <div style={{ flex: 1 }} />
        <Space>
          {!compact && (
            <>
              <Tag color="blue">{user?.role || user?.scope || '—'}</Tag>
              <Typography.Text type="secondary">{user?.username}</Typography.Text>
            </>
          )}
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
                background: t.color.accent,
                cursor: 'pointer',
                color: t.color.surface,
                fontWeight: t.weight.semibold,
              }}
            >
              {(user?.username || 'U').slice(0, 1).toUpperCase()}
            </Avatar>
          </Dropdown>
        </Space>
      </header>

      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {!compact && (
          <aside
            style={{
              width: 220,
              minWidth: 220,
              flex: '0 0 220px',
              position: 'sticky',
              top: 56,
              alignSelf: 'flex-start',
              height: 'calc(100vh - 56px)',
              overflowY: 'auto',
              background: t.color.surface,
              borderRight: `1px solid ${t.color.borderMuted}`,
              paddingTop: t.space.md,
            }}
          >
            {menu}
            {newTaskBtn}
          </aside>
        )}

        <Drawer
          placement="left"
          open={compact && drawerOpen}
          onClose={() => setDrawerOpen(false)}
          size={260}
          styles={{ body: { padding: 0, background: t.color.surface } }}
        >
          <div style={{ paddingTop: t.space.md }}>{menu}</div>
          {newTaskBtn}
        </Drawer>

        <main style={{ flex: 1, minWidth: 0, minHeight: 360 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
