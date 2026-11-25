import { useEffect, useState } from 'react'
import { Alert, App, Button, Card, Col, Form, Input, Row, Space, Statistic, Tag, Typography } from 'antd'
import {
  CheckCircleOutlined, CloseCircleOutlined, SearchOutlined, MergeCellsOutlined, SyncOutlined,
} from '@ant-design/icons'
import { api, type MergeEligibility } from '../api/client'
import { useAuth } from '../auth/AuthContext'

export default function Merges() {
  const { message } = App.useApp()
  const { user, can } = useAuth()
  const canDecide = can('decide_review')
  const [form] = Form.useForm()
  const [elig, setElig] = useState<MergeEligibility | null>(null)
  const [op, setOp] = useState<{ op_id?: string; eligible?: boolean; expected_remote_head?: string } | null>(null)
  const [forbidden, setForbidden] = useState(false)
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

  const check = async () => {
    setBusy(true)
    setForbidden(false)
    try {
      const r = await api.mergeEligibility(q())
      setElig(r.eligibility)
    } catch (e: any) {
      setElig(null)
      if (e?.status === 403) {
        setForbidden(true)
        message.warning('无业务裁定权限：需要 maintainer 角色')
      } else {
        message.error(e?.message || '查询失败')
      }
    } finally {
      setBusy(false)
    }
  }

  const preview = async () => {
    setBusy(true)
    try {
      const r = await api.mergePreview(q())
      setOp(r)
      setElig(r.eligibility)
      message.info(r.eligible ? `候选已创建 op_id=${r.op_id}` : `预检未通过：${r.reject_code || '资格门'}`)
    } catch (e: any) {
      message.error(e?.message || '预检失败')
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    if (!op?.op_id || !op?.expected_remote_head) return
    setBusy(true)
    try {
      const r = await api.mergeConfirm({ op_id: op.op_id, expected_remote_head: op.expected_remote_head })
      message.info(`确认结果：${r.status} — ${r.message || ''}`)
    } catch (e: any) {
      message.error(e?.message || '确认失败')
    } finally {
      setBusy(false)
    }
  }

  const reconcile = async () => {
    if (!op?.op_id) return
    try {
      const r = await api.mergeReconcile({ op_id: op.op_id })
      message.info(`对账：${r.status} — ${r.message || ''}`)
    } catch (e: any) {
      message.error(e?.message || '对账失败')
    }
  }

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        合并资格门 <span className="grad-text">/ Merge Gate</span>
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        七条 fail-closed · preview → confirm 绑定 expected_remote_head · uncertain 读回对账
      </Typography.Paragraph>

      {!canDecide && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="当前账号无合并裁定权限"
          description={
            `平台管理（${user?.role || '—'}）与业务裁定物理分离：合并资格/受控合并属于 maintainer 角色。` +
            '请用 maintainer 账号登录（或部署超管静态 token）后再操作。'
          }
        />
      )}
      {forbidden && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="资格门查询被拒绝（403）"
          description="该接口要求 admin 档 + 业务裁定角色（maintainer），平台 admin 刻意无合并权。"
        />
      )}

      <Card className="glass" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={check} style={{ rowGap: 10 }}>
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
              资格检查
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {elig && (
        <Card
          className="glass"
          title={
            <Space>
              {elig.eligible ? (
                <Tag icon={<CheckCircleOutlined />} color="success">ELIGIBLE</Tag>
              ) : (
                <Tag icon={<CloseCircleOutlined />} color="error">NOT ELIGIBLE</Tag>
              )}
              资格判定
            </Space>
          }
        >
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={4}>
              <Statistic
                title="blocking"
                value={elig.blocking_findings}
                valueStyle={{ color: elig.blocking_findings ? '#f07178' : '#34d399' }}
              />
            </Col>
            <Col span={20}>
              <Space wrap>
                <Tag>head: {(elig.head_sha || '—').slice(0, 10)}</Tag>
                <Tag>merge_status: {elig.merge_status || '—'}</Tag>
                <Tag>review: {elig.review_verdict || '—'}</Tag>
                <Tag color={elig.ci_status === 'success' ? 'success' : 'warning'}>ci: {elig.ci_status || '—'}</Tag>
              </Space>
            </Col>
          </Row>

          {(elig.checks || []).map((c) => (
            <div key={c.code} className={`gate-row ${c.ok ? 'ok' : 'err'}`}>
              <div className="code">{c.ok ? '✓' : '✗'} {c.code}</div>
              <div className="msg">{c.message}</div>
            </div>
          ))}

          <Space style={{ marginTop: 16 }} wrap>
            <Button icon={<MergeCellsOutlined />} disabled={!canDecide} onClick={preview} loading={busy}>
              1. 预览（建候选）
            </Button>
            <Button
              type="primary" className="glow-btn" danger
              disabled={!canDecide || !op?.op_id || !op?.eligible}
              onClick={confirm} loading={busy}
            >
              2. 确认合并
            </Button>
            <Button icon={<SyncOutlined />} disabled={!op?.op_id} onClick={reconcile}>
              读回对账
            </Button>
            {op?.op_id && (
              <Tag color="cyan">
                op {op.op_id.slice(0, 12)} · head {(op.expected_remote_head || '').slice(0, 10)}
              </Tag>
            )}
          </Space>
        </Card>
      )}
    </div>
  )
}
