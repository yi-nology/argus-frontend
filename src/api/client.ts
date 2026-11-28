/**
 * argus-service API 客户端（TypeScript）。
 * 信封 {code,data,message,trace_id}；Bearer 会话/静态 token。
 */

const API_BASE = (__ARGUS_API_BASE__ || '/api').replace(/\/$/, '')

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
  created_at?: string
  updated_at?: string
  report?: string
  tokens_used?: number
  /** 回帖结果（v8.5.0）：posted | throttled | 空（未达回帖出口）。 */
  reply_state?: string
  /** 按仓回复控制静默条数（v8.5.0）：floor/cap 分列。 */
  silenced_floor?: number
  silenced_cap?: number
}

/**
 * 任务 API 是 thrift camelCase（taskId/headSha/createdAt/replyState…），页面按
 * snake_case 消费；在客户端边界归一，避免各页重复判空（曾致列表点开
 * /tasks/undefined）。
 */
function tsText(v: unknown): string | undefined {
  if (typeof v === 'number' && v > 0) {
    return new Date(v * 1000).toISOString().slice(0, 19).replace('T', ' ')
  }
  if (typeof v === 'string' && v !== '') return v
  return undefined
}

/** 服务端任务行的线上形态：thrift camelCase 与 snake_case 混流，边界处归一。 */
type WireTask = {
  taskId?: string
  task_id?: string
  id?: string
  createdAt?: string | number
  created_at?: string | number
  updatedAt?: string | number
  updated_at?: string | number
  headSha?: string
  head_sha?: string
  fixStatus?: string
  fix_status?: string
  tokensUsed?: number
  tokens_used?: number
  replyState?: string
  reply_state?: string
  silencedFloor?: number
  silenced_floor?: number
  silencedCap?: number
  silenced_cap?: number
} & Partial<TaskRow>

function normalizeTask(raw: WireTask | null | undefined): TaskRow {
  if (!raw) return (raw ?? {}) as TaskRow
  const id = raw.taskId ?? raw.task_id ?? raw.id
  const created = tsText(raw.createdAt ?? raw.created_at)
  return {
    ...raw,
    id,
    task_id: id,
    head_sha: raw.headSha ?? raw.head_sha,
    created_at: created,
    updated_at: tsText(raw.updatedAt ?? raw.updated_at) ?? created,
    fix_status: raw.fixStatus ?? raw.fix_status,
    tokens_used: raw.tokensUsed ?? raw.tokens_used,
    reply_state: raw.replyState ?? raw.reply_state,
    silenced_floor: raw.silencedFloor ?? raw.silenced_floor,
    silenced_cap: raw.silencedCap ?? raw.silenced_cap,
  }
}

/** 意见治理行（GET /findings；finding_prints 跨 PR 视图）。 */
export interface FindingRow {
  platform: string
  owner: string
  repo: string
  number: string
  fingerprint: string
  file?: string
  line?: number
  severity?: string
  comment?: string
  status?: string
  plugin?: string
  times_seen?: number
  regret_count?: number
  first_seen_at?: number
  last_seen_at?: number
  /** 增量重审（G1）：open=本轮复现 / stale=本轮未复现（待人工确认，不等于已修复）。 */
  staleness?: string
  /** 最近一次复现该意见的审查轮 head SHA。 */
  anchor_sha?: string
}

/** 按仓聚合（storage.RepoStats；GET /stats/overview 的 repos[] 行）。 */
/** GET /findings 的计数块。 */
export interface FindingCounts {
  total: number
  open: number
  suppressed: number
  /** 增量重审（G1）：本轮未复现、待人工确认的条数。 */
  stale?: number
}

export interface RepoStatsRow {
  platform: string
  owner: string
  repo: string
  tasks_done: number
  verdict_approve: number
  verdict_comment: number
  verdict_request_changes: number
  tokens_used: number
  findings_suppressed: number
  reply_throttled: number
  silenced_floor: number
  silenced_cap: number
}

/** GET /stats/overview（service_impl_core.go 聚合面）。 */
export interface StatsOverview {
  window_days: number
  generated_at: string
  repos: RepoStatsRow[]
  repo_count: number
  tasks_done: number
  verdicts: { approve: number; comment: number; request_changes: number }
  tokens_used: number
  findings_suppressed: number
  reply_throttled: number
  silenced_floor: number
  silenced_cap: number
}

