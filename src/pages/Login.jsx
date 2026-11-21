import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const invite = sp.get('invite') || ''
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await login(username.trim(), password)
      nav('/')
    } catch (ex) {
      setErr(ex.message || '登录失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '10vh auto' }}>
      <div className="panel">
        <h2>Argus 审查工作台 · 登录</h2>
        {invite && (
          <div className="muted" style={{ marginBottom: 10 }}>
            检测到邀请链接。请先用邀请 token 在「接受邀请」页建号，再回来登录。
          </div>
        )}
        {err && <div className="error-banner">{err}</div>}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label>用户名</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="btn-row">
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? '登录中…' : '登录'}
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => nav('/accept-invite' + (invite ? `?token=${invite}` : ''))}
            >
              接受邀请
            </button>
          </div>
        </form>
        <div className="muted">
          首个管理员：服务端配置 <span className="mono">ARGUS_BOOTSTRAP_ADMIN_USER/PASS</span>
          冷启动；或使用静态 token（设置 API_BASE 后在请求头注入）。
        </div>
      </div>
    </div>
  )
}
