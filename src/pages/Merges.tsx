import { useEffect, useRef, useState } from 'react'
import {
  Alert, App, Button, Card, Col, InputNumber, Popconfirm, Row, Space, Statistic, Tag, Typography,
} from 'antd'
import {
  CheckCircleOutlined, CloseCircleOutlined, MergeCellsOutlined, SearchOutlined, SyncOutlined,
} from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { api, type MergeEligibility, type TaskRow } from '../api/client'
import RepoPicker, { useConsoleOptions, type Coords } from '../components/RepoPicker'
import RecentTaskPicker from '../components/RecentTaskPicker'
import { useAuth } from '../auth/AuthContext'

export default function Merges() {
  const { message } = App.useApp()
  const { user, can } = useAuth()
  const canDecide = can('decide_review')
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
  const [elig, setElig] = useState<MergeEligibility | null>(null)
  const [op, setOp] = useState<{ op_id?: string; eligible?: boolean; expected_remote_head?: string } | null>(null)
  const [forbidden, setForbidden] = useState(false)
  /** 资格检查失败原因（常驻展示，不只一闪而过的 toast）。 */
  const [checkErr, setCheckErr] = useState('')
  /** 三个动作独立 loading：不再出现「点一个按钮三个转圈」。 */
  const [checking, setChecking] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const query = (c: Coords = coords, n: number | null = number) => ({
    platform: c.platform, owner: c.owner, repo: c.repo, number: String(n ?? ''),
  })

  const check = async (c: Coords = coords, n: number | null = number) => {
    if (!c.platform || !c.owner || !c.repo || !n) {
      message.warning('请完整选择仓库并填写 PR 号')
      return
    }
    setChecking(true)
    setForbidden(false)
    setCheckErr('')
    try {
      const r = await api.mergeEligibility(query(c, n))
      setElig(r.eligibility)
    } catch (e: any) {
      setElig(null)
      if (e?.status === 403) {
        setForbidden(true)
        message.warning('无业务裁定权限：需要 maintainer 角色')
      } else {
        setCheckErr(e?.message || '查询失败')
        message.error(e?.message || '查询失败')
      }
    } finally {
      setChecking(false)
    }
  }

  const preview = async () => {
    setPreviewing(true)
    try {
      const r = await api.mergePreview(query())
      setOp(r)
      setElig(r.eligibility)
      message.info(r.eligible ? `候选已创建（op ${r.op_id.slice(0, 10)}）` : `预检未通过：${r.reject_code || '资格门'}`,)
    } catch (e: any) {
      message.error(e?.message || '预检失败')
    } finally {
      setPreviewing(false)
    }
  }

  const confirm = async () => {
    if (!op?.op_id || !op?.expected_remote_head) return
    setConfirming(true)
    try {
      const r = await api.mergeConfirm({ op_id: op.op_id, expected_remote_head: op.expected_remote_head })
      message.info(`确认结果：${r.status} — ${r.message || ''}`)
    } catch (e: any) {
      message.error(e?.message || '确认失败')
    } finally {
      setConfirming(false)
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

  const pickTask = (t: TaskRow) => {
    const c: Coords = { platform: t.platform || '', owner: t.owner || '', repo: t.repo || '' }
    const n = Number(t.number) || null
    setCoords(c)
    setNumber(n)
    void check(c, n)
  }

  // 深链自动执行（与 FixPush/审批页同语义）。
  const autoRan = useRef(false)
  useEffect(() => {
    if (autoRan.current) return
    autoRan.current = true
    const p = params.get('platform')
    const o = params.get('owner')
    const r = params.get('repo')
    const n = params.get('number')
    if (p && o && r && n) {
      void check({ platform: p, owner: o, repo: r }, Number(n))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        合并资格门
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        七项检查全部通过才允许合并；预览与确认绑定同一 head，head 变更后需重新预检。
      </Typography.Paragraph>

      {!canDecide && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="当前账号无合并裁定权限"
          description={`合并属于 maintainer 角色；当前角色为 ${user?.role || '—'}。`}
        />
      )}
      {forbidden && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="资格门查询被拒绝（403）"
          description="该接口要求 admin 档 + 业务裁定角色（maintainer），平台 admin 刻意无合并权。"
        />
      )}

      {checkErr && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title="资格检查失败"
          description={checkErr}
          action={<Button size="small" onClick={() => check()}>重试</Button>}
        />
      )}

      <Card className="glass" style={{ marginBottom: 16 }}>
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <RecentTaskPicker onPick={pickTask} disabled={!canDecide} />
          <Space wrap size={10}>
            <RepoPicker value={coords} onChange={setCoords} disabled={!canDecide} />
            <InputNumber
              placeholder="PR #"
              style={{ width: 110 }}
              min={1}
              value={number}
              disabled={!canDecide}
              onChange={(v) => setNumber(v ?? null)}
              onPressEnter={() => check()}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              loading={checking}
              disabled={!canDecide}
              onClick={() => check()}
            >
              资格检查
            </Button>
          </Space>
        </Space>
      </Card>

      {elig && (
        <Card
          className="glass"
          title={
            <Space>
              {elig.eligible ? (
                <Tag icon={<CheckCircleOutlined />} color="success">可合并</Tag>
              ) : (
                <Tag icon={<CloseCircleOutlined />} color="error">不可合并</Tag>
              )}
              资格判定
            </Space>
          }
        >
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={5}>
              <Statistic
                title="阻断意见数"
                value={elig.blocking_findings}
                styles={{ content: { color: elig.blocking_findings ? '#f07178' : '#34d399' } }}
              />
            </Col>
            <Col span={19}>
              <Space wrap>
                <Tag>head: {(elig.head_sha || '—').slice(0, 10)}</Tag>
                <Tag>合并状态: {elig.merge_status || '—'}</Tag>
                <Tag>审查结论: {elig.review_verdict || '—'}</Tag>
                <Tag color={elig.ci_status === 'success' ? 'success' : 'warning'}>CI: {elig.ci_status || '—'}</Tag>
              </Space>
            </Col>
          </Row>

          {(elig.checks || []).map((c) => (
            <div key={c.code} className={`gate-row ${c.ok ? 'ok' : 'err'}`}>
              <div className="code">
                {c.ok
                  ? <CheckCircleOutlined style={{ color: '#34d399', marginRight: 6 }} />
                  : <CloseCircleOutlined style={{ color: '#f07178', marginRight: 6 }} />}
                {c.code}
              </div>
              <div className="msg">{c.message}</div>
            </div>
          ))}

          <Space style={{ marginTop: 16 }} wrap>
            <Button icon={<MergeCellsOutlined />} disabled={!canDecide} onClick={preview} loading={previewing}>
              1. 预览（生成候选）
            </Button>
            <Popconfirm
              title="确认合并该 PR？"
              description="该操作不可撤销；后端会再次校验资格与 head。"
              okText="确认合并"
              okButtonProps={{ danger: true }}
              cancelText="取消"
              onConfirm={confirm}
            >
              <Button
                type="primary" danger
                disabled={!canDecide || !op?.op_id || !op?.eligible}
                loading={confirming}
              >
                2. 确认合并
              </Button>
            </Popconfirm>
            <Button icon={<SyncOutlined />} disabled={!op?.op_id} onClick={reconcile}>
              读回对账
            </Button>
            {op?.op_id && (
              <Tag color="blue">
                op {op.op_id.slice(0, 12)} · head {(op.expected_remote_head || '').slice(0, 10)}
              </Tag>
            )}
          </Space>
        </Card>
      )}
    </div>
  )
}