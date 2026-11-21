import React, { useState } from 'react'
import { api } from '../api'
import { PermGate } from '../components/Layout'

export default function Invites() {
  const [role, setRole] = useState('maintainer')
  const [username, setUsername] = useState('')
  const [ttl, setTtl] = useState(72)
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const payload = { role, ttl_hours: ttl }
      if (username.trim()) payload.username = username.trim()
      const r = await api.createInvite(payload)
      setResult(r)
    } catch (ex) {
      setErr(ex.message || '创建邀请失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="panel">
        <h2>创建邀请</h2>
        <div className="muted" style={{ marginBottom: 8 }}>
          邀请永不授予 <b>admin</b>。角色→scope：viewer/auditor=read · operator=ci · maintainer=admin
          （可审批/合并）。token 仅此一次可见。
        </div>
        {err && <div className="error-banner">{err}</div>}
        <PermGate perm="manage_membership" reason="仅 admin 角色可邀请">
          <form onSubmit={submit}>
            <div className="field">
              <label>角色</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="viewer">viewer（只读）</option>
                <option value="auditor">auditor（只读）</option>
                <option value="operator">operator（可建任务）</option>
                <option value="maintainer">maintainer（审批/合并）</option>
              </select>
            </div>
            <div className="field">
              <label>预定用户名（可选）</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="field">
              <label>有效期（小时）</label>
              <input
                type="number"
                min={1}
                max={720}
                value={ttl}
                onChange={(e) => setTtl(Number(e.target.value))}
              />
            </div>
            <div className="btn-row">
              <button className="btn primary" type="submit" disabled={busy}>
                生成邀请
              </button>
            </div>
          </form>
        </PermGate>
      </div>

      {result && (
        <div className="panel">
          <h2>邀请已创建</h2>
          <div className="success-banner">
            发给对方的接受链接：&nbsp;
            <span className="mono">
              {window.location.origin}/accept-invite?token={result.token}
            </span>
          </div>
          <div className="kv-row">
            <div className="kv">
              <span className="k">invite_id</span>
              <span className="v mono">{result.invite_id}</span>
            </div>
            <div className="kv">
              <span className="k">role</span>
              <span className="v">{result.role}</span>
            </div>
            <div className="kv">
              <span className="k">expires</span>
              <span className="v mono">
                {new Date((result.expires_at || 0) * 1000).toISOString()}
              </span>
            </div>
          </div>
          <button
            className="btn"
            type="button"
            onClick={() => navigator.clipboard?.writeText(result.token)}
          >
            复制 token
          </button>
        </div>
      )}
    </div>
  )
}
