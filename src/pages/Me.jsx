import React from 'react'
import { useAuth } from '../auth'

function Perm({ name, ok }) {
  return (
    <span className={`chip ${ok ? 'ok' : 'mute'}`}>
      {ok ? '✓' : '—'} {name}
    </span>
  )
}

export default function Me() {
  const { user, refresh } = useAuth()
  const p = user?.permissions || {}

  return (
    <div>
      <div className="panel">
        <h2>我的身份与权限（my_permissions）</h2>
        <div className="kv-row">
          <div className="kv">
            <span className="k">username</span>
            <span className="v">{user?.username}</span>
          </div>
          <div className="kv">
            <span className="k">role</span>
            <span className="v">{user?.role || '—'}</span>
          </div>
          <div className="kv">
            <span className="k">scope</span>
            <span className="v mono">{user?.scope || '—'}</span>
          </div>
        </div>
        <div className="btn-row">
          <button className="btn" type="button" onClick={refresh}>
            刷新
          </button>
        </div>
      </div>

      <div className="panel">
        <h2>权限投影（服务端下发，前端不自造）</h2>
        {!user?.permissions && (
          <div className="muted">尚未加载 permissions（点刷新或重新登录）。</div>
        )}
        <div className="btn-row" style={{ gap: 10 }}>
          <Perm name="read_repository" ok={p.read_repository} />
          <Perm name="request_review" ok={p.request_review} />
          <Perm name="decide_review" ok={p.decide_review} />
          <Perm name="apply_fix" ok={p.apply_fix} />
          <Perm name="merge_pr" ok={p.merge_pr} />
          <Perm name="read_audit" ok={p.read_audit} />
          <Perm name="manage_membership" ok={p.manage_membership} />
          <Perm name="manage_instance" ok={p.manage_instance} />
        </div>
        <div className="muted" style={{ marginTop: 10 }}>
          边界：无权限按钮置灰并给原因；服务端仍 fail-closed 二次判定，前端投影仅供展示。
        </div>
      </div>
    </div>
  )
}
