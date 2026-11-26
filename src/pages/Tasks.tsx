import { useEffect, useState } from 'react'
import {
  App, Button, Card, Form, InputNumber, Segmented, Select, Space, Table, Tag, Typography,
} from 'antd'
import { PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { api, type TaskRow } from '../api/client'
import { StatusDot } from '../components/Widgets'
import RepoPicker, { useConsoleOptions, loadConsoleOptions, type Coords } from '../components/RepoPicker'
import RecentTaskPicker from '../components/RecentTaskPicker'
import {
  VERDICT_COLOR, VERDICT_LABELS, fmtTime, kindLabel, statusLabel,
} from '../constants/vocab'

const EMPTY_COORDS: Coords = { platform: '', owner: '', repo: '' }

export default function Tasks() {
  const nav = useNavigate()
  const { message } = App.useApp()
  const opts = useConsoleOptions()
  const [list, setList] = useState<TaskRow[]>([])
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
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

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.listTasks({ status: status || undefined, limit: 50 })
      setList(Array.isArray(res) ? res : ((res as any).tasks ?? []))
    } catch (e: any) {
      message.error(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  /** 最近任务一键载入：坐标 + PR 号 + 任务类型（kind 按 canonical 词表名反查 IDL 值）。 */
  const pickTask = (t: TaskRow) => {
    setCoords({ platform: t.platform || '', owner: t.owner || '', repo: t.repo || '' })
    const kind = (opts?.kinds ?? []).find((k) => k.name === t.kind)?.value
    form.setFieldsValue({ number: Number(t.number) || undefined, kind: kind ?? form.getFieldValue('kind') })
  }

  const onCreate = async () => {
    const c = activeCoords
    if (!c.platform || !c.owner.trim() || !c.repo.trim()) {
      message.warning('请完整选择平台、owner 与仓库')
      return
    }
    const v = form.getFieldsValue()
    setCreating(true)
    try {
      const res = await api.createTask({
        platform: c.platform,
        owner: c.owner.trim(),
        repo: c.repo.trim(),
        number: String(v.number),
        kind: v.kind,
      })
      if (res?.duplicated) {
        message.info('该 PR 已有在飞任务，返回的是原任务')
      } else {
        message.success('审查任务已创建')
      }
      form.resetFields(['number'])
      void load()
      void loadConsoleOptions(true) // 新仓库登记后刷新坐标选项
      if (res?.taskId) nav(`/tasks/${res.taskId}`)
    } catch (e: any) {
      message.error(e?.message || '创建失败')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        审查任务
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        创建并跟踪代码审查任务；webhook 与手动创建同语义，同一 head 自动去重。
      </Typography.Paragraph>

      <Card className="glass" title="发起审查" style={{ marginBottom: 18 }}>
        <div style={{ marginBottom: 12 }}>
          <RecentTaskPicker
            onPick={pickTask}
            placeholder="从最近任务载入坐标与类型（用于重试/查看历史）"
            style={{ width: '100%', maxWidth: 560 }}
          />
        </div>
        <Form form={form} layout="inline" onFinish={onCreate} style={{ rowGap: 12 }}>
          <Form.Item label="仓库">
            <RepoPicker value={activeCoords} onChange={setCoords} />
          </Form.Item>
          <Form.Item name="number" rules={[{ required: true, message: '请填 PR 号' }]}>
            <InputNumber placeholder="PR #" style={{ width: 110 }} min={1} />
          </Form.Item>
          <Form.Item name="kind" initialValue={1} style={{ minWidth: 150 }}>
            <Select placeholder="任务类型" options={kindOptions} loading={!opts} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={creating} icon={<PlayCircleOutlined />}>
              创建任务
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card
        className="glass"
        title="任务列表"
        extra={
          <Space>
            <Segmented
              size="small"
              value={status}
              onChange={(v) => setStatus(v as string)}
              options={statusOptions}
            />
            <Button size="small" icon={<ReloadOutlined />} onClick={load} aria-label="刷新任务列表" />
          </Space>
        }
      >
        <Table<TaskRow>
          rowKey={(r) => r.id || r.task_id || ''}
          loading={loading}
          dataSource={list}
          pagination={{ pageSize: 12, showSizeChanger: false }}
          onRow={(r) => ({ onClick: () => nav(`/tasks/${r.id || r.task_id}`), style: { cursor: 'pointer' } })}
          columns={[
            {
              title: 'ID', dataIndex: 'id', width: 150,
              render: (_, r) => (
                <span className="mono" style={{ fontSize: 12 }}>{(r.id || r.task_id || '').slice(0, 16)}</span>
              ),
            },
            { title: 'PR', render: (_, r) => `${r.platform}/${r.owner}/${r.repo}#${r.number}` },
            {
              title: '类型', width: 110,
              render: (_, r) => <Tag>{kindLabel(r.kind)}</Tag>,
            },
            {
              title: '状态', width: 110, dataIndex: 'status',
              render: (s: string) => (
                <span><StatusDot status={s} /> {statusLabel(s)}</span>
              ),
            },
            {
              title: '裁决', dataIndex: 'verdict', width: 110,
              render: (v: string) =>
                v ? <Tag color={VERDICT_COLOR[v] || 'default'}>{VERDICT_LABELS[v] || v}</Tag> : '—',
            },
            {
              title: '创建时间', dataIndex: 'created_at', width: 150,
              render: (v: string) => <span className="mono" style={{ fontSize: 12 }}>{fmtTime(v)}</span>,
            },
          ]}
        />
      </Card>
    </div>
  )
}