import { useEffect, useState } from 'react'
import { App, Button, Card, Form, Input, Space, Table, Tag, Typography } from 'antd'
import { CheckOutlined, CloseOutlined, SearchOutlined } from '@ant-design/icons'
import { api, type FixTicket } from '../api/client'
import { StatusDot } from '../components/Widgets'

const statusColor: Record<string, string> = {
  approved: 'success', rejected: 'error', stale: 'warning', pending: 'processing',
}

export default function Approvals() {
  const { message } = App.useApp()
  const [tickets, setTickets] = useState<FixTicket[]>([])
  const [pending, setPending] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  const load = async (v: any) => {
    setLoading(true)
    try {
      const res = await api.listFixApprovals({
        platform: v.platform, owner: v.owner, repo: v.repo, number: String(v.number),
      })
      setTickets(res.tickets || [])
      setPending(res.pending_count ?? 0)
    } catch (e: any) {
      message.error(e?.message || '查询失败')
    } finally {
      setLoading(false)
    }
  }

  const decide = async (id: string, decision: 'approved' | 'rejected') => {
    try {
      const r = await api.decideFixApproval({ id, decision, reason: decision === 'approved' ? '工作台批准' : '工作台拒绝' })
      message.success(r.message || decision)
      void load(form.getFieldsValue())
    } catch (e: any) {
      message.error(e?.message || '裁决失败')
    }
  }

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('platform')) {
      const v = {
        platform: sp.get('platform')!,
        owner: sp.get('owner') || '',
        repo: sp.get('repo') || '',
        number: sp.get('number') || '',
      }
      form.setFieldsValue(v)
      void load(v)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        修复审批 <span className="grad-text">/ Fix Approvals</span>
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        critical / high 具名批准 · 缺票 = 未批准（fail-closed）· 新 head 旧票 stale
      </Typography.Paragraph>

      <Card className="glass" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={load} style={{ rowGap: 10 }}>
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
            <Button type="primary" htmlType="submit" className="glow-btn" icon={<SearchOutlined />}>
              查询
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card
        className="glass"
        title={<span>票列表 <Tag color="cyan">待裁决 {pending}</Tag></span>}
      >
        <Table<FixTicket>
          rowKey="id"
          loading={loading}
          dataSource={tickets}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: 'ID', dataIndex: 'id', render: (v: string) => (
              <span className="mono" style={{ fontSize: 12 }}>{v.slice(0, 14)}</span>
            )},
            { title: 'fp', dataIndex: 'print', render: (v: string) => (
              <span className="mono" style={{ fontSize: 12 }}>{(v || '').slice(0, 12)}</span>
            )},
            { title: 'sev', dataIndex: 'severity', render: (v: string) =>
              v === 'critical' ? <Tag color="error">critical</Tag> : <Tag color="warning">{v}</Tag> },
            { title: '文件', dataIndex: 'file', ellipsis: true },
            { title: '状态', dataIndex: 'status', render: (s: string) => (
              <span><StatusDot status={s} /> <Tag color={statusColor[s]}>{s}</Tag></span>
            )},
            { title: '操作', render: (_, t) =>
              t.status === 'pending' ? (
                <Space>
                  <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => decide(t.id, 'approved')}>
                    批准
                  </Button>
                  <Button size="small" danger icon={<CloseOutlined />} onClick={() => decide(t.id, 'rejected')}>
                    拒绝
                  </Button>
                </Space>
              ) : (
                <span style={{ opacity: 0.7, fontSize: 12 }}>{t.reason || t.status}</span>
              )},
          ]}
        />
      </Card>
    </div>
  )
}
