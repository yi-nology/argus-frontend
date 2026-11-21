/**
 * argus-service API 客户端。
 * - Base：开发走 /api 代理；生产设 VITE_API_BASE。
 * - 鉴权：Bearer（登录会话或静态 token，存 localStorage）。
 * - 信封：{code,data,message,trace_id} —— code===0/200 视为成功。
 */

const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')

const TOKEN_KEY = 'argus.token'
const USER_KEY = 'argus.user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}
export function setToken(tok) {
  if (tok) localStorage.setItem(TOKEN_KEY, tok)
  else localStorage.removeItem(TOKEN_KEY)
}
export function getCachedUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}
export function setCachedUser(u) {
  if (u) localStorage.setItem(USER_KEY, JSON.stringify(u))
  else localStorage.removeItem(USER_KEY)
}

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || `HTTP ${status}`)
    this.status = status
    this.code = code
  }
}

async function request(path, { method = 'GET', body, query, signal } = {}) {
  const url = new URL(API_BASE + path, window.location.origin)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
    }
  }
  const headers = { Accept: 'application/json' }
  const tok = getToken()
  if (tok) headers.Authorization = `Bearer ${tok}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })

  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* 非 JSON（HTML 错误页等） */
  }

  if (!res.ok) {
    const msg = json?.message || json?.msg || text || res.statusText
    throw new ApiError(res.status, json?.code, msg)
  }
  // 信封：{code,data,message} 或直接 data
  if (json && typeof json === 'object' && 'code' in json && 'data' in json) {
    if (json.code !== 0 && json.code !== 200 && json.code !== undefined) {
      throw new ApiError(res.status, json.code, json.message || '请求失败')
    }
    return json.data
  }
  return json
}

export const api = {
  // ---- auth ----
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: { username, password } }),
  logout: () => request('/auth/logout', { method: 'POST', body: {} }),
  me: () => request('/auth/me'),
  createInvite: (payload) => request('/auth/invites', { method: 'POST', body: payload }),
  acceptInvite: (payload) =>
    request('/auth/accept-invite', { method: 'POST', body: payload }),

  // ---- tasks ----
  listTasks: (query) => request('/tasks', { query }),
  getTask: (taskId) => request(`/tasks/${encodeURIComponent(taskId)}`),
  createTask: (payload) => request('/tasks', { method: 'POST', body: payload }),
  statsOverview: (query) => request('/stats/overview', { query }),
  usageMonthly: () => request('/usage/monthly'),
  agents: (query) => request('/agents', { query }),

  // ---- fix approvals ----
  listFixApprovals: (query) => request('/fix-approvals', { query }),
  decideFixApproval: (payload) =>
    request('/fix-approvals/decide', { method: 'POST', body: payload }),

  // ---- merge gate ----
  mergeEligibility: (query) => request('/merges/eligibility', { query }),
  mergePreview: (payload) => request('/merges/preview', { method: 'POST', body: payload }),
  mergeConfirm: (payload) => request('/merges/confirm', { method: 'POST', body: payload }),
  mergeGet: (opId) => request(`/merges/${encodeURIComponent(opId)}`),
  mergeReconcile: (payload) => request('/merges/reconcile', { method: 'POST', body: payload }),

  // ---- fix push ----
  fixPushPreview: (query) => request('/fix-push/preview', { query }),
  fixPushConfirm: (payload) => request('/fix-push/confirm', { method: 'POST', body: payload }),

  // ---- findings / settings ----
  suppressFinding: (payload) => request('/findings/suppress', { method: 'POST', body: payload }),
  restoreFinding: (payload) => request('/findings/restore', { method: 'POST', body: payload }),
  listRepoSettings: () => request('/repo-settings'),
}
