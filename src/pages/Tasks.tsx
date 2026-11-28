import { useEffect, useState } from 'react'
import { App, Button, Form, Input, Segmented, Select, Space, Table, Typography } from 'antd'
import { PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from '@umijs/max'
import { api, errMsg, subscribeEvents, type TaskRow } from '../api/client'
import { LoadError, Panel, StatusDot, VerdictBadge } from '../components/Widgets'
import RepoPicker, {
  useConsoleOptions,
  loadConsoleOptions,
  type Coords,
} from '../components/RepoPicker'
import RecentTaskPicker from '../components/RecentTaskPicker'
import PRPicker from '../components/PRPicker'
import { fmtTime, kindLabel, statusLabel } from '../constants/vocab'
import { useApi } from '../hooks/useApi'
import { t } from '../theme/tokens'

const EMPTY_COORDS: Coords = { platform: '', owner: '', repo: '' }

/** IDL 任务类型数值码：code_review（CreateTask wire 面直接可用；词表名见 vocab.KIND_LABELS）。 */
const KIND_CODE_REVIEW = 1

export default function Tasks() {
  const nav = useNavigate()
  const { message } = App.useApp()
  const opts = useConsoleOptions()
  const [status, setStatus] = useState<string>('')
  const [repoFilter, setRepoFilter] = useState<string>('')
  const [kindFilter, setKindFilter] = useState<string>('')
  const [kw, setKw] = useState('')
  const [q, setQ] = useState('')
  const [form] = Form.useForm()
  const [coords, setCoords] = useState<Coords>(EMPTY_COORDS)

  // 平台默认取选项面首个（后端装配顺序），不可用时留空由用户选择。
  const platforms = opts?.platforms ?? []
  const activeCoords: Coords = coords.platform
    ? coords
    : { ...coords, platform: platforms[0] || '' }

  /** 状态过滤选项：全部 + 后端词表（值域单源，不手抄）。 */
  const statusOptions = [
    { label: '全部', value: '' },
    ...(opts?.statuses ?? []).map((s) => ({ label: statusLabel(s), value: s })),
  ]

  /** 任务类型选项：后端 kinds（IDL 数值码），默认 code_review。 */
  const kindOptions = (opts?.kinds ?? []).map((k) => ({
    label: kindLabel(k.name),
    value: k.value,
  }))

  /** 仓库筛选选项（/console/options 登记面，值=platform/owner/repo）。 */
  const repoFilterOptions = (opts?.repos ?? []).map((r) => ({
    label: `${r.platform}/${r.owner}/${r.repo}`,
    value: `${r.platform}/${r.owner}/${r.repo}`,
  }))

  /** 类型筛选选项（词表名，供 kind 查询参数）。 */
  const kindFilterOptions = (opts?.kinds ?? []).map((k) => ({
    label: kindLabel(k.name),
    value: k.name,
  }))

  const {
    data: list = [],
    loading,
    errorText: loadErr,
    refresh,
  } = useApi(
    async () => {
      const rp = repoFilter ? repoFilter.split('/') : []
      return api.listTasks({
        status: status || undefined,
        limit: 50,
        platform: rp[0] || undefined,
        owner: rp[1] || undefined,
        repo: rp.length > 2 ? rp.slice(2).join('/') : undefined,
        kind: kindFilter || undefined,
        q: q || undefined,
      })
    },
    { refreshDeps: [status, repoFilter, kindFilter, q], errorFallback: '加载失败' },
  )

  // SSE 实时：任务事件（created/running/finished）到达后防抖刷新列表。
  // useRequest 的 refresh 恒调最新 service 闭包（含筛选），无需 loadRef。
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const stop = subscribeEvents((e) => {
      if (!e.type || !e.type.startsWith('task.')) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void refresh(), 800)
    })
    return () => {
      stop()
      if (timer) clearTimeout(timer)
    }
  }, [refresh])

  /** 最近任务一键载入：坐标 + PR 号 + 任务类型（kind 按 canonical 词表名反查 IDL 值）。 */
  const pickTask = (t: TaskRow) => {
    setCoords({ platform: t.platform || '', owner: t.owner || '', repo: t.repo || '' })
    const kind = (opts?.kinds ?? []).find((k) => k.name === t.kind)?.value
    form.setFieldsValue({
      number: Number(t.number) || undefined,
      kind: kind ?? form.getFieldValue('kind'),
    })
  }

  // 发起审查：manual 模式，提交结果反馈（duplicated/创建成功/失败）走 onSuccess/onError。
  const { run: submitCreate, loading: creating } = useApi(api.createTask, {
    manual: true,
    onSuccess: (res) => {
      if (res?.duplicated) {
        message.info('该 PR 已有在飞任务，返回的是原任务')
      } else {
        message.success('审查任务已创建')
      }
      form.resetFields(['number'])
      void refresh()
      void loadConsoleOptions(true) // 新仓库登记后刷新坐标选项
      if (res?.taskId) nav(`/tasks/${res.taskId}`)
    },
    onError: (e) => message.error(errMsg(e, '创建失败')),
  })

  const onCreate = () => {
    const c = activeCoords
    if (!c.platform || !c.owner.trim() || !c.repo.trim()) {
      message.warning('请完整选择平台、owner 与仓库')
      return
    }
    const v = form.getFieldsValue()
    void submitCreate({
      platform: c.platform,
      owner: c.owner.trim(),
      repo: c.repo.trim(),
      number: String(v.number),
      kind: v.kind,
    })
  }

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        审查任务
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        创建并跟踪代码审查任务；webhook 与手动创建同语义，同一 head 自动去重。任务状态经 SSE
        实时刷新。
      </Typography.Paragraph>

      <Panel className="section" title="发起审查">
        <div style={{ marginBottom: t.space.md }}>
          <RecentTaskPicker
            onPick={pickTask}
            placeholder="从最近任务载入坐标与类型（用于重试/查看历史）"
            style={{ width: '100%', maxWidth: 560 }}
          />
        </div>
        <Form form={form} layout="inline" onFinish={onCreate} style={{ rowGap: t.space.md }}>
          <Form.Item label="仓库">
            <RepoPicker value={activeCoords} onChange={setCoords} />
          </Form.Item>
          <Form.Item name="number" rules={[{ required: true, message: '请选择或填写 PR 号' }]}>
            <PRPicker coords={activeCoords} style={{ width: 170 }} />
          </Form.Item>
          <Form.Item name="kind" initialValue={KIND_CODE_REVIEW} style={{ minWidth: 150 }}>
            <Select placeholder="任务类型" options={kindOptions} loading={!opts} />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={creating}
              icon={<PlayCircleOutlined />}
            >
              创建任务
            </Button>
          </Form.Item>
        </Form>
      </Panel>

      <LoadError error={loadErr} onRetry={() => void refresh()} />

      <Panel
        className="section"
        title="任务列表"
        extra={
          <Space>
            <Segmented
              size="small"
              value={status}
              onChange={(v) => setStatus(v as string)}
              options={statusOptions}
            />
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => void refresh()}
              aria-label="刷新任务列表"
            />
          </Space>
        }
      >
        <Space wrap size={t.space.md} style={{ marginBottom: t.space.md }}>
          <Select
            allowClear
            showSearch
            placeholder="全部仓库"
            style={{ width: 260 }}
            value={repoFilter || undefined}
            onChange={(v) => setRepoFilter(v || '')}
            options={repoFilterOptions}
          />
          <Select
            allowClear
            placeholder="全部类型"
            style={{ width: 150 }}
            value={kindFilter || undefined}
            onChange={(v) => setKindFilter(v || '')}
            options={kindFilterOptions}
          />
          <Input.Search
            allowClear
            placeholder="搜索 ID / PR 号 / head"
            style={{ width: 240 }}
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            onSearch={(v) => setQ(v.trim())}
          />
        </Space>
        <Table<TaskRow>
          rowKey={(r) => r.id || r.task_id || ''}
          loading={loading}
          dataSource={list}
          scroll={{ x: 900 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条`,
          }}
          onRow={(r) => {
            const open = () => nav(`/tasks/${r.id || r.task_id}`)
            return {
              onClick: open,
              tabIndex: 0,
              onKeyDown: (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  open()
                }
              },
            }
          }}
          columns={[
            {
              title: 'ID',
              dataIndex: 'id',
              width: 150,
              render: (_, r) => (
                <span className="mono meta-sm">{(r.id || r.task_id || '').slice(0, 16)}</span>
              ),
            },
            { title: 'PR', render: (_, r) => `${r.platform}/${r.owner}/${r.repo}#${r.number}` },
            {
              title: '类型',
              width: 110,
              render: (_, r) => <span className="t-sm">{kindLabel(r.kind)}</span>,
            },
            {
              title: '状态',
              width: 110,
              dataIndex: 'status',
              render: (s: string) => <StatusDot status={s} />,
            },
            {
              title: '裁决',
              dataIndex: 'verdict',
              width: 110,
              render: (v: string) => (v ? <VerdictBadge verdict={v} /> : '—'),
            },
            {
              title: '创建时间',
              dataIndex: 'created_at',
              width: 150,
              render: (v: string) => <span className="mono meta-sm">{fmtTime(v)}</span>,
            },
          ]}
        />
      </Panel>
    </div>
  )
}
