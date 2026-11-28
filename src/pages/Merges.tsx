import { useState } from 'react'
import { Alert, App, Button, Col, Popconfirm, Row, Space, Statistic, Tag, Typography } from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  MergeCellsOutlined,
  SearchOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { useSearchParams } from '@umijs/max'
import { api, errMsg, isApiError, type MergeEligibility, type TaskRow } from '../api/client'
import { Panel } from '../components/Widgets'
import RepoPicker, { useConsoleOptions, type Coords } from '../components/RepoPicker'
import RecentTaskPicker from '../components/RecentTaskPicker'
import PRPicker from '../components/PRPicker'
import { PermissionBanners, useCanDecide } from '../components/PermissionBanners'
import { useDeepLink } from '../hooks/useDeepLink'
import { useApi } from '../hooks/useApi'
import { t } from '../theme/tokens'

export default function Merges() {
  const { message } = App.useApp()
  const canDecide = useCanDecide()
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
  const [op, setOp] = useState<{
    op_id?: string
    eligible?: boolean
    expected_remote_head?: string
  } | null>(null)
  const [forbidden, setForbidden] = useState(false)

  /** 三个动作独立 loading：不再出现「点一个按钮三个转圈」。 */
  const {
    loading: checking,
    errorText,
    run: runCheck,
  } = useApi((c: Coords, n: number) => api.mergeEligibility({ ...c, number: String(n) }), {
    manual: true,
    errorFallback: '查询失败',
    onSuccess: (r) => setElig(r.eligibility),
    onError: (e) => {
      setElig(null)
      if (isApiError(e) && e.status === 403) {
        setForbidden(true)
        message.warning('无业务裁定权限：需要 maintainer 角色')
      } else {
        message.error(errMsg(e, '查询失败'))
      }
    },
  })
  /** 资格检查失败原因（常驻展示，不只一闪而过的 toast）。403 走权限横幅 + toast，不进告警条。 */
  const checkErr = forbidden ? '' : errorText

  const check = (c: Coords = coords, n: number | null = number) => {
    if (!c.platform || !c.owner || !c.repo || !n) {
      message.warning('请完整选择仓库并填写 PR 号')
      return
    }
    setForbidden(false)
    void runCheck(c, n)
  }

  const { loading: previewing, run: runPreview } = useApi(
    () => api.mergePreview({ ...coords, number: String(number ?? '') }),
    {
      manual: true,
      onSuccess: (r) => {
        setOp(r)
        setElig(r.eligibility)
        message.info(
          r.eligible
            ? `候选已创建（op ${r.op_id.slice(0, 10)}）`
            : `预检未通过：${r.reject_code || '资格门'}`,
        )
      },
      onError: (e) => message.error(errMsg(e, '预检失败')),
    },
  )
  const preview = () => void runPreview()

  const { loading: confirming, run: runConfirm } = useApi(
    (op_id: string, expected_remote_head: string) =>
      api.mergeConfirm({ op_id, expected_remote_head }),
    {
      manual: true,
      onSuccess: (r) => message.info(`确认结果：${r.status} — ${r.message || ''}`),
      onError: (e) => message.error(errMsg(e, '确认失败')),
    },
  )
  const confirm = () => {
    if (!op?.op_id || !op?.expected_remote_head) return
    void runConfirm(op.op_id, op.expected_remote_head)
  }

  const { run: runReconcile } = useApi((op_id: string) => api.mergeReconcile({ op_id }), {
    manual: true,
    onSuccess: (r) => message.info(`对账：${r.status} — ${r.message || ''}`),
    onError: (e) => message.error(errMsg(e, '对账失败')),
  })
  const reconcile = () => {
    if (!op?.op_id) return
    void runReconcile(op.op_id)
  }

  const pickTask = (task: TaskRow) => {
    const c: Coords = {
      platform: task.platform || '',
      owner: task.owner || '',
      repo: task.repo || '',
    }
    const n = Number(task.number) || null
    setCoords(c)
    setNumber(n)
    void check(c, n)
  }

  // 深链自动执行（与 FixPush/审批页同语义）；同路由换参数也重跑。
  useDeepLink((c, n) => {
    setCoords(c)
    setNumber(n)
    void check(c, n)
  })

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        合并资格门
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        七项检查全部通过才允许合并；预览与确认绑定同一 head，head 变更后需重新预检。
      </Typography.Paragraph>

      <PermissionBanners canDecide={canDecide} forbidden={forbidden} />

      {checkErr && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: t.space.lg }}
          title="资格检查失败"
          description={checkErr}
          action={
            <Button size="small" onClick={() => check()}>
              重试
            </Button>
          }
        />
      )}

      <Panel style={{ marginBottom: t.space.lg }}>
        <Space orientation="vertical" size={t.space.md} style={{ width: '100%' }}>
          <RecentTaskPicker onPick={pickTask} disabled={!canDecide} />
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
              loading={checking}
              disabled={!canDecide}
              onClick={() => check()}
            >
              资格检查
            </Button>
          </Space>
        </Space>
      </Panel>

      {elig && (
        <Panel
          title={
            <Space>
              {elig.eligible ? (
                <Tag icon={<CheckCircleOutlined />} color="success">
                  可合并
                </Tag>
              ) : (
                <Tag icon={<CloseCircleOutlined />} color="error">
                  不可合并
                </Tag>
              )}
              资格判定
            </Space>
          }
        >
          <Row gutter={[t.space.lg, t.space.lg]} style={{ marginBottom: t.space.lg }}>
            <Col xs={24} md={5}>
              <Statistic
                title="阻断意见数"
                value={elig.blocking_findings}
                styles={{
                  content: { color: elig.blocking_findings ? t.color.danger : t.color.success },
                }}
              />
            </Col>
            <Col xs={24} md={19}>
              <Space wrap>
                <Tag>head: {(elig.head_sha || '—').slice(0, 10)}</Tag>
                <Tag>合并状态: {elig.merge_status || '—'}</Tag>
                <Tag>审查结论: {elig.review_verdict || '—'}</Tag>
                <Tag color={elig.ci_status === 'success' ? 'success' : 'warning'}>
                  CI: {elig.ci_status || '—'}
                </Tag>
              </Space>
            </Col>
          </Row>

          {(elig.checks || []).map((c) => (
            <div key={c.code} className={`gate-row ${c.ok ? 'ok' : 'err'}`}>
              <div className="code">
                {c.ok ? (
                  <CheckCircleOutlined
                    style={{ color: t.color.success, marginRight: t.space.sm }}
                  />
                ) : (
                  <CloseCircleOutlined style={{ color: t.color.danger, marginRight: t.space.sm }} />
                )}
                {c.code}
              </div>
              <div className="msg">{c.message}</div>
            </div>
          ))}

          <Space style={{ marginTop: t.space.lg }} wrap>
            <Button
              icon={<MergeCellsOutlined />}
              disabled={!canDecide}
              onClick={preview}
              loading={previewing}
            >
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
                type="primary"
                danger
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
              <Tag>
                op {op.op_id.slice(0, 12)} · head {(op.expected_remote_head || '').slice(0, 10)}
              </Tag>
            )}
          </Space>
        </Panel>
      )}
    </div>
  )
}
