import React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

const NAV = [
  { to: '/', label: '总览', end: true },
  { to: '/tasks', label: '任务' },
  { to: '/approvals', label: '修复审批' },
  { to: '/merges', label: '合并' },
  { to: '/fix-push', label: '修复推送' },
  { to: '/invites', label: '邀请', need: 'manage_membership' },
  { to: '/me', label: '我的权限' },
]

export default function Layout() {
  const { user, logout, can } = useAuth()
  const nav = useNavigate()

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Argus</div>
        <div className="page-title">审查工作台 · argus-service</div>
        <div className="spacer" />
        <div className="who">
          {user?.username || '未登录'} · {user?.role || user?.scope || '—'}
        </div>
        <button
          className="btn"
          type="button"
          onClick={async () => {
            await logout()
            nav('/login')
          }}
        >
          登出
        </button>
      </header>
      <div className="body-row">
        <nav className="sidebar">
          {NAV.filter((n) => !n.need || can(n.need) || !user?.permissions).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/** 权限位说明：无 permissions 时按钮不隐藏（服务端仍 fail-closed），置灰+原因。 */
export function PermGate({ perm, reason, children }) {
  const { can, user } = useAuth()
  if (user?.permissions && !can(perm)) {
    return (
      <span title={reason || `缺少权限：${perm}`} style={{ opacity: 0.5 }}>
        {children}
      </span>
    )
  }
  return children
}
