import React, { useState } from 'react'
import { api } from '../api'
import { PermGate } from '../components/Layout'

function Chip({ tone = 'mute', children }) {
  return <span className={`chip ${tone}`}>{children}</span>
}

export default function FixPush() {
  const [q, setQ] = useState({ platform: 'gitea', owner: '', repo: '', number: '' })
  const [prev, setPrev] = useState(null)
  const [confirmRes, setConfirmRes] = useState(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [taskId, setTaskId] = useState('')
  const [head, setHead] = useState('')

  async function doPreview(e) {
    if (e) e.preventDefault()
    setErr('')
    setMsg('')
    setConfirmRes(null)
    setBusy(true)
    try {
      const r = await api.fixPushPreview(q)
      setPrev(r)
      if (r?.task_id) setTaskId(r.task_id)
      if (r?.head_sha) setHead(r.head_sha)
    } catch (ex) {
      setErr(ex.message || '预览失败')
    } finally {
      setBusy(false)
    }
  }

  async function doConfirm() {
    setErr('')
    setMsg('')
    setBusy(true)
    try {
      const r = await api.fixPushConfirm({
        task_id: taskId.trim(),
        expected_remote_head: head.trim(),
      })
      setConfirmRes(r)
      setMsg(`确认：${r.status} — ${r.message || ''}`)
    } catch (ex) {
      setErr(ex.message || '确认失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="panel">
        <h2>修复推送 preview → confirm（ARGUS_FIX_PUSH=confirm）</h2>
        <div className="muted" style={{ marginBottom: 8 }}>
          验证+审批通过后任务落 <span className="mono">await_confirm</span>，不自动推。
          确认时绑定 <span className="mono">task_id + expected_remote_head</span>，陈旧拒绝。
        </div>
        <form onSubmit={doPreview}>
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
              预览就绪态
            </button>
          </div>
        </form>
      </div>

      {err && <div className="error-banner">{err}</div>}
      {msg && <div className="success-banner">{msg}</div>}

      {prev && (
        <div className="panel">
          <h2>
            就绪态
            {prev.ready ? (
              <Chip tone="ok">✓ ready</Chip>
            ) : (
              <Chip tone="warn">⚠ not ready</Chip>
            )}
          </h2>
          <div className="kv-row">
            <div className="kv">
              <span className="k">task_id</span>
              <span className="v mono">{prev.task_id || '—'}</span>
            </div>
            <div className="kv">
              <span className="k">fix_status</span>
              <span className="v mono">{prev.fix_status || '—'}</span>
            </div>
            <div className="kv">
              <span className="k">head</span>
              <span className="v mono">{prev.head_sha || '—'}</span>
            </div>
            <div className="kv">
              <span className="k">待审批票</span>
              <span className="v mono">{prev.pending_approvals ?? 0}</span>
            </div>
            <div className="kv">
              <span className="k">mode</span>
              <span className="v mono">{prev.mode || '—'}</span>
            </div>
          </div>
          <div className="muted">{prev.message}</div>

          <div className="field" style={{ marginTop: 12 }}>
            <label>task_id（confirm 绑定）</label>
            <input value={taskId} onChange={(e) => setTaskId(e.target.value)} className="mono" />
          </div>
          <div className="field">
            <label>expected_remote_head</label>
            <input value={head} onChange={(e) => setHead(e.target.value)} className="mono" />
          </div>
          <div className="btn-row">
            <PermGate perm="apply_fix" reason="需要 admin/maintainer">
              <button
                className="btn danger"
                type="button"
                onClick={doConfirm}
                disabled={busy || !taskId || !head}
              >
                确认推送
              </button>
            </PermGate>
          </div>
          {confirmRes && (
            <div className="muted">
              结果：<Chip tone={confirmRes.status === 'pushed' ? 'ok' : 'err'}>{confirmRes.status}</Chip>{' '}
              {confirmRes.message}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
