import { useEffect, useState } from 'react'
import {
  Alert, App, Button, Card, Col, Descriptions, Form, Input, Popconfirm, Row, Select,
  Space, Spin, Statistic, Tag, Typography,
} from 'antd'
import {
  AuditOutlined, CheckCircleOutlined, ReloadOutlined, SearchOutlined, SendOutlined,
  ThunderboltOutlined, WarningOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
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

/** 推送成功状态词（后端 FixPushConfirmResponse.status）。 */
const OK_STATUS = new Set(['pushed', 'pr_created', 'cr_existed'])

const STEPS = [
  { title: '预览就绪态', desc: '只读校验任务、当前 head 与待审批高危票；不写远端。' },
  { title: '高危审批', desc: 'critical / high 逐票批准（maintainer）；缺票即 fail-closed。' },
  { title: '确认推送', desc: '绑定 expected_remote_head；陈旧 head 拒绝，失败可读回对账。' },
]

export default function FixPush() {
  const { message } = App.useApp()
  const { user, can } = useAuth()
  const canDecide = can('decide_review')
  const nav = useNavigate()
  const [form] = Form.useForm()
  const [prev, setPrev] = useState<FixPushPreview | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [busy, setBusy] = useState(false)

  // 从任务详情/审批页带坐标跳转时预填。
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

  const q = () => {
    const v = form.getFieldsValue()
    return {
      platform: v.platform as string,
      owner: (v.owner || '').trim(),
      repo: (v.repo || '').trim(),
      number: String(v.number ?? '').trim(),
    }
  }

  const preview = async () => {
    const query = q()
    if (!query.platform || !query.owner || !query.repo || !query.number) {
      message.warning('请填写完整的仓库坐标与 PR 号')
      return
    }
    setBusy(true)
    setForbidden(false)
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

  const confirm = async () => {
    if (!prev?.ready || !prev.task_id || !prev.head_sha) return
    setBusy(true)
    try {
      const r = await api.fixPushConfirm({
        task_id: prev.task_id,
        expected_remote_head: prev.head_sha,
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

  const confirmable = !!prev?.ready && prev.mode === 'confirm' && !!prev.task_id && !!prev.head_sha

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
            <Input placeholder="仓库名" style={{ width: 170 }} />
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
            extra={<Button size="small" icon={<ReloadOutlined />} onClick={preview}>刷新</Button>}
          >
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
                    { key: 'task', label: 'task_id', children: <span className="mono">{prev.task_id || '—'}</span> },
                    { key: 'head', label: 'head', children: <span className="mono">{(prev.head_sha || '').slice(0, 16) || '—'}</span> },
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