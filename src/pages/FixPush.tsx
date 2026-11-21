import { useEffect, useState } from 'react'
import { App, Button, Card, Col, Form, Input, Row, Space, Statistic, Tag, Typography } from 'antd'
import { SearchOutlined, SendOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { api } from '../api/client'

export default function FixPush() {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [prev, setPrev] = useState<any>(null)
  const [taskId, setTaskId] = useState('')
  const [head, setHead] = useState('')
  const [busy, setBusy] = useState(false)

  const q = () => {
    const v = form.getFieldsValue()
    return { platform: v.platform, owner: v.owner, repo: v.repo, number: String(v.number) }
  }

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('platform')) {
      form.setFieldsValue({
        platform: sp.get('platform')!,
        owner: sp.get('owner') || '',
        repo: sp.get('repo') || '',
        number: sp.get('number') || '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const preview = async () => {
    setBusy(true)
    try {
      const r = await api.fixPushPreview(q())
      setPrev(r)
      if (r.task_id) setTaskId(r.task_id)
      if (r.head_sha) setHead(r.head_sha)
    } catch (e: any) {
      message.error(e?.message || '预览失败')
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    setBusy(true)
    try {
      const r = await api.fixPushConfirm({
        task_id: taskId.trim(),
        expected_remote_head: head.trim(),
      })
      message.info(`确认：${r.status} — ${r.message}`)
      setPrev((p: any) => (p ? { ...p, fix_status: r.fix_status || p.fix_status } : p))
    } catch (e: any) {
      message.error(e?.message || '确认失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        受控推送 <span className="grad-text">/ Fix Push Confirm</span>
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        ARGUS_FIX_PUSH=confirm · 验证+审批后 await_confirm · 绑定 task_id + expected_remote_head
      </Typography.Paragraph>

      <Card className="glass" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={preview} style={{ rowGap: 10 }}>
          <Form.Item name="platform" initialValue="gitea">
            <Input placeholder="platform" style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="owner" rules={[{ required: true }]}>
            <Input placeholder="owner" style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="repo" rules={[{ required: true }]}>
            <Input placeholder="repo" style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="number" rules={[{ required: true }]}>
            <Input placeholder="PR #" style={{ width: 90 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" className="glow-btn" icon={<SearchOutlined />} loading={busy}>
              预览就绪态
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {prev && (
        <Card
          className="glass"
          title={
            <Space>
              <ThunderboltOutlined style={{ color: '#22d3ee' }} />
              就绪态
              <Tag color={prev.ready ? 'success' : 'warning'}>{prev.ready ? 'READY' : 'NOT READY'}</Tag>
            </Space>
          }
        >
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={5}>
              <Statistic title="待审批票" value={prev.pending_approvals ?? 0} />
            </Col>
            <Col span={19}>
              <Space wrap>
                <Tag>task: {(prev.task_id || '—').slice(0, 16)}</Tag>
                <Tag>fix_status: {prev.fix_status || '—'}</Tag>
                <Tag>mode: {prev.mode || '—'}</Tag>
                <Tag>head: {(prev.head_sha || '—').slice(0, 12)}</Tag>
              </Space>
              <Typography.Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12 }}>
                {prev.message}
              </Typography.Paragraph>
            </Col>
          </Row>

          <Form layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="task_id">
                  <Input className="mono" value={taskId} onChange={(e) => setTaskId(e.target.value)} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="expected_remote_head">
                  <Input className="mono" value={head} onChange={(e) => setHead(e.target.value)} />
                </Form.Item>
              </Col>
            </Row>
            <Button danger type="primary" icon={<SendOutlined />} disabled={!taskId || !head} onClick={confirm} loading={busy}>
              确认推送（不可逆）
            </Button>
          </Form>
        </Card>
      )}
    </div>
  )
}
