import React from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import AcceptInvite from './pages/AcceptInvite'
import Overview from './pages/Overview'
import Tasks from './pages/Tasks'
import TaskDetail from './pages/TaskDetail'
import Approvals from './pages/Approvals'
import Merges from './pages/Merges'
import FixPush from './pages/FixPush'
import Invites from './pages/Invites'
import Me from './pages/Me'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <div style={{ padding: 24 }}>会话校验中…</div>
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Overview />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="tasks/:taskId" element={<TaskDetail />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="merges" element={<Merges />} />
          <Route path="fix-push" element={<FixPush />} />
          <Route path="invites" element={<Invites />} />
          <Route path="me" element={<Me />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
