import { Suspense, lazy } from 'react'
import { App as AntApp, ConfigProvider, Spin } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { antdTheme } from './theme/theme'
import AppLayout from './components/AppLayout'
import type { ReactNode } from 'react'

/**
 * 路由级代码分割：15 个页面全部 lazy，首屏只加载壳（AppLayout + antd 主 chunk）。
 * 代价=首次进页多一次 chunk 请求（内网毫秒级），换首屏 JS 大头下沉。
 * 主要收益：@ant-design/x（217KB，仅 Assistant 用）与 x-markdown/katex/mermaid
 * （Assistant+TaskDetail 用）随之移出首屏。
 */
const Login = lazy(() => import('./pages/Login'))
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Quality = lazy(() => import('./pages/Quality'))
const Tasks = lazy(() => import('./pages/Tasks'))
const TaskDetail = lazy(() => import('./pages/TaskDetail'))
const Approvals = lazy(() => import('./pages/Approvals'))
const Merges = lazy(() => import('./pages/Merges'))
const FixPush = lazy(() => import('./pages/FixPush'))
const Assistant = lazy(() => import('./pages/Assistant'))
const Agents = lazy(() => import('./pages/Agents'))
const RepoSettings = lazy(() => import('./pages/RepoSettings'))
const Findings = lazy(() => import('./pages/Findings'))
const Invites = lazy(() => import('./pages/Invites'))
const Me = lazy(() => import('./pages/Me'))

/** 懒加载兜底：居中 Spin，避免路由切换闪白。 */
function RouteFallback() {
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
      <Spin size="large" />
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <span style={{ fontSize: 15, letterSpacing: 3, color: '#9aa8bc' }}>Loading…</span>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  return <>{children}</>
}

function Shell() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="quality" element={<Quality />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="tasks/:taskId" element={<TaskDetail />} />
          <Route path="findings" element={<Findings />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="merges" element={<Merges />} />
          <Route path="fix-push" element={<FixPush />} />
          <Route path="assistant" element={<Assistant />} />
          <Route path="agents" element={<Agents />} />
          <Route path="settings/repos" element={<RepoSettings />} />
          <Route path="invites" element={<Invites />} />
          <Route path="me" element={<Me />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <ConfigProvider theme={antdTheme} locale={zhCN}>
      <AntApp>
        <BrowserRouter>
          <AuthProvider>
            <Shell />
          </AuthProvider>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  )
}
