import { useEffect, useState } from 'react'
import { Alert, Button, Card, Descriptions, Space, Spin, Tag, Tooltip, Typography } from 'antd'
import { XMarkdown } from '@ant-design/x-markdown'
import {
  ArrowLeftOutlined, BugOutlined, CheckCircleOutlined, MergeCellsOutlined,
  SafetyCertificateOutlined, SendOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type TaskRow } from '../api/client'
import { StatusDot } from '../components/Widgets'
import { VERDICT_COLOR, VERDICT_LABELS, fmtTime, kindLabel, statusLabel } from '../constants/vocab'

export default function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>()
  const nav = useNavigate()
  const [task, setTask] = useState<TaskRow | null>(null)
  const [stages, setStages] = useState<{ stage: string; done: boolean }[]>([])
  const [err, setErr] = useState('')

  const load = () => {
    if (!taskId || taskId === 'undefined') {
      setErr('任务 ID 无效，请从任务列表重新进入')
      return
    }
    setErr('')
    api.getTask(taskId).then(setTask).catch((e) => {
      setErr(e?.status === 403 ? '无权查看该任务（当前账号的仓库范围不包含该仓库）' : (e?.message || '加载失败'))
    })
    api.getTaskStages(taskId).then((r) => setStages(r?.stages ?? [])).catch(() => {/* 阶段面 best-effort */})
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  if (err) {
    return (
      <div className="page">
        <Space style={{ marginBottom: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => nav('/tasks')}>返回任务列表</Button>
        </Space>
        <Alert
          type="error"
          showIcon
          title="无法加载任务"
          description={err}
          action={<Button size="small" onClick={load}>重试</Button>}
        />
      </div>
    )
  }
  if (!task) return (
    <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
      <Spin size="large" />
    </div>
  )

  const hasPR = !!(task.platform && task.owner && task.repo && task.number)
  const pr = hasPR ? `${task.platform}/${task.owner}/${task.repo}#${task.number}` : `任务 ${(task.id || taskId || '').slice(0, 16)}`
  const q = hasPR
    ? `platform=${encodeURIComponent(task.platform || '')}&owner=${encodeURIComponent(task.owner || '')}&repo=${encodeURIComponent(task.repo || '')}&number=${encodeURIComponent(task.number || '')}`
    : ''

  return (
    <div className="page">
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav('/tasks')}>返回任务列表</Button>
      </Space>
      <Typography.Title level={3} className="page-title">
        {pr}
      </Typography.Title>
      <Typography.Paragraph className="page-sub mono">
        任务 {(task.id || taskId || '').slice(0, 20)} · {kindLabel(task.kind)} · head {task.head_sha || '—'} · 创建于 {fmtTime(task.created_at)}
      </Typography.Paragraph>

      <Card className="glass" style={{ marginBottom: 16 }}>
        <Descriptions
          column={{ xs: 2, md: 4 }}
          items={[
            {
              key: 'st', label: '状态',
              children: <span><StatusDot status={task.status} /> {statusLabel(task.status)}</span>,
            },
            {
              key: 'v', label: '裁决',
              children: (
                <Tag color={VERDICT_COLOR[task.verdict || ''] || 'default'}>
                  {VERDICT_LABELS[task.verdict || ''] || task.verdict || '—'}
                </Tag>
              ),
            },
            { key: 'fix', label: '修复状态', children: <span className="mono">{task.fix_status || '—'}</span> },
            { key: 'tok', label: 'Token 用量', children: <span className="mono">{task.tokens_used ?? '—'}</span> },
            {
              key: 'reply', label: '回帖',
              children: task.reply_state === 'throttled'
                ? <Tag color="orange">节流跳过</Tag>
                : task.reply_state === 'posted'
                  ? <Tag color="success">已回帖</Tag>
                  : <span className="mono">—</span>,
            },
            {
              key: 'silenced', label: '静默',
              children: (() => {
                const floor = task.silenced_floor ?? 0
                const cap = task.silenced_cap ?? 0
                if (floor + cap === 0) return <span className="mono">—</span>
                return (
                  <Tooltip title={`低于级别地板 ${floor} 条；超出数量上限 ${cap} 条（完整结果见报告尾注）`}>
                    <Tag>{floor + cap} 条</Tag>
                  </Tooltip>
                )
              })(),
            },
            {
              key: 'updated', label: '更新时间',
              children: <span className="mono">{fmtTime(task.updated_at)}</span>,
            },
          ]}
        />
        <Space style={{ marginTop: 12 }} wrap>
          <Button
            icon={<SafetyCertificateOutlined />} disabled={!hasPR}
            title={hasPR ? undefined : '该任务没有 PR 坐标（本地任务）'}
            onClick={() => nav(`/approvals?${q}`)}
          >审批票</Button>
          <Button
            icon={<MergeCellsOutlined />} disabled={!hasPR}
            title={hasPR ? undefined : '该任务没有 PR 坐标（本地任务）'}
            onClick={() => nav(`/merges?${q}`)}
          >合并资格</Button>
          <Button
            icon={<BugOutlined />} disabled={!hasPR}
            title={hasPR ? undefined : '该任务没有 PR 坐标（本地任务）'}
            onClick={() => nav(`/findings?${q}`)}
          >意见治理</Button>
          <Button
            icon={<SendOutlined />} disabled={!hasPR}
            title={hasPR ? undefined : '该任务没有 PR 坐标（本地任务）'}
            onClick={() => nav(`/fix-push?${q}`)}
          >受控推送</Button>
        </Space>
      </Card>

      {stages.length > 0 && (
        <Card className="glass" size="small" title="执行阶段" style={{ marginBottom: 16 }}>
          <Space wrap>
            {stages.map((s) => (
              <Tag
                key={s.stage}
                color={s.done ? 'success' : 'default'}
                icon={s.done ? <CheckCircleOutlined /> : undefined}
              >
                {s.stage}
              </Tag>
            ))}
          </Space>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            阶段完成度由任务产物与进度标记推导，跳过的阶段按已完成处理。
          </Typography.Text>
        </Card>
      )}

      <Card className="glass" title="审查报告">
        {task.report ? (
          <div className="report-md"><XMarkdown>{task.report}</XMarkdown></div>
        ) : (
          <Typography.Text type="secondary">报告尚未生成。</Typography.Text>
        )}
      </Card>
    </div>
  )
}