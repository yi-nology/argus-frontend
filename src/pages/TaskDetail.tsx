import { useEffect, useState } from 'react'
import { Button, Card, Descriptions, Space, Spin, Tag, Tooltip, Typography } from 'antd'
import { XMarkdown } from '@ant-design/x-markdown'
import { ArrowLeftOutlined, SafetyCertificateOutlined, MergeCellsOutlined, BugOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type TaskRow } from '../api/client'
import { StatusDot } from '../components/Widgets'

export default function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>()
  const nav = useNavigate()
  const [task, setTask] = useState<TaskRow | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!taskId) return
    api.getTask(taskId).then(setTask).catch((e) => setErr(e?.message || '加载失败'))
  }, [taskId])

  if (err) return <div className="page">⚠ {err}</div>
  if (!task) return (
    <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
      <Spin size="large" />
    </div>
  )

  const pr = `${task.platform}/${task.owner}/${task.repo}#${task.number}`
  return (
    <div className="page">
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav('/tasks')}>返回</Button>
      </Space>
      <Typography.Title level={3} className="page-title">
        {pr} <span className="grad-text">审查详情</span>
      </Typography.Title>
      <Typography.Paragraph className="page-sub mono">
        task {(task.id || taskId || '').slice(0, 20)} · head {task.head_sha || '—'}
      </Typography.Paragraph>

      <Card className="glass" style={{ marginBottom: 16 }}>
        <Descriptions
          column={{ xs: 2, md: 4 }}
          items={[
            { key: 'st', label: '状态', children: <span><StatusDot status={task.status} /> {task.status}</span> },
            { key: 'v', label: '裁决', children: (
              <Tag color={task.verdict === 'approve' ? 'success' : task.verdict === 'request_changes' ? 'error' : 'warning'}>
                {task.verdict || '—'}
              </Tag>
            )},
            { key: 'fix', label: 'fix_status', children: <span className="mono">{task.fix_status || '—'}</span> },
            { key: 'tok', label: 'tokens', children: <span className="mono">{task.tokens_used ?? '—'}</span> },
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
          ]}
        />
        <Space style={{ marginTop: 12 }}>
          <Button icon={<SafetyCertificateOutlined />} onClick={() =>
            nav(`/approvals?platform=${task.platform}&owner=${task.owner}&repo=${task.repo}&number=${task.number}`)
          }>审批票</Button>
          <Button icon={<MergeCellsOutlined />} onClick={() =>
            nav(`/merges?platform=${task.platform}&owner=${task.owner}&repo=${task.repo}&number=${task.number}`)
          }>合并资格</Button>
          <Button icon={<BugOutlined />} onClick={() =>
            nav(`/findings?platform=${encodeURIComponent(task.platform || '')}&owner=${encodeURIComponent(task.owner || '')}&repo=${encodeURIComponent(task.repo || '')}`)
          }>意见治理</Button>
        </Space>
      </Card>

      <Card className="glass" title="审查报告">
        {task.report ? (
          <div className="report-md"><XMarkdown>{task.report}</XMarkdown></div>
        ) : (
          <Typography.Text type="secondary">(无报告)</Typography.Text>
        )}
      </Card>
    </div>
  )
}
