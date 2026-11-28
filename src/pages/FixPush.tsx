import { useState } from 'react'
import {
  Alert,
  App,
  Button,
  Col,
  Descriptions,
  Input,
  Popconfirm,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
} from 'antd'
import {
  AuditOutlined,
  CheckCircleFilled,
  CheckCircleOutlined,
  CloseCircleFilled,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useNavigate, useSearchParams } from '@umijs/max'
import {
  api,
  errMsg,
  isApiError,
  type FixPushPreview,
  type FixPushResult,
  type TaskRow,
} from '../api/client'
import { Panel } from '../components/Widgets'
import RepoPicker, { useConsoleOptions, type Coords } from '../components/RepoPicker'
import RecentTaskPicker from '../components/RecentTaskPicker'
import PRPicker from '../components/PRPicker'
import { PermissionBanners, useCanDecide } from '../components/PermissionBanners'
import { scopeQuery, useDeepLink } from '../hooks/useDeepLink'
import { useApi } from '../hooks/useApi'
import { t } from '../theme/tokens'

/**
 * 推送成功状态词：镜像后端 FixPushConfirmResponse.status 的状态词表
 * （pushed / pr_created / cr_existed），不在此扩展语义。
 */
const OK_STATUS = new Set(['pushed', 'pr_created', 'cr_existed'])

type PreviewQuery = { platform: string; owner: string; repo: string; number: string }

const STEPS = [
  { title: '预览就绪态', desc: '只读校验任务、当前 head 与待审批高危票，不写远端。' },
  { title: '高危审批', desc: 'critical / high 逐票批准（maintainer），缺票不可推送。' },
  { title: '确认推送', desc: '绑定 expected_remote_head；head 变更后拒绝，可读回对账。' },
]

