import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'

export default function TaskDetail() {
  const { taskId } = useParams()
  const [task, setTask] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    api
      .getTask(taskId)
      .then((t) => {
        if (alive) setTask(t)
      })
      .catch((e) => alive && setErr(e.message))
    return () => {
      alive = false
    }
  }, [taskId])

  if (err) return <div className="error-banner">{err}</div>
  if (!task) return <div className="muted">加载中…</div>

  return (
    <div>
      <div className="panel">
        <h2>
          任务 <span className="mono">{task.id || taskId}</span>
        </h2>
        <div className="kv-row">
          <div className="kv">
            <span className="k">PR</span>
            <span className="v">
              {task.platform}/{task.owner}/{task.repo}#{task.number}
            </span>
          </div>
          <div className="kv">
            <span className="k">状态</span>
            <span className="v">{task.status}</span>
          </div>
          <div className="kv">
            <span className="k">verdict</span>
            <span className="v mono">{task.verdict || '—'}</span>
          </div>
          <div className="kv">
            <span className="k">head</span>
            <span className="v mono">{task.head_sha || '—'}</span>
          </div>
          <div className="kv">
            <span className="k">fix_status</span>
            <span className="v mono">{task.fix_status || '—'}</span>
          </div>
          <div className="kv">
            <span className="k">tokens</span>
            <span className="v mono">{task.tokens_used ?? '—'}</span>
          </div>
        </div>
        <div className="btn-row">
          <Link className="btn" to={`/tasks?repo=${task.repo}`}>
            返回列表
          </Link>
          <Link className="btn" to={`/approvals?platform=${task.platform}&owner=${task.owner}&repo=${task.repo}&number=${task.number}`}>
            查看审批票
          </Link>
          <Link
            className="btn"
            to={`/merges?platform=${task.platform}&owner=${task.owner}&repo=${task.repo}&number=${task.number}`}
          >
            合并资格
          </Link>
        </div>
      </div>

      <div className="panel">
        <h2>审查报告</h2>
        <pre
          className="mono"
          style={{
            whiteSpace: 'pre-wrap',
            fontSize: 12,
            background: 'var(--inset)',
            padding: 12,
            borderRadius: 5,
            maxHeight: 480,
            overflow: 'auto',
          }}
        >
          {task.report || '(无报告)'}
        </pre>
      </div>
    </div>
  )
}
