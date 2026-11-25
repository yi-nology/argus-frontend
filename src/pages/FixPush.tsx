import { useEffect, useState } from 'react'
import {
  Alert, App, Button, Card, Col, Descriptions, Form, Input, Popconfirm, Row, Select,
  Space, Spin, Statistic, Tag, Typography,
} from 'antd'
import {
  AuditOutlined, CheckCircleFilled, CheckCircleOutlined, CloseCircleFilled,
  HistoryOutlined, ReloadOutlined, SearchOutlined, SendOutlined,
  ThunderboltOutlined, WarningOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { api, type TaskRow } from '../api/client'
import { PLATFORMS } from '../constants/platforms'
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
  { title: '预览就绪态', desc: '只读校验任务、当前 head 与待审批高危票；不写远端。' },
  { title: '高危审批', desc: 'critical / high 逐票批准（maintainer）；缺票即 fail-closed。' },
  { title: '确认推送', desc: '绑定 expected_remote_head；陈旧 head 拒绝，失败可读回对账。' },
]

type Coords = { platform: string; owner: string; repo: string; number: string }

export default function FixPush() {
  const { message } = App.useApp()
  const { user, can } = useAuth()
  const canDecide = can('decide_review')
  const nav = useNavigate()
  const [form] = Form.useForm()
  const [prev, setPrev] = useState<FixPushPreview | null>(null)
  const [result, setResult] = useState<FixPushResult | null>(null)
  const [tasks, setTasks] = useState<TaskRow[]>([])
  /** 最近任务下拉当前选中项（backend 在推送环未启用时 preview 不返回 task_id/head，
   *  用任务清单里的已知值补展示与导航）。 */
  const [pickedTaskId, setPickedTaskId] = useState<string | undefined>()
  const [forbidden, setForbidden] = useState(false)
  const [busy, setBusy] = useState(false)

  const q = (): Coords => {
    const v = form.getFieldsValue()
    return {
      platform: v.platform as string,
      owner: (v.owner || '').trim(),
      repo: (v.repo || '').trim(),
      number: String(v.number ?? '').trim(),
    }
  }

  const doPreview = async (query: Coords) => {
    if (!query.platform || !query.owner || !query.repo || !query.number) {
      message.warning('请填写完整的仓库坐标与 PR 号')
      return
    }
    setBusy(true)
    setForbidden(false)
    setResult(null)
    try {
      const r = await api.fixPushPreview(query)
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
    void doPreview(q())
  }

  // 从任务详情/审批页带坐标跳转时预填并自动预览；同时载入最近任务供一键选择。
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const coords: Coords = {
      platform: sp.get('platform') || '',
      owner: sp.get('owner') || '',
      repo: sp.get('repo') || '',
      number: sp.get('number') || '',
    }
    if (coords.platform) {
      form.setFieldsValue(coords)
      if (coords.owner && coords.repo && coords.number) void doPreview(coords)
    }
    api.listTasks({ limit: 30 })
      .then((rows) => {
        const list = rows.filter((t) => !!t.head_sha && !!t.id)
        setTasks(list)
        // 带参跳转时把坐标对回任务清单，推送环未启用也能展示 task/head 与详情入口。
        const match = list.find((t) =>
          t.platform === coords.platform && t.owner === coords.owner &&
          t.repo === coords.repo && String(t.number) === coords.number)
        if (match) setPickedTaskId((match.id || match.task_id) as string)
      })
      .catch(() => {/* 任务清单失败不阻断手输 */})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pickTask = (id: string) => {
    const t = tasks.find((x) => (x.id || x.task_id) === id)
    if (!t) return
    const coords: Coords = {
      platform: t.platform || '',
      owner: t.owner || '',
      repo: t.repo || '',
      number: String(t.number || ''),
    }
    form.setFieldsValue(coords)
    setPickedTaskId((t.id || t.task_id) as string)
    void doPreview(coords)
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
      const next = await api.fixPushPreview(q()).catch(() => null)
      setPrev(next)
    } catch (e: any) {
      message.error(e?.message || '确认失败')
    } finally {
      setBusy(false)
    }
  }

  const approvalsLink = () => {
    const v = q()
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
        { ok: prev.ready, label: '后端判定 READY' },
      ]
    : []

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        受控推送 <span className="grad-text">Fix Push</span>
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        preview → 审批 → confirm 三步：预览只读；确认前需高危审批票全部通过，且绑定当前
        expected_remote_head（陈旧 head 会被拒绝）。
      </Typography.Paragraph>

      {!canDecide && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="当前账号无推送裁定权限"
          description={
            `平台管理（${user?.role || '—'}）与业务裁定物理分离：受控推送属于 maintainer 角色。` +
            '请用 maintainer 账号登录（或部署超管静态 token）后再操作。'
          }
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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          <HistoryOutlined style={{ color: '#5b8def' }} />
          <Select
            showSearch
            allowClear
            placeholder="从最近任务载入（自动填充并预览）"
            style={{ flex: '1 1 420px', maxWidth: 560 }}
            value={pickedTaskId}
            options={tasks.map((t) => ({
              value: t.id || t.task_id || '',
              label: `${t.platform}/${t.owner}/${t.repo}#${t.number} · ${t.status}`,
            }))}
            filterOption={(input, opt) =>
              String(opt?.label || '').toLowerCase().includes(input.toLowerCase())
            }
            onChange={(id) => {
              if (!id) { setPickedTaskId(undefined); return }
              pickTask(String(id))
            }}
            disabled={!canDecide}
          />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            从任务详情跳转会带入参数并自动预览；也可直接填写下方坐标
          </Typography.Text>
        </div>
        <Form form={form} layout="inline" onFinish={preview} style={{ rowGap: 10 }}>
          <Form.Item name="platform" initialValue="gitlab" rules={[{ required: true, message: '平台必填' }]}>
            <Select
              style={{ width: 150 }}
              options={PLATFORMS.map((p) => ({ label: p, value: p }))}
              placeholder="平台"
            />
          </Form.Item>
          <Form.Item name="owner" rules={[{ required: true, message: 'owner 必填' }]}>
            <Input placeholder="owner / 组织" style={{ width: 170 }} />
          </Form.Item>
          <Form.Item name="repo" rules={[{ required: true, message: 'repo 必填' }]}>
            <Input placeholder="仓库名（支持 ops/xxx）" style={{ width: 190 }} />
          </Form.Item>
          <Form.Item name="number" rules={[{ required: true, message: 'PR 号必填' }]}>
            <Input placeholder="PR #" style={{ width: 100 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={busy} disabled={!canDecide}>
              预览就绪态
            </Button>
          </Form.Item>
        </Form>
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
                      color: '#041018', background: 'linear-gradient(135deg,#5b8def,#8b7cf6)',
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
          <Space direction="vertical" size={6}>
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
                <ThunderboltOutlined style={{ color: '#5b8def' }} />
                就绪态
                <Tag color={confirmable ? 'success' : 'warning'}>
                  {confirmable ? 'READY' : 'NOT READY'}
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
                  valueStyle={{ color: prev.pending_approvals ? '#f0b429' : undefined }}
                />
              </Col>
              <Col xs={24} md={19}>
                <Descriptions
                  size="small"
                  column={{ xs: 1, md: 2 }}
                  colon={false}
                  items={[
                    { key: 'task', label: 'task_id', children: <span className="mono">{knownTaskId || '—'}</span> },
                    { key: 'head', label: 'head', children: <span className="mono">{(knownHead || '').slice(0, 16) || '—'}</span> },
                    { key: 'fix', label: 'fix_status', children: <Tag>{prev.fix_status || '—'}</Tag> },
                    { key: 'mode', label: 'mode', children: <Tag>{prev.mode || '—'}</Tag> },
                  ]}
                />
              </Col>
            </Row>

            <Alert
              showIcon
              type={confirmable ? 'success' : 'warning'}
              icon={confirmable ? <CheckCircleOutlined /> : <WarningOutlined />}
              message={confirmable ? '审批齐备，可确认推送' : '暂不可确认'}
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
                    description="后端会再次校验审批票与 expected_remote_head；陈旧 head 会拒绝。"
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
                    推送目标为当前 head 对应的修复分支；失败会返回明确 status/fix_status。
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