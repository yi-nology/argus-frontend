import { useEffect, useState } from 'react'
import { App, Button, Card, Form, Input, InputNumber, Select, Space, Table, Tag, Typography } from 'antd'
import { PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { api, type TaskRow } from '../api/client'
import { StatusDot } from '../components/Widgets'
import { PLATFORMS } from '../constants/platforms'

const verdictColor: Record<string, string> = {
  approve: 'success', comment: 'warning', request_changes: 'error',
}

export default function Tasks() {
  const nav = useNavigate()
  const { message } = App.useApp()
  const [list, setList] = useState<TaskRow[]>([])
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form] = Form.useForm()

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

  useEffect(() => { void load() }, [status])

  const onCreate = async (v: any) => {
    setCreating(true)
    try {
      await api.createTask({ platform: v.platform, owner: v.owner, repo: v.repo, number: String(v.number), kind: 0 })
      message.success('审查任务已创建')
      form.resetFields()
      void load()
    } catch (e: any) {
      message.error(e?.message || '创建失败')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        审查任务 <span className="grad-text">/ Review Runs</span>
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        webhook · poller · TaskAPI 三源同语义；同 head 去重
      </Typography.Paragraph>

      <Card className="glass" title="发起审查" style={{ marginBottom: 18 }}>
        <Form form={form} layout="inline" onFinish={onCreate} style={{ rowGap: 12 }}>
          <Form.Item name="platform" initialValue="gitea" style={{ width: 130 }}>
            <Select options={PLATFORMS.map((p) => ({ value: p, label: p }))} />
          </Form.Item>
          <Form.Item name="owner" rules={[{ required: true, message: '必填' }]}>
            <Input placeholder="owner" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="repo" rules={[{ required: true, message: '必填' }]}>
            <Input placeholder="repo" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="number" rules={[{ required: true, message: '必填' }]}>
            <InputNumber placeholder="PR #" style={{ width: 100 }} min={1} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" className="glow-btn" loading={creating} icon={<PlayCircleOutlined />}>
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
            {['', 'pending', 'running', 'done', 'failed'].map((s) => (
              <Button key={s || 'all'} size="small" type={status === s ? 'primary' : 'default'} onClick={() => setStatus(s)}>
                {s || '全部'}
              </Button>
            ))}
            <Button size="small" icon={<ReloadOutlined />} onClick={load} />
          </Space>
        }
      >
        <Table<TaskRow>
          rowKey={(r) => r.id || r.task_id || Math.random().toString()}
          loading={loading}
          dataSource={list}
          pagination={{ pageSize: 12 }}
          onRow={(r) => ({ onClick: () => nav(`/tasks/${r.id || r.task_id}`), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'ID', dataIndex: 'id', render: (_, r) => (
              <span className="mono" style={{ fontSize: 12 }}>{(r.id || r.task_id || '').slice(0, 16)}</span>
            )},
            { title: 'PR', render: (_, r) => `${r.platform}/${r.owner}/${r.repo}#${r.number}` },
            { title: '状态', dataIndex: 'status', render: (s: string) => (
              <span><StatusDot status={s} /> {s}</span>
            )},
            { title: '裁决', dataIndex: 'verdict', render: (v: string) =>
              v ? <Tag color={verdictColor[v] || 'default'}>{v}</Tag> : '—' },
            { title: '创建', dataIndex: 'created_at', render: (v: string) => (
              <span className="mono" style={{ fontSize: 11 }}>{(v || '').slice(0, 19) || '—'}</span>
            )},
          ]}
        />
      </Card>
    </div>
  )
}
