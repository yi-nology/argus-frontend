import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { PermGate } from '../components/Layout'

function Chip({ tone = 'mute', children }) {
  return <span className={`chip ${tone}`}>{children}</span>
}

export default function Merges() {
  const [q, setQ] = useState({ platform: 'gitea', owner: '', repo: '', number: '' })
  const [elig, setElig] = useState(null)
  const [op, setOp] = useState(null)
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

  async function checkEligibility(e) {
    if (e) e.preventDefault()
    setErr('')
    setMsg('')
    setOp(null)
    setBusy(true)
    try {
      const r = await api.mergeEligibility(q)
      setElig(r?.eligibility || r)
    } catch (ex) {
      setErr(ex.message || '查询失败')
    } finally {
      setBusy(false)
    }
  }

  async function doPreview() {
    setErr('')
    setMsg('')
    setBusy(true)
    try {
      const r = await api.mergePreview(q)
      setOp(r)
      setElig(r?.eligibility || elig)
      setMsg(
        r.eligible
          ? `预检通过，候选 op_id=${r.op_id}，expected_remote_head=${r.expected_remote_head}`
          : `预检未通过：${r.reject_code || '资格门未通过'}`,
      )
    } catch (ex) {
      setErr(ex.message || '预检失败')
    } finally {
      setBusy(false)
    }
  }

  async function doConfirm() {
    if (!op?.op_id) return
    setErr('')
    setMsg('')
    setBusy(true)
    try {
      const r = await api.mergeConfirm({
        op_id: op.op_id,
        expected_remote_head: op.expected_remote_head,
      })
      setMsg(`确认结果：${r.status} — ${r.message || ''}`)
    } catch (ex) {
      setErr(ex.message || '确认失败')
    } finally {
      setBusy(false)
    }
  }

  async function doReconcile() {
    if (!op?.op_id) return
    setErr('')
    setMsg('')
    try {
      const r = await api.mergeReconcile({ op_id: op.op_id })
      setMsg(`对账：${r.status} — ${r.message || ''}`)
    } catch (ex) {
      setErr(ex.message || '对账失败')
    }
  }

  return (
    <div>
      <div className="panel">
        <h2>合并资格门（preview → confirm）</h2>
        <div className="muted" style={{ marginBottom: 8 }}>
          七条 fail-closed：PR 开放 / 非 draft / head 一致 / mergeable 已知 / 当前 head 审查完成 /
          无未处理 critical·high / CI 通过（无 CI 或读取失败 = 阻断）。confirm 绑定 head，陈旧拒绝。
        </div>
        <form onSubmit={checkEligibility}>
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
              资格检查
            </button>
          </div>
        </form>
      </div>

      {err && <div className="error-banner">{err}</div>}
      {msg && <div className="success-banner">{msg}</div>}

      {elig && (
        <div className="panel">
          <h2>
            资格判定
            <span style={{ marginLeft: 12, fontWeight: 400 }}>
              {elig.eligible ? (
                <Chip tone="ok">✓ eligible</Chip>
              ) : (
                <Chip tone="err">✗ not eligible</Chip>
              )}
            </span>
          </h2>
          <div className="kv-row">
            <div className="kv">
              <span className="k">head_sha</span>
              <span className="v mono">{elig.head_sha || '—'}</span>
            </div>
            <div className="kv">
              <span className="k">merge_status</span>
              <span className="v mono">{elig.merge_status || '—'}</span>
            </div>
            <div className="kv">
              <span className="k">review</span>
              <span className="v mono">
                {elig.review_verdict || '—'} {elig.review_task_id ? `(${elig.review_task_id})` : ''}
              </span>
            </div>
            <div className="kv">
              <span className="k">ci</span>
              <span className="v mono">{elig.ci_status || '—'}</span>
            </div>
            <div className="kv">
              <span className="k">blocking</span>
              <span className="v mono">{elig.blocking_findings}</span>
            </div>
          </div>
          {(elig.checks || []).map((c) => (
            <div className="check" key={c.code}>
              <div className="code mono">
                {c.ok ? '✓' : '✗'} {c.code}
              </div>
              <div className="msg">{c.message}</div>
            </div>
          ))}
          <div className="btn-row">
            <PermGate perm="merge_pr" reason="需要 admin/maintainer">
              <button className="btn primary" type="button" onClick={doPreview} disabled={busy}>
                1. 预览（建候选）
              </button>
            </PermGate>
            <PermGate perm="merge_pr" reason="需要 admin/maintainer">
              <button
                className="btn danger"
                type="button"
                onClick={doConfirm}
                disabled={busy || !op?.op_id || !op?.eligible}
              >
                2. 确认合并
              </button>
            </PermGate>
            <button className="btn" type="button" onClick={doReconcile} disabled={!op?.op_id}>
              读回对账
            </button>
          </div>
          {op && (
            <div className="muted">
              op_id=<span className="mono">{op.op_id || '(未创建：预检未通过)'}</span>
              {op.expected_remote_head && (
                <>
                  {' '}
                  · expected=<span className="mono">{op.expected_remote_head}</span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
