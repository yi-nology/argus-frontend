import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'

function Chip({ tone = 'mute', children }) {
  return <span className={`chip ${tone}`}>{children}</span>
}

function verdictTone(v) {
  if (v === 'approve') return 'ok'
  if (v === 'request_changes') return 'err'
  if (v === 'comment') return 'warn'
  return 'mute'
}

export default function Overview() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [tasks, setTasks] = useState([])
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const [s, t] = await Promise.all([
          api.statsOverview({ days: 30 }).catch(() => null),
          api.listTasks({ limit: 15 }).catch(() => ({ tasks: [] })),
        ])
        if (!alive) return
        setStats(s)
        setTasks(t?.tasks || t || [])
      } catch (e) {
        if (alive) setErr(e.message || '加载失败')
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [])

  return (
    <div>
      <div className="panel">
        <h2>总览（30 天）</h2>
        {err && <div className="error-banner">{err}</div>}
        <div className="kv-row">
          <div className="kv">
            <span className="k">身份</span>
            <span className="v">
              {user?.username} · {user?.role || user?.scope}
            </span>
          </div>
          <div className="kv">
            <span className="k">任务量</span>
            <span className="v mono">{stats?.total_tasks ?? stats?.tasks ?? '—'}</span>
          </div>
          <div className="kv">
            <span className="k">approve</span>
            <span className="v mono">{stats?.verdicts?.approve ?? '—'}</span>
          </div>
          <div className="kv">
            <span className="k">comment</span>
            <span className="v mono">{stats?.verdicts?.comment ?? '—'}</span>
          </div>
          <div className="kv">
            <span className="k">request_changes</span>
            <span className="v mono">{stats?.verdicts?.request_changes ?? '—'}</span>
          </div>
          <div className="kv">
            <span className="k">抑制意见</span>
            <span className="v mono">{stats?.suppressed ?? '—'}</span>
          </div>
        </div>
        <div className="muted">
          完整统计以 <span className="mono">GET /stats/overview</span> 为准；字段以服务端投影为准。
        </div>
      </div>

      <div className="panel">
        <h2>最近任务</h2>
        <table className="data">
          <thead>
            <tr>
              <th>任务</th>
              <th>仓库</th>
              <th>状态</th>
              <th>裁决</th>
              <th>head</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(tasks) ? tasks : []).slice(0, 12).map((t) => (
              <tr key={t.id || t.task_id}>
                <td>
                  <Link to={`/tasks/${t.id || t.task_id}`} className="mono">
                    {(t.id || t.task_id || '').slice(0, 16)}
                  </Link>
                </td>
                <td>
                  {t.platform}/{t.owner}/{t.repo}#{t.number}
                </td>
                <td>
                  <Chip
                    tone={
                      t.status === 'done' ? 'ok' : t.status === 'failed' ? 'err' : t.status === 'running' ? 'run' : 'mute'
                    }
                  >
                    {t.status}
                  </Chip>
                </td>
                <td>
                  <Chip tone={verdictTone(t.verdict)}>{t.verdict || '—'}</Chip>
                </td>
                <td className="mono">{(t.head_sha || '').slice(0, 10) || '—'}</td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  暂无任务
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
