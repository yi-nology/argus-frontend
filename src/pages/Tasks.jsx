import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'

function Chip({ tone = 'mute', children }) {
  return <span className={`chip ${tone}`}>{children}</span>
}

export default function Tasks() {
  const nav = useNavigate()
  const [list, setList] = useState([])
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')
  const [form, setForm] = useState({ platform: 'gitea', owner: '', repo: '', number: '' })
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const res = await api.listTasks({ status, limit: 50 })
      setList(res?.tasks || res || [])
      setErr('')
    } catch (e) {
      setErr(e.message)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  async function createTask(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await api.createTask({
        kind: 0,
        platform: form.platform,
        owner: form.owner,
        repo: form.repo,
        number: String(form.number),
      })
      await load()
    } catch (ex) {
      setErr(ex.message || '创建失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="panel">
        <h2>发起审查</h2>
        {err && <div className="error-banner">{err}</div>}
        <form onSubmit={createTask}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ maxWidth: 140, marginBottom: 0 }}>
              <label>平台</label>
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
              >
                <option value="gitea">gitea</option>
                <option value="forgejo">forgejo</option>
                <option value="github">github</option>
                <option value="gitlab">gitlab</option>
                <option value="gitee">gitee</option>
                <option value="gitcode">gitcode</option>
                <option value="tencent_code">tencent_code</option>
              </select>
            </div>
            <div className="field" style={{ maxWidth: 160, marginBottom: 0 }}>
              <label>owner</label>
              <input
                value={form.owner}
                onChange={(e) => setForm({ ...form, owner: e.target.value })}
                required
              />
            </div>
            <div className="field" style={{ maxWidth: 160, marginBottom: 0 }}>
              <label>repo</label>
              <input
                value={form.repo}
                onChange={(e) => setForm({ ...form, repo: e.target.value })}
                required
              />
            </div>
            <div className="field" style={{ maxWidth: 100, marginBottom: 0 }}>
              <label>PR #</label>
              <input
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
                required
              />
            </div>
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? '提交中…' : '创建任务'}
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <h2>任务列表</h2>
        <div className="btn-row">
          {['', 'pending', 'running', 'done', 'failed'].map((s) => (
            <button
              key={s || 'all'}
              type="button"
              className={`btn ${status === s ? 'primary' : ''}`}
              onClick={() => setStatus(s)}
            >
              {s || '全部'}
            </button>
          ))}
          <button type="button" className="btn" onClick={load}>
            刷新
          </button>
        </div>
        <table className="data">
          <thead>
            <tr>
              <th>ID</th>
              <th>PR</th>
              <th>kind</th>
              <th>状态</th>
              <th>verdict</th>
              <th>fix</th>
              <th>更新</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(list) ? list : []).map((t) => (
              <tr key={t.id || t.task_id}>
                <td>
                  <a
                    href="#"
                    className="mono"
                    onClick={(e) => {
                      e.preventDefault()
                      nav(`/tasks/${t.id || t.task_id}`)
                    }}
                  >
                    {(t.id || t.task_id || '').slice(0, 18)}
                  </a>
                </td>
                <td>
                  {t.platform}/{t.owner}/{t.repo}#{t.number}
                </td>
                <td className="mono">{t.kind || '—'}</td>
                <td>
                  <Chip
                    tone={
                      t.status === 'done' ? 'ok' : t.status === 'failed' ? 'err' : t.status === 'running' ? 'run' : 'mute'
                    }
                  >
                    {t.status}
                  </Chip>
                </td>
                <td className="mono">{t.verdict || '—'}</td>
                <td className="mono">{t.fix_status || '—'}</td>
                <td className="mono">{(t.updated_at || '').slice(0, 19) || '—'}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  无数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
