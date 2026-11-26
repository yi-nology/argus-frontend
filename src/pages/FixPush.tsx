import { useEffect, useRef, useState } from 'react'
import {
  Alert, App, Button, Card, Col, Descriptions, Input, Popconfirm, Row,
  Space, Spin, Statistic, Tag, Typography,
} from 'antd'
import {
  AuditOutlined, CheckCircleFilled, CheckCircleOutlined, CloseCircleFilled,
  ReloadOutlined, SearchOutlined, SendOutlined, WarningOutlined,
} from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, type TaskRow } from '../api/client'
import RepoPicker, { useConsoleOptions, type Coords } from '../components/RepoPicker'
import RecentTaskPicker from '../components/RecentTaskPicker'
import PRPicker from '../components/PRPicker'
import { useAuth } from '../auth/AuthContext'

interface FixPushPreview {
  task_id?: string
  head_sha?: string
  fix_status?: string
  ready: boolean
  message: string
  pending_approvals: number
  mode?: string
}

interface FixPushResult {
  status: string
  message: string
  task_id?: string
  head_sha?: string
  fix_status?: string
}

/** 推送成功状态词（后端 FixPushConfirmResponse.status）。 */
const OK_STATUS = new Set(['pushed', 'pr_created', 'cr_existed'])

const STEPS = [
  { title: '预览就绪态', desc: '只读校验任务、当前 head 与待审批高危票，不写远端。' },
  { title: '高危审批', desc: 'critical / high 逐票批准（maintainer），缺票不可推送。' },
  { title: '确认推送', desc: '绑定 expected_remote_head；head 变更后拒绝，可读回对账。' },
]

