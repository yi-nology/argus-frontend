import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'

export default function AcceptInvite() {
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const [token, setToken] = useState(sp.get('token') || '')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setErr('')
    setOk('')
    setBusy(true)
    try {
      const res = await api.acceptInvite({
        token: token.trim(),
        username: username.trim(),
        password,
      })
      setOk(`账号已创建：${res.username}（${res.role}），请返回登录。`)
      setTimeout(() => nav('/login'), 1500)
    } catch (ex) {
      setErr(ex.message || '接受邀请失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '8vh auto' }}>
      <div className="panel">
        <h2>接受邀请</h2>
        {err && <div className="error-banner">{err}</div>}
        {ok && <div className="success-banner">{ok}</div>}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label>邀请 token</label>
            <input value={token} onChange={(e) => setToken(e.target.value)} required />
          </div>
          <div className="field">
            <label>用户名</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="field">
            <label>密码（≥8 位）</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="btn-row">
            <button className="btn primary" type="submit" disabled={busy}>
              创建账号
            </button>
            <button className="btn" type="button" onClick={() => nav('/login')}>
              返回登录
            </button>
          </div>
        </form>
        <div className="muted">邀请永不授予 admin 角色（平台管理与业务裁定分离）。</div>
      </div>
    </div>
  )
}
