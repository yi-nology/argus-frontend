import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { PermGate } from '../components/Layout'

function Chip({ tone = 'mute', children }) {
  return <span className={`chip ${tone}`}>{children}</span>
}

function statusTone(s) {
  if (s === 'approved') return 'ok'
  if (s === 'rejected') return 'err'
  if (s === 'stale') return 'warn'
  return 'mute'
}

export default function Approvals() {
  const [q, setQ] = useState({ platform: 'gitea', owner: '', repo: '', number: '' })
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('platform')) {
      setQ({
        platform: sp.get('platform') || 'gitea',
        owner: sp.get('owner') || '',
        repo: sp.get('repo') || '',
        number: sp.get('number') || '',
      })
    }
  }, [])

  async function load(e) {
    if (e) e.preventDefault()
    setErr('')
    setMsg('')
    setBusy(true)
    try {
      const r = await api.listFixApprovals(q)
      setRes(r)
    } catch (ex) {
      setErr(ex.message || '查询失败')
    } finally {
      setBusy(false)
    }
  }

  async function decide(id, decision) {
    setErr('')
    setMsg('')
    try {
      const r = await api.decideFixApproval({
        id,
        decision,
        reason: decision === 'rejected' ? '工作台拒绝' : '工作台批准',
      })
      setMsg(`票 ${id} → ${r.status}${r.changed ? '' : '（幂等拒绝，状态未变）'}`)
      await load()
    } catch (ex) {
      setErr(ex.message || '裁决失败')
    }
  }

  const tickets = res?.tickets || []

  return (
    <div>
      <div className="panel">
        <h2>高危修复审批（critical / high）</h2>
        <div className="muted" style={{ marginBottom: 8 }}>
          按 (PR, fp, head) 建票；缺票或未批准时 <span className="mono">@argus fix</span> 与推送环 fail-closed。
          新 head 旧票标 stale。
        </div>
        <form onSubmit={load}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ maxWidth: 130, marginBottom: 0 }}>
              <label>platform</label>
              <input value={q.platform} onChange={(e) => setQ({ ...q, platform: e.target.value })} />
            </div>
            <div className="field" style={{ maxWidth: 140, marginBottom: 0 }}>
              <label>owner</label>
              <input value={q.owner} onChange={(e) => setQ({ ...q, owner: e.target.value })} required />
            </div>
            <div className="field" style={{ maxWidth: 140, marginBottom: 0 }}>
              <label>repo</label>
              <input value={q.repo} onChange={(e) => setQ({ ...q, repo: e.target.value })} required />
            </div>
            <div className="field" style={{ maxWidth: 90, marginBottom: 0 }}>
              <label>PR #</label>
              <input value={q.number} onChange={(e) => setQ({ ...q, number: e.target.value })} required />
            </div>
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? '查询中…' : '查询票'}
            </button>
          </div>
        </form>
      </div>

      {err && <div className="error-banner">{err}</div>}
      {msg && <div className="success-banner">{msg}</div>}

      <div className="panel">
        <h2>
          票列表
          {res && (
            <span className="muted" style={{ marginLeft: 10, fontWeight: 400 }}>
              head={res.head_sha || '—'} · 待裁决 {res.pending_count ?? res.pending ?? 0}
            </span>
          )}
        </h2>
        <table className="data">
          <thead>
            <tr>
              <th>ID</th>
              <th>fp</th>
              <th>sev</th>
              <th>文件</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td className="mono">{(t.id || '').slice(0, 16)}</td>
                <td className="mono">{(t.print || '').slice(0, 12)}</td>
                <td>
                  <Chip tone={t.severity === 'critical' ? 'err' : 'warn'}>{t.severity}</Chip>
                </td>
                <td className="mono">{t.file}</td>
                <td>
                  <Chip tone={statusTone(t.status)}>{t.status}</Chip>
                </td>
                <td>
                  {t.status === 'pending' ? (
                    <PermGate perm="decide_review" reason="需要 admin/maintainer">
                      <span className="btn-row" style={{ margin: 0 }}>
                        <button className="btn" type="button" onClick={() => decide(t.id, 'approved')}>
                          批准
                        </button>
                        <button className="btn danger" type="button" onClick={() => decide(t.id, 'rejected')}>
                          拒绝
                        </button>
                      </span>
                    </PermGate>
                  ) : (
                    <span className="muted">{t.reason || t.status}</span>
                  )}
                </td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  无票（先查询 PR；无高危意见或未生成）
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