export default function FixPush() {
  const { message } = App.useApp()
  const { user, can } = useAuth()
  const canDecide = can('decide_review')
  const nav = useNavigate()
  const [params] = useSearchParams()
  const opts = useConsoleOptions()
  const [coords, setCoords] = useState<Coords>({
    platform: params.get('platform') || opts?.platforms?.[0] || '',
    owner: params.get('owner') || '',
    repo: params.get('repo') || '',
  })
  const [number, setNumber] = useState<number | null>(
    params.get('number') ? Number(params.get('number')) : null,
  )
  const [prev, setPrev] = useState<FixPushPreview | null>(null)
  const [result, setResult] = useState<FixPushResult | null>(null)
  const [tasks, setTasks] = useState<TaskRow[]>([])
  /** 最近任务选中项（推送环未启用时 preview 不返回 task_id/head，用任务清单补展示）。 */
  const [pickedTaskId, setPickedTaskId] = useState<string | undefined>()
  const [forbidden, setForbidden] = useState(false)
  const [busy, setBusy] = useState(false)

  const query = (c: Coords = coords, n: number | null = number) => ({
    platform: c.platform,
    owner: c.owner.trim(),
    repo: c.repo.trim(),
    number: String(n ?? ''),
  })

  const doPreview = async (q: { platform: string; owner: string; repo: string; number: string }) => {
    if (!q.platform || !q.owner || !q.repo || !q.number) {
      message.warning('请完整选择仓库并填写 PR 号')
      return
    }
    setBusy(true)
    setForbidden(false)
    setResult(null)
    try {
      const r = await api.fixPushPreview(q)
      setPrev(r)
    } catch (e: any) {
      setPrev(null)
      if (e?.status === 403) {
        setForbidden(true)
        message.warning('无业务裁定权限：需要 maintainer 角色')
      } else {
        message.error(e?.message || '预览失败')
      }
    } finally {
      setBusy(false)
    }
  }

  const preview = () => {
    setPickedTaskId(undefined)
    void doPreview(query())
  }

  // 最近任务清单（供仍计算法用；失败不阻断手填坐标）。
  useEffect(() => {
    api.listTasks({ limit: 30 })
      .then((rows) => {
        const list = rows.filter((t) => !!t.head_sha && !!t.id)
        setTasks(list)
        const p = params.get('platform')
        const o = params.get('owner')
        const r = params.get('repo')
        const n = params.get('number')
        const match = list.find((t) =>
          t.platform === p && t.owner === o &&
          t.repo === r && String(t.number) === n)
        if (match) setPickedTaskId((match.id || match.task_id) as string)
      })
      .catch(() => {/* 任务清单失败不阻断手填 */})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 深链带入坐标时自动预览；同路由换参数也重跑。
  const deepLink = params.toString()
  const lastDeepLink = useRef('')
  useEffect(() => {
    if (!deepLink || deepLink === lastDeepLink.current) return
    lastDeepLink.current = deepLink
    const p = params.get('platform')
    const o = params.get('owner')
    const r = params.get('repo')
    const n = params.get('number')
    if (p && o && r && n) {
      setCoords({ platform: p, owner: o, repo: r })
      setNumber(Number(n) || null)
      void doPreview({ platform: p, owner: o, repo: r, number: n })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink])

  const pickTask = (t: TaskRow) => {
    const c: Coords = { platform: t.platform || '', owner: t.owner || '', repo: t.repo || '' }
    const n = Number(t.number) || null
    setCoords(c)
    setNumber(n)
    setPickedTaskId((t.id || t.task_id) as string)
    void doPreview({ ...c, owner: c.owner, number: String(t.number || '') })
  }

  const confirm = async () => {
    if (!prev?.ready || !prev.task_id || !prev.head_sha) return
    setBusy(true)
    try {
      const r = await api.fixPushConfirm({
        task_id: prev.task_id,
        expected_remote_head: prev.head_sha,
      })
      setResult({
        status: r.status, message: r.message,
        task_id: prev.task_id, head_sha: r.head_sha || prev.head_sha, fix_status: r.fix_status,
      })
      if (OK_STATUS.has(r.status)) {
        message.success(`推送完成：${r.status} — ${r.message}`)
      } else {
        message.warning(`未推送：${r.status} — ${r.message}`)
      }
      // 回读就绪态：pushed/failed 后按钮应消失，避免重复确认。
      const next = await api.fixPushPreview(query()).catch(() => null)
      setPrev(next)
    } catch (e: any) {
      message.error(e?.message || '确认失败')
    } finally {
      setBusy(false)
    }
  }

  const approvalsLink = () => {
    const v = query()
    return `/approvals?platform=${encodeURIComponent(v.platform)}&owner=${encodeURIComponent(v.owner)}&repo=${encodeURIComponent(v.repo)}&number=${encodeURIComponent(v.number)}`
  }

  const pickedTask = tasks.find((t) => (t.id || t.task_id) === pickedTaskId)
  const knownTaskId = prev?.task_id || pickedTaskId
  const knownHead = prev?.head_sha || pickedTask?.head_sha
  const confirmable = !!prev?.ready && prev.mode === 'confirm' && !!prev.task_id && !!prev.head_sha

  const checks = prev
    ? [
        { ok: !!knownTaskId, label: '任务存在' },
        { ok: !!knownHead, label: 'head 已绑定' },
        { ok: prev.mode === 'confirm', label: `推送模式 ${prev.mode || '—'}` },
        { ok: !!knownTaskId && (prev.pending_approvals ?? 0) === 0, label: `高危审批齐备（${prev.pending_approvals ?? 0} 待批）` },
        { ok: prev.ready, label: '后端判定就绪' },
      ]
    : []

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        受控推送
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        预览 → 审批 → 确认三步。预览只读；确认前须高危审批票全部通过，且绑定当前
        expected_remote_head（head 变更会被拒绝）。
      </Typography.Paragraph>

      {!canDecide && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="当前账号无推送裁定权限"
          description={`受控推送属于 maintainer 角色；当前角色为 ${user?.role || '—'}。`}
        />
      )}
      {forbidden && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="推送预览被拒绝（403）"
          description="该接口要求 admin 档 + 业务裁定角色（maintainer），平台 admin 刻意无推送权。"
        />
      )}

      <Card className="glass" style={{ marginBottom: 16 }}>
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <RecentTaskPicker
            onPick={pickTask}
            disabled={!canDecide}
            placeholder="从最近任务载入（自动填充并预览）"
            style={{ width: '100%', maxWidth: 640 }}
          />
          <Space wrap size={10}>
            <RepoPicker value={coords} onChange={setCoords} disabled={!canDecide} />
            <PRPicker
              coords={coords}
              value={number}
              style={{ width: 170 }}
              disabled={!canDecide}
              onChange={(v) => setNumber(v ?? null)}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              loading={busy}
              disabled={!canDecide}
              onClick={preview}
            >
              预览就绪态
            </Button>
          </Space>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            从任务详情跳转会带入坐标并自动预览；也可直接选择仓库坐标。
          </Typography.Text>
        </Space>
      </Card>

      {!prev && (
        <Row gutter={[12, 12]}>
          {STEPS.map((s, i) => (
            <Col xs={24} md={8} key={s.title}>
              <Card className="glass" size="small" style={{ height: '100%' }}>
                <Space align="start" size={10}>
                  <span
                    style={{
                      flex: '0 0 22px', width: 22, height: 22, borderRadius: 11,
                      display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700,
                      color: '#0b1220', background: '#5b8def',
                    }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <Typography.Text strong>{s.title}</Typography.Text>
                    <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4, lineHeight: 1.55 }}>
                      {s.desc}
                    </div>
                  </div>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {result && (
        <Card
          className="glass"
          size="small"
          style={{ marginBottom: 16 }}
          title={
            <Space>
              推送结果
              <Tag color={OK_STATUS.has(result.status) ? 'success' : 'warning'}>{result.status}</Tag>
            </Space>
          }
          extra={result.task_id && (
            <Button size="small" onClick={() => nav(`/tasks/${result.task_id}`)}>查看任务</Button>
          )}
        >
          <Space orientation="vertical" size={6}>
            <Typography.Text>{result.message}</Typography.Text>
            <Typography.Text type="secondary" className="mono" style={{ fontSize: 12 }}>
              task {result.task_id || '—'} · head {(result.head_sha || '').slice(0, 16) || '—'} · fix_status {result.fix_status || '—'}
            </Typography.Text>
          </Space>
        </Card>
      )}

      <Spin spinning={busy}>
        {prev && (
          <Card
            className="glass"
            title={
              <Space>
                就绪态
                <Tag color={confirmable ? 'success' : 'warning'}>
                  {confirmable ? '可推送' : '不可推送'}
                </Tag>
                {prev.mode && <Tag>mode: {prev.mode}</Tag>}
              </Space>
            }
            extra={
              <Space>
                {knownTaskId && (
                  <Button size="small" onClick={() => nav(`/tasks/${knownTaskId}`)}>任务详情</Button>
                )}
                <Button size="small" icon={<ReloadOutlined />} onClick={preview}>刷新</Button>
              </Space>
            }
          >
            <Space wrap size={[8, 8]} style={{ marginBottom: 16 }}>
              {checks.map((c) => (
                <Tag
                  key={c.label}
                  color={c.ok ? 'success' : 'error'}
                  icon={c.ok ? <CheckCircleFilled /> : <CloseCircleFilled />}
                >
                  {c.label}
                </Tag>
              ))}
            </Space>

            <Row gutter={[24, 12]} style={{ marginBottom: 16 }}>
              <Col xs={12} md={5}>
                <Statistic
                  title="待审批高危票"
                  value={prev.pending_approvals ?? 0}
                  styles={{ content: { color: prev.pending_approvals ? '#f0b429' : undefined } }}
                />
              </Col>
              <Col xs={24} md={19}>
                <Descriptions
                  size="small"
                  column={{ xs: 1, md: 2 }}
                  colon={false}
                  items={[
                    { key: 'task', label: '任务', children: <span className="mono">{knownTaskId || '—'}</span> },
                    { key: 'head', label: 'head', children: <span className="mono">{(knownHead || '').slice(0, 16) || '—'}</span> },
                    { key: 'fix', label: '修复状态', children: <Tag>{prev.fix_status || '—'}</Tag> },
                    { key: 'mode', label: '推送模式', children: <Tag>{prev.mode || '—'}</Tag> },
                  ]}
                />
              </Col>
            </Row>

            <Alert
              showIcon
              type={confirmable ? 'success' : 'warning'}
              icon={confirmable ? <CheckCircleOutlined /> : <WarningOutlined />}
              title={confirmable ? '审批齐备，可确认推送' : '暂不可确认'}
              description={prev.message}
              action={
                prev.pending_approvals > 0 ? (
                  <Button size="small" icon={<AuditOutlined />} onClick={() => nav(approvalsLink())}>
                    去审批
                  </Button>
                ) : undefined
              }
            />

            {confirmable && (
              <div style={{ marginTop: 16 }}>
                <Row gutter={[16, 12]}>
                  <Col xs={24} md={12}>
                    <Typography.Text type="secondary">task_id（来自预览，只读）</Typography.Text>
                    <Input className="mono" readOnly value={prev.task_id} />
                  </Col>
                  <Col xs={24} md={12}>
                    <Typography.Text type="secondary">expected_remote_head（来自预览，只读）</Typography.Text>
                    <Input className="mono" readOnly value={prev.head_sha} />
                  </Col>
                </Row>
                <Space style={{ marginTop: 16 }} wrap>
                  <Popconfirm
                    title="确认推送？该操作不可撤销"
                    description="后端会再次校验审批票与 expected_remote_head；head 变更会拒绝。"
                    okText="确认推送"
                    okButtonProps={{ danger: true }}
                    cancelText="取消"
                    onConfirm={confirm}
                  >
                    <Button danger type="primary" icon={<SendOutlined />} loading={busy}>
                      确认推送
                    </Button>
                  </Popconfirm>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    推送目标为当前 head 对应的修复分支；失败会返回明确状态。
                  </Typography.Text>
                </Space>
              </div>
            )}
          </Card>
        )}
      </Spin>
    </div>
  )
}