/** 月度 token 账本行（storage.RepoTokenUsage）。 */
export interface RepoTokenUsage {
  platform: string
  owner: string
  repo: string
  tokens: number
  tasks: number
}

/** GET /usage/monthly（三账本：quota=done / real=实销 / reserved=在途预留）。 */
export interface UsageMonthly {
  month: string
  total: number
  budget: number
  repos: RepoTokenUsage[]
  real_total: number
  real_budget: number
  real_repos: RepoTokenUsage[]
  reserved_total: number
  reserved_repos: RepoTokenUsage[]
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

/** 受控推送就绪态预览（GET /fix-push/preview）。 */
export interface FixPushPreview {
  task_id?: string
  head_sha?: string
  fix_status?: string
  ready: boolean
  message: string
  pending_approvals: number
  mode?: string
}

/** 受控推送确认结果（POST /fix-push/confirm）。 */
export interface FixPushResult {
  status: string
  message: string
  task_id?: string
  head_sha?: string
  fix_status?: string
}

/** 实例成员（GET /auth/members，v8.8.0；admin 面，无凭证字段）。 */
export interface MemberRow {
  username: string
  role: string
  created_at?: number
}

/** 仓库 PR/MR 行（GET /repos/crs，v8.8.1；平台 ChangeRequest 面）。 */
export interface RepoCR {
  number: string
  title: string
  state?: string
  draft?: boolean
  source_branch?: string
  target_branch?: string
  author?: string
  head_sha?: string
  web_url?: string
}

/** 仓库分支清单（GET /repos/branches，v8.8.0；平台 SDK 分支面）。 */
export interface RepoBranches {
  default_branch?: string
  branches: string[]
}

/** 邀请历史行（GET /auth/invites/history，v8.8.2；无 token 字段）。 */
export interface InviteRow {
  invite_id: string
  role: string
  status: string
  username?: string
  created_by?: string
  created_at?: number
  expires_at?: number
  used_at?: number
}

/** 插件清单行（GET /agents；kind/protocol 为 IDL 枚举数值）。 */
export interface AgentManifest {
  name: string
  kind?: number
  skills?: string[]
  enabled: boolean
  cost?: string
  timeoutMs?: number
  version?: string
  protocol?: number
  needs?: string[]
  triggerPaths?: string[]
  triggerLabels?: string[]
}

/** .reviewagents.yaml 生效视图（三参全传时返回）。 */
export interface RepoConfigView {
  loaded: boolean
  use?: string[]
  disable?: string[]
  routing?: { paths?: string[]; labels?: string[]; use?: string[] }[]
  warnings?: string[]
  plugins?: { name: string; repoEffect?: string; routedBy?: string; note?: string }[]
}

/** 任务进度事件（SSE /events data 载荷；字段与服务端 progress.Event 对账）。 */
export interface TaskEvent {
  type?: string
  task_id?: string
  status?: string
  verdict?: string
  stage?: string
  platform?: string
  owner?: string
  repo?: string
  number?: string
  at?: string
}

/** 控制台选项聚合面（GET /console/options，v8.7.0）：下拉单源数据。 */
export interface ConsoleOptions {
  platforms: string[]
  /** IDL TaskKind 数值码（CreateTask wire 面直接可用）+ canonical 词表名。 */
  kinds: { value: number; name: string }[]
  statuses: string[]
  /** tenant_repos 登记面（服务端已按租户 + token 仓库约束行过滤）。 */
  repos: { platform: string; owner: string; repo: string }[]
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

/** 把 unknown 异常收窄为 ApiError（页面统一 `catch (e) { ... }` 后调用）。 */
export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}

/** 异常 → 可展示文案（避免各页手写 `e?.message || '...'` 的 any 断言）。 */
export function errMsg(e: unknown, fallback: string): string {
  if (isApiError(e)) return e.message
  if (e instanceof Error && e.message) return e.message
  return fallback
}

async function request<T>(
  path: string,
  opts: {
    method?: string
    body?: unknown
    query?: Record<string, string | number | boolean | undefined | null>
  } = {},
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
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* 非 JSON */
  }
  const payload = json as { code?: number; data?: unknown; message?: string } | null
  if (!res.ok) {
    throw new ApiError(res.status, payload?.code, payload?.message || text || res.statusText)
  }
  if (payload && typeof payload === 'object' && 'code' in payload && 'data' in payload) {
    if (payload.code !== 0 && payload.code !== 200) {
      throw new ApiError(res.status, payload.code, payload.message || '请求失败')
    }
    return payload.data as T
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

  listTasks: async (query?: {
    status?: string
    limit?: number
    /** v8.8.2 控制台筛选面：仓库三元组 / 类型 / 关键词。 */
    platform?: string
    owner?: string
    repo?: string
    kind?: string
    q?: string
  }) => {
    const res = await request<{ tasks?: TaskRow[] } | TaskRow[]>('/tasks', { query: query })
    const arr = Array.isArray(res) ? res : (res?.tasks ?? [])
    return arr.map(normalizeTask)
  },
  getTask: async (id: string) =>
    normalizeTask(await request<TaskRow>(`/tasks/${encodeURIComponent(id)}`)),
  getTaskStages: (id: string) =>
    request<{
      task_id?: string
      status?: string
      verdict?: string
      stages?: { stage: string; done: boolean }[]
    }>(`/tasks/${encodeURIComponent(id)}/stages`),
  createTask: (payload: {
    kind?: number
    platform: string
    owner: string
    repo: string
    number: string
  }) =>
    request<{ taskId?: string; status?: string; duplicated?: boolean }>('/tasks', {
      method: 'POST',
      body: payload,
    }),
  statsOverview: (query?: { days?: number; platform?: string; owner?: string; repo?: string }) =>
    request<StatsOverview>('/stats/overview', { query: query }),
  usageMonthly: () => request<UsageMonthly>('/usage/monthly'),
  /** 控制台下拉选项单源（platforms/kinds/statuses/repos；v8.7.0）。 */
  consoleOptions: () => request<ConsoleOptions>('/console/options'),
  /** 实例成员清单（admin；v8.8.0）。 */
  members: () => request<{ members?: MemberRow[] }>('/auth/members'),
  /** 邀请历史（admin；v8.8.2）。 */
  inviteHistory: () => request<{ invites?: InviteRow[] }>('/auth/invites/history'),
  /** 插件清单（可选仓库三元组；三参全传附 .reviewagents.yaml 生效视图）。 */
  listAgents: (query?: { platform?: string; owner?: string; repo?: string }) =>
    request<{ agents?: AgentManifest[]; repo_config?: RepoConfigView }>('/agents', {
      query: query,
    }),
  /** 仓库分支清单 + 默认分支（v8.8.0）。 */
  repoBranches: (query: { platform: string; owner: string; repo: string }) =>
    request<RepoBranches>('/repos/branches', { query: query }),
  /** 仓库 PR/MR 列表（v8.8.1；默认 opened，供 PR 号下拉）。 */
  repoCRs: (query: {
    platform: string
    owner: string
    repo: string
    state?: string
    limit?: number
  }) => request<{ items?: RepoCR[] }>('/repos/crs', { query: query }),

  listFixApprovals: (query: { platform: string; owner: string; repo: string; number: string }) =>
    request<{ tickets: FixTicket[]; pending_count?: number; head_sha?: string }>('/fix-approvals', {
      query: query,
    }),
  decideFixApproval: (payload: { id: string; decision: string; reason?: string }) =>
    request<{ id: string; status: string; changed: boolean; message?: string }>(
      '/fix-approvals/decide',
      { method: 'POST', body: payload },
    ),

  mergeEligibility: (query: { platform: string; owner: string; repo: string; number: string }) =>
    request<{ eligibility: MergeEligibility }>('/merges/eligibility', { query: query }),
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
    request<FixPushPreview>('/fix-push/preview', { query: query }),
  fixPushConfirm: (payload: { task_id: string; expected_remote_head: string }) =>
    request<FixPushResult>('/fix-push/confirm', { method: 'POST', body: payload }),

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
      { query: query },
    ),