export default function FixPush() {
  const { message } = App.useApp()
  const canDecide = useCanDecide()
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
  /** 最近任务选中项（推送环未启用时 preview 不返回 task_id/head，用任务清单补展示）。 */
  const [pickedTaskId, setPickedTaskId] = useState<string | undefined>()
  const [forbidden, setForbidden] = useState(false)

  const { loading: previewing, run: runPreview } = useApi(api.fixPushPreview, {
    manual: true,
    onSuccess: (r) => setPrev(r),
    onError: (e) => {
      setPrev(null)
      if (isApiError(e) && e.status === 403) {
        setForbidden(true)
        message.warning('无业务裁定权限：需要 maintainer 角色')
      } else {
        message.error(errMsg(e, '预览失败'))
      }
    },
  })

  const doPreview = (q: PreviewQuery) => {
    if (!q.platform || !q.owner || !q.repo || !q.number) {
      message.warning('请完整选择仓库并填写 PR 号')
      return
    }
    setForbidden(false)
    setResult(null)
    void runPreview(q)
  }

  const preview = () => {
    setPickedTaskId(undefined)
    void doPreview({
      platform: coords.platform,
      owner: coords.owner.trim(),
      repo: coords.repo.trim(),
      number: String(number ?? ''),
    })
  }

  // 最近任务清单（供仍计算法用；失败不阻断手填坐标）。
  const { data: tasksRes } = useApi(
    async () => {
      const rows = await api.listTasks({ limit: 30 })
      const list = rows.filter((row) => !!row.head_sha && !!row.id)
      const p = params.get('platform')
      const o = params.get('owner')
      const r = params.get('repo')
      const n = params.get('number')
      const match = list.find(
        (task) =>
          task.platform === p && task.owner === o && task.repo === r && String(task.number) === n,
      )
      return { list, pickedId: match?.id || match?.task_id }
    },
    {
      onSuccess: (d) => {
        if (d.pickedId) setPickedTaskId(d.pickedId)
      },
    },
  )
  const tasks = tasksRes?.list ?? []

  // 深链带入坐标时自动预览；同路由换参数也重跑。
  useDeepLink((c, n) => {
    setCoords(c)
    setNumber(n)
    void doPreview({ platform: c.platform, owner: c.owner, repo: c.repo, number: String(n ?? '') })
  })

  const pickTask = (task: TaskRow) => {
    const c: Coords = {
      platform: task.platform || '',
      owner: task.owner || '',
      repo: task.repo || '',
    }
    const n = Number(task.number) || null
    setCoords(c)
    setNumber(n)
    setPickedTaskId((task.id || task.task_id) as string)
    void doPreview({ ...c, owner: c.owner, number: String(task.number || '') })
  }

  const { loading: confirming, run: runConfirm } = useApi(
    // _q 只经 params 透传给 onSuccess 的回读（请求本身不需要）。
    (taskId: string, headSha: string, _q: PreviewQuery) =>
      api.fixPushConfirm({ task_id: taskId, expected_remote_head: headSha }),
    {
      manual: true,
      onSuccess: (r, [taskId, headSha, q]) => {
        setResult({
          status: r.status,
          message: r.message,
          task_id: taskId,
          head_sha: r.head_sha || headSha,
          fix_status: r.fix_status,
        })
        if (OK_STATUS.has(r.status)) {
          message.success(`推送完成：${r.status} — ${r.message}`)
        } else {
          message.warning(`未推送：${r.status} — ${r.message}`)
        }
        // 回读就绪态：pushed/failed 后按钮应消失，避免重复确认。
        void api
          .fixPushPreview(q)
          .then(setPrev)
          .catch(() => setPrev(null))
      },
      onError: (e) => message.error(errMsg(e, '确认失败')),
    },
  )

  const confirm = () => {
    if (!prev?.ready || !prev.task_id || !prev.head_sha) return
    void runConfirm(prev.task_id, prev.head_sha, {
      platform: coords.platform,
      owner: coords.owner.trim(),
      repo: coords.repo.trim(),
      number: String(number ?? ''),
    })
  }

  const approvalsLink = () => `/approvals${scopeQuery(coords, number)}`

  const busy = previewing || confirming
  const pickedTask = tasks.find((task) => (task.id || task.task_id) === pickedTaskId)
  const knownTaskId = prev?.task_id || pickedTaskId
  const knownHead = prev?.head_sha || pickedTask?.head_sha
  const confirmable = !!prev?.ready && prev.mode === 'confirm' && !!prev.task_id && !!prev.head_sha

  const checks = prev
    ? [
        { ok: !!knownTaskId, label: '任务存在' },
        { ok: !!knownHead, label: 'head 已绑定' },
        { ok: prev.mode === 'confirm', label: `推送模式 ${prev.mode || '—'}` },
        {
          ok: !!knownTaskId && (prev.pending_approvals ?? 0) === 0,
          label: `高危审批齐备（${prev.pending_approvals ?? 0} 待批）`,
        },
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

      <PermissionBanners canDecide={canDecide} forbidden={forbidden} />

      <Panel style={{ marginBottom: t.space.lg }}>
        <Space orientation="vertical" size={t.space.md} style={{ width: '100%' }}>
          <RecentTaskPicker
            onPick={pickTask}
            disabled={!canDecide}
            placeholder="从最近任务载入（自动填充并预览）"
            style={{ width: '100%', maxWidth: 640 }}
          />
          <Space wrap size={t.space.md}>
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
          <Typography.Text type="secondary" className="meta-sm">
            从任务详情跳转会带入坐标并自动预览；也可直接选择仓库坐标。
          </Typography.Text>
        </Space>
      </Panel>

      {!prev && (
        <Row gutter={[t.space.md, t.space.md]}>
          {STEPS.map((s, i) => (
            <Col xs={24} md={8} key={s.title}>
              <Panel bodyStyle={{ padding: t.space.md }} style={{ height: '100%' }}>
                <Space align="start" size={t.space.md}>
                  <span
                    className="t-xs"
                    style={{
                      flex: `0 0 ${t.space.xxl}px`,
                      width: t.space.xxl,
                      height: t.space.xxl,
                      borderRadius: t.radius.xl,
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: t.weight.semibold,
                      color: t.color.surface,
                      background: t.color.accent,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <Typography.Text strong>{s.title}</Typography.Text>
                    <div
                      className="meta-sm"
                      style={{ marginTop: t.space.xs, lineHeight: t.line.normal }}
                    >
                      {s.desc}
                    </div>
                  </div>
                </Space>
              </Panel>
            </Col>
          ))}
        </Row>
      )}

      {result && (
        <Panel
          bodyStyle={{ padding: t.space.md }}
          style={{ marginBottom: t.space.lg }}
          title={
            <Space>
              推送结果
              <Tag color={OK_STATUS.has(result.status) ? 'success' : 'warning'}>
                {result.status}
              </Tag>
            </Space>
          }
          extra={
            result.task_id && (
              <Button size="small" onClick={() => nav(`/tasks/${result.task_id}`)}>
                查看任务
              </Button>
            )
          }
        >
          <Space orientation="vertical" size={t.space.sm}>
            <Typography.Text>{result.message}</Typography.Text>
            <Typography.Text type="secondary" className="mono meta-sm">
              task {result.task_id || '—'} · head {(result.head_sha || '').slice(0, 16) || '—'} ·
              fix_status {result.fix_status || '—'}
            </Typography.Text>
          </Space>
        </Panel>
      )}

      <Spin spinning={busy}>
        {prev && (
          <Panel
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
                  <Button size="small" onClick={() => nav(`/tasks/${knownTaskId}`)}>
                    任务详情
                  </Button>
                )}
                <Button size="small" icon={<ReloadOutlined />} onClick={preview}>
                  刷新
                </Button>
              </Space>
            }
          >
            <Space wrap size={[t.space.sm, t.space.sm]} style={{ marginBottom: t.space.lg }}>
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

            <Row gutter={[t.space.xxl, t.space.md]} style={{ marginBottom: t.space.lg }}>
              <Col xs={12} md={5}>
                <Statistic
                  title="待审批高危票"
                  value={prev.pending_approvals ?? 0}
                  styles={{
                    content: { color: prev.pending_approvals ? t.color.attention : undefined },
                  }}
                />
              </Col>
              <Col xs={24} md={19}>
                <Descriptions
                  size="small"
                  column={{ xs: 1, md: 2 }}
                  colon={false}
                  items={[
                    {
                      key: 'task',
                      label: '任务',
                      children: <span className="mono">{knownTaskId || '—'}</span>,
                    },
                    {
                      key: 'head',
                      label: 'head',
                      children: (
                        <span className="mono">{(knownHead || '').slice(0, 16) || '—'}</span>
                      ),
                    },
                    {
                      key: 'fix',
                      label: '修复状态',
                      children: <Tag>{prev.fix_status || '—'}</Tag>,
                    },
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
                  <Button
                    size="small"
                    icon={<AuditOutlined />}
                    onClick={() => nav(approvalsLink())}
                  >
                    去审批
                  </Button>
                ) : undefined
              }
            />

            {confirmable && (
              <div style={{ marginTop: t.space.lg }}>
                <Row gutter={[t.space.lg, t.space.md]}>
                  <Col xs={24} md={12}>
                    <Typography.Text type="secondary">task_id（来自预览，只读）</Typography.Text>
                    <Input className="mono" readOnly value={prev.task_id} />
                  </Col>
                  <Col xs={24} md={12}>
                    <Typography.Text type="secondary">
                      expected_remote_head（来自预览，只读）
                    </Typography.Text>
                    <Input className="mono" readOnly value={prev.head_sha} />
                  </Col>
                </Row>
                <Space style={{ marginTop: t.space.lg }} wrap>
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
                  <Typography.Text type="secondary" className="meta-sm">
                    推送目标为当前 head 对应的修复分支；失败会返回明确状态。
                  </Typography.Text>
                </Space>
              </div>
            )}
          </Panel>
        )}
      </Spin>
    </div>
  )
}
