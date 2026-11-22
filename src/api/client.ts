/**
 * argus-service API 客户端（TypeScript）。
 * 信封 {code,data,message,trace_id}；Bearer 会话/静态 token。
 */

const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')

const TOKEN_KEY = 'argus.token'
const USER_KEY = 'argus.user'

export interface PermissionBits {
  read_repository?: boolean
  request_review?: boolean
  decide_review?: boolean
  apply_fix?: boolean
  merge_pr?: boolean
  read_audit?: boolean
  manage_membership?: boolean
  manage_instance?: boolean
}

export interface Me {
  username: string
  role: string
  scope: string
  permissions?: PermissionBits
  user_id?: string
}

export interface LoginRes {
  token: string
  username: string
  role: string
  scope: string
  expires_at: number
}

export interface TaskRow {
  id?: string
  task_id?: string
  kind?: string
  platform?: string
  owner?: string
  repo?: string
  number?: string
  status?: string
  verdict?: string
  fix_status?: string
  head_sha?: string
  updated_at?: string
  report?: string
  tokens_used?: number
}

export interface GateCheck {
  code: string
  ok: boolean
  message: string
}

export interface MergeEligibility {
  eligible: boolean
  head_sha?: string
  merge_status?: string
  review_task_id?: string
  review_verdict?: string
  ci_status?: string
  blocking_findings: number
  checks: GateCheck[]
}

export interface FixTicket {
  id: string
  platform: string
  owner: string
  repo: string
  number: string
  head_sha?: string
  print?: string
  file?: string
  severity?: string
  status: string
  reason?: string
  created_at: number
  decided_at?: number
}

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || ''
}
export function setToken(tok: string): void {
  if (tok) localStorage.setItem(TOKEN_KEY, tok)
  else localStorage.removeItem(TOKEN_KEY)
}
export function getCachedUser(): Me | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null') as Me | null
  } catch {
    return null
  }
}
export function setCachedUser(u: Me | null): void {
  if (u) localStorage.setItem(USER_KEY, JSON.stringify(u))
  else localStorage.removeItem(USER_KEY)
}

export class ApiError extends Error {
  status: number
  code?: number
  constructor(status: number, code: number | undefined, message: string) {
    super(message || `HTTP ${status}`)
    this.status = status
    this.code = code
  }
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const url = new URL(API_BASE + path, window.location.origin)
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }
  const headers: Record<string, string> = { Accept: 'application/json' }
  const tok = getToken()
  if (tok) headers.Authorization = `Bearer ${tok}`
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(url.toString(), {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* 非 JSON */
  }
  if (!res.ok) {
    throw new ApiError(res.status, json?.code, json?.message || text || res.statusText)
  }
  if (json && typeof json === 'object' && 'code' in json && 'data' in json) {
    if (json.code !== 0 && json.code !== 200) {
      throw new ApiError(res.status, json.code, json.message || '请求失败')
    }
    return json.data as T
  }
  return json as T
}

export const api = {
  login: (username: string, password: string) =>
    request<LoginRes>('/auth/login', { method: 'POST', body: { username, password } }),
  logout: () => request<{ revoked: boolean }>('/auth/logout', { method: 'POST', body: {} }),
  me: () => request<Me>('/auth/me'),
  createInvite: (payload: { role: string; username?: string; ttl_hours?: number }) =>
    request<{ invite_id: string; token: string; role: string; expires_at: number }>(
      '/auth/invites',
      { method: 'POST', body: payload },
    ),
  acceptInvite: (payload: { token: string; username: string; password: string }) =>
    request<{ username: string; role: string; created: boolean }>('/auth/accept-invite', {
      method: 'POST',
      body: payload,
    }),

  listTasks: (query?: { status?: string; limit?: number }) =>
    request<{ tasks: TaskRow[] } | TaskRow[]>('/tasks', { query: query as any }),
  getTask: (id: string) => request<TaskRow>(`/tasks/${encodeURIComponent(id)}`),
  createTask: (payload: {
    kind?: number
    platform: string
    owner: string
    repo: string
    number: string
  }) => request<any>('/tasks', { method: 'POST', body: payload }),
  statsOverview: (query?: { days?: number }) => request<any>('/stats/overview', { query: query as any }),

  listFixApprovals: (query: { platform: string; owner: string; repo: string; number: string }) =>
    request<{ tickets: FixTicket[]; pending_count?: number; head_sha?: string }>('/fix-approvals', {
      query: query as any,
    }),
  decideFixApproval: (payload: { id: string; decision: string; reason?: string }) =>
    request<{ id: string; status: string; changed: boolean; message?: string }>(
      '/fix-approvals/decide',
      { method: 'POST', body: payload },
    ),

  mergeEligibility: (query: { platform: string; owner: string; repo: string; number: string }) =>
    request<{ eligibility: MergeEligibility }>('/merges/eligibility', { query: query as any }),
  mergePreview: (payload: { platform: string; owner: string; repo: string; number: string }) =>
    request<{
      op_id: string
      eligible: boolean
      expected_remote_head: string
      reject_code?: string
      eligibility: MergeEligibility
    }>('/merges/preview', { method: 'POST', body: payload }),
  mergeConfirm: (payload: { op_id: string; expected_remote_head: string }) =>
    request<{ op_id: string; status: string; message?: string; merged_sha?: string }>(
      '/merges/confirm',
      { method: 'POST', body: payload },
    ),
  mergeReconcile: (payload: { op_id: string }) =>
    request<{ status: string; message?: string }>('/merges/reconcile', {
      method: 'POST',
      body: payload,
    }),

  fixPushPreview: (query: { platform: string; owner: string; repo: string; number: string }) =>
    request<{
      task_id?: string
      head_sha?: string
      fix_status?: string
      ready: boolean
      message: string
      pending_approvals: number
      mode?: string
    }>('/fix-push/preview', { query: query as any }),
  fixPushConfirm: (payload: { task_id: string; expected_remote_head: string }) =>
    request<{ task_id: string; status: string; message: string; head_sha?: string; fix_status?: string }>(
      '/fix-push/confirm',
      { method: 'POST', body: payload },
    ),

  // Q&A（Assistant 页；与 MCP ask_argus 同源 ReviewQA）
  ask: (payload: {
    platform: string
    owner: string
    repo: string
    number: string
    question?: string
  }) =>
    request<{ ok: boolean; answer?: string; review?: Record<string, string>; message: string }>(
      '/ask',
      { method: 'POST', body: payload },
    ),
  askLatest: (query: { platform: string; owner: string; repo: string; number: string }) =>
    request<{ ok: boolean; answer?: string; review?: Record<string, string>; message: string }>(
      '/ask/review',
      { query: query as any },
    ),
}
