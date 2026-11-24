import { App as AntApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { antdTheme } from './theme/theme'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import AcceptInvite from './pages/AcceptInvite'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import TaskDetail from './pages/TaskDetail'
import Approvals from './pages/Approvals'
import Merges from './pages/Merges'
import FixPush from './pages/FixPush'
import Assistant from './pages/Assistant'
import RepoSettings from './pages/RepoSettings'
import Invites from './pages/Invites'
import Me from './pages/Me'
import type { ReactNode } from 'react'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <span className="grad-text" style={{ fontSize: 20, letterSpacing: 4 }}>
          ARGUS
        </span>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  return <>{children}</>
}

function Shell() {
  return (
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
        <Route path="tasks" element={<Tasks />} />
        <Route path="tasks/:taskId" element={<TaskDetail />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="merges" element={<Merges />} />
        <Route path="fix-push" element={<FixPush />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="settings/repos" element={<RepoSettings />} />
        <Route path="invites" element={<Invites />} />
        <Route path="me" element={<Me />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
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