  // ---- 仓库设置（/repo-settings；写档 admin，仓库维度授权） ----
  listRepoSettings: () => request<{ settings?: RepoSettingRow[] }>('/repo-settings'),
  getRepoSettings: (platform: string, owner: string, repo: string) =>
    request<RepoSettingRow>(
      `/repo-settings/${encodeURIComponent(platform)}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    ),
  putRepoSettings: (platform: string, owner: string, repo: string, settings: RepoSettingsValues) =>
    request<RepoSettingRow>(
      `/repo-settings/${encodeURIComponent(platform)}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { method: 'PUT', body: settings },
    ),
  deleteRepoSettings: (platform: string, owner: string, repo: string) =>
    request<{ deleted: boolean }>(
      `/repo-settings/${encodeURIComponent(platform)}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { method: 'DELETE' },
    ),

  // ---- 意见治理（/findings）：清单 read 档，抑制/恢复 admin 档 ----
  listFindings: (query: {
    platform: string
    owner: string
    repo: string
    status?: string
    limit?: number
  }) =>
    request<{
      findings?: FindingRow[]
      counts?: FindingCounts
      /** v8.5.2：严重度分布（仓内全量，非当前页）。 */
      severity_counts?: Record<string, number>
      /** v8.5.2：噪声最高文件（按出现次数降序，最多 10 条）。 */
      top_files?: { file: string; total: number; suppressed: number }[]
      limit?: number
    }>('/findings', { query: query }),
  suppressFinding: (payload: {
    platform: string
    owner: string
    repo: string
    number: string
    fingerprint: string
  }) =>
    request<{ matched: boolean; fingerprint: string }>('/findings/suppress', {
      method: 'POST',
      body: payload,
    }),
  restoreFinding: (payload: {
    platform: string
    owner: string
    repo: string
    number: string
    fp: string
  }) => request<{ matched: boolean }>('/findings/restore', { method: 'POST', body: payload }),
}

/** 仓库设置值集（与后端 reposettings.Settings JSON 契约一致；缺省=继承全局）。 */
export interface RepoSettingsValues {
  monthly_token_budget?: number
  task_token_budget?: number
  max_diff_chars?: number
  report_template?: string
  comment_throttle_minutes?: number
  findings_cap?: number
  severity_floor?: string
  ocr_delegate_enabled?: boolean
}

export interface RepoSettingRow {
  platform: string
  owner: string
  repo: string
  settings?: RepoSettingsValues
  settings_json?: string
  updated_by?: string
  updated_at?: string
}

/**
 * subscribeEvents —— /events SSE 订阅（v8.8.2 控制台实时刷新）。
 *
 * EventSource 不能带 Authorization 头，这里用 fetch + ReadableStream 手工分帧
 * （event:/data: 行，空行分帧；": " 注释保活帧忽略）。返回退订函数（abort）。
 *
 * 断线自动重连：服务端滚动重启/网络抖动后指数退避重试（1s 起倍增，封顶 30s）；
 * 流有字节流动即视为健康并重置退避（保活帧也算）。手动退订后不再重连。
 */
const SSE_RETRY_INITIAL_MS = 1_000
const SSE_RETRY_MAX_MS = 30_000

export function subscribeEvents(onEvent: (e: TaskEvent) => void): () => void {
  const ctrl = new AbortController()
  let stopped = false
  let retryMs = SSE_RETRY_INITIAL_MS

  const connect = async () => {
    for (;;) {
      if (stopped) return
      try {
        const headers: Record<string, string> = { Accept: 'text/event-stream' }
        const tok = getToken()
        if (tok) headers.Authorization = `Bearer ${tok}`
        const res = await fetch(`${API_BASE}/events`, { headers, signal: ctrl.signal })
        if (!res.ok || !res.body) throw new Error(`events ${res.status}`)
        const reader = res.body.getReader()
        const dec = new TextDecoder()
        let buf = ''
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          if (value?.length) retryMs = SSE_RETRY_INITIAL_MS // 流动中=健康，退避归零
          buf += dec.decode(value, { stream: true })
          let idx = buf.indexOf('\n\n')
          while (idx >= 0) {
            const frame = buf.slice(0, idx)
            buf = buf.slice(idx + 2)
            let data = ''
            for (const line of frame.split('\n')) {
              if (line.startsWith('data:')) data += line.slice(5).trim()
            }
            if (data) {
              try {
                onEvent(JSON.parse(data) as TaskEvent)
              } catch {
                /* 非 JSON 帧（保活等）忽略 */
              }
            }
            idx = buf.indexOf('\n\n')
          }
        }
      } catch {
        /* abort / 网络中断：落到下方重连判定 */
      }
      // 主动退订（abort）不再重连；异常结束/服务端主动断开则按退避重试。
      if (stopped || ctrl.signal.aborted) return
      await new Promise((resolve) => setTimeout(resolve, retryMs))
      retryMs = Math.min(retryMs * 2, SSE_RETRY_MAX_MS)
    }
  }
  void connect()
  return () => {
    stopped = true
    ctrl.abort()
  }
}
