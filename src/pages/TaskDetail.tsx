import { useEffect } from 'react'
import { Alert, Button, Descriptions, Space, Spin, Tooltip, Typography } from 'antd'
import { XMarkdown } from '@ant-design/x-markdown'
import { ThoughtChain } from '@ant-design/x'
import {
  ArrowLeftOutlined,
  BugOutlined,
  MergeCellsOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from '@umijs/max'
import { api, errMsg, isApiError, subscribeEvents } from '../api/client'
import { EmptyHint, MetaLine, Panel, StatusDot, VerdictBadge } from '../components/Widgets'
import { scopeQuery } from '../hooks/useDeepLink'
import { useApi } from '../hooks/useApi'
import { fmtTime, kindLabel } from '../constants/vocab'
import { t } from '../theme/tokens'

/** 跨页入口在无 PR 坐标（本地任务）时统一禁用提示。 */
const NO_PR_HINT = '该任务没有 PR 坐标（本地任务）'

export default function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>()
  const nav = useNavigate()
  const invalidId = !taskId || taskId === 'undefined'

  const {
    data: task,
    errorText: err,
    refresh,
  } = useApi(
    async () => {
      if (invalidId) throw new Error('任务 ID 无效，请从任务列表重新进入')
      try {
        return await api.getTask(taskId!)
      } catch (e) {
        // 403 = 仓库越权，给专属指引；其余走通用文案。
        throw new Error(
          isApiError(e) && e.status === 403
            ? '无权查看该任务（当前账号的仓库范围不包含该仓库）'
            : errMsg(e, '加载失败'),
        )
      }
    },
    { refreshDeps: [taskId] },
  )

  // 阶段面 best-effort：失败静默（有任务详情即可用）。
  const { data: stagesRes, refresh: refreshStages } = useApi(
    async () => {
      if (invalidId) return { stages: [] }
      return api.getTaskStages(taskId!)
    },
    { refreshDeps: [taskId], errorFallback: '' },
  )
  const stages = stagesRes?.stages ?? []

  // SSE 实时：本任务事件（running/finished/stage…）到达后防抖重载详情与阶段。
  useEffect(() => {
    if (!taskId) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const stop = subscribeEvents((e) => {
      if (e.task_id !== taskId) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        void refresh()
        void refreshStages()
      }, 800)
    })
    return () => {
      stop()
      if (timer) clearTimeout(timer)
    }
  }, [taskId, refresh, refreshStages])

  if (err) {
    return (
      <div className="page">
        <Space style={{ marginBottom: t.space.md }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => nav('/tasks')}>
            返回任务列表
          </Button>
        </Space>
        <Alert
          type="error"
          showIcon
          title="无法加载任务"
          description={err}
          action={
            <Button size="small" onClick={() => void refresh()}>
              重试
            </Button>
          }
        />
      </div>
    )
  }
  if (!task)
    return (
      <div
        className="page"
        style={{ textAlign: 'center', paddingTop: t.space.huge + t.space.xxxl }}
      >
        <Spin size="large" />
      </div>
    )

  const hasPR = !!(task.platform && task.owner && task.repo && task.number)
  const pr = hasPR
    ? `${task.platform}/${task.owner}/${task.repo}#${task.number}`
    : `任务 ${(task.id || taskId || '').slice(0, 16)}`
  const q = hasPR
    ? scopeQuery(
        { platform: task.platform || '', owner: task.owner || '', repo: task.repo || '' },
        Number(task.number) || null,
      )
    : ''

  return (
    <div className="page">
      <Space style={{ marginBottom: t.space.md }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav('/tasks')}>
          返回任务列表
        </Button>
      </Space>
      <Typography.Title level={3} className="page-title">
        {pr}
      </Typography.Title>
      <Typography.Paragraph className="page-sub mono">
        任务 {(task.id || taskId || '').slice(0, 20)} · {kindLabel(task.kind)} · head{' '}
        {task.head_sha || '—'} · 创建于 {fmtTime(task.created_at)}
      </Typography.Paragraph>

      <Panel className="section">
        <Descriptions
          column={{ xs: 2, md: 4 }}
          items={[
            {
              key: 'st',
              label: '状态',
              children: <StatusDot status={task.status} />,
            },
            {
              key: 'v',
              label: '裁决',
              children: <VerdictBadge verdict={task.verdict} />,
            },
            {
              key: 'fix',
              label: '修复状态',
              children: <span className="mono">{task.fix_status || '—'}</span>,
            },
            {
              key: 'tok',
              label: 'Token 用量',
              children: <span className="mono">{task.tokens_used ?? '—'}</span>,
            },
            {
              key: 'reply',
              label: '回帖',
              children:
                task.reply_state === 'throttled' ? (
                  <span className="sev sev-attention">节流跳过</span>
                ) : task.reply_state === 'posted' ? (
                  <span className="sev sev-success">已回帖</span>
                ) : (
                  <span className="mono">—</span>
                ),
            },
            {
              key: 'silenced',
              label: '静默',
              children: (() => {
                const floor = task.silenced_floor ?? 0
                const cap = task.silenced_cap ?? 0
                if (floor + cap === 0) return <span className="mono">—</span>
                return (
                  <Tooltip
                    title={`低于级别地板 ${floor} 条；超出数量上限 ${cap} 条（完整结果见报告尾注）`}
                  >
                    <span className="mono">{floor + cap} 条</span>
                  </Tooltip>
                )
              })(),
            },
            {
              key: 'updated',
              label: '更新时间',
              children: <span className="mono">{fmtTime(task.updated_at)}</span>,
            },
          ]}
        />
        <Space style={{ marginTop: t.space.md }} wrap>
          <Button
            icon={<SafetyCertificateOutlined />}
            disabled={!hasPR}
            title={hasPR ? undefined : NO_PR_HINT}
            onClick={() => nav(`/approvals${q}`)}
          >
            审批票
          </Button>
          <Button
            icon={<MergeCellsOutlined />}
            disabled={!hasPR}
            title={hasPR ? undefined : NO_PR_HINT}
            onClick={() => nav(`/merges${q}`)}
          >
            合并资格
          </Button>
          <Button
            icon={<BugOutlined />}
            disabled={!hasPR}
            title={hasPR ? undefined : NO_PR_HINT}
            onClick={() => nav(`/findings${q}`)}
          >
            意见治理
          </Button>
          <Button
            icon={<SendOutlined />}
            disabled={!hasPR}
            title={hasPR ? undefined : NO_PR_HINT}
            onClick={() => nav(`/fix-push${q}`)}
          >
            受控推送
          </Button>
        </Space>
      </Panel>

      {stages.length > 0 && (
        <Panel
          className="section"
          title="执行阶段"
          bodyStyle={{ paddingTop: t.space.sm, paddingBottom: t.space.sm }}
        >
          <ThoughtChain
            items={stages.map((s) => ({
              key: s.stage,
              title: <span className="t-sm">{s.stage}</span>,
              // done=true → success；未完成走默认 pending 态。
              status: s.done ? ('success' as const) : undefined,
            }))}
          />
          <MetaLine size="xs">
            阶段完成度由任务产物与进度标记推导，跳过的阶段按已完成处理。
          </MetaLine>
        </Panel>
      )}

      <Panel className="section" title="审查报告">
        {task.report ? (
          <div className="report-md">
            <XMarkdown>{task.report}</XMarkdown>
          </div>
        ) : (
          <EmptyHint description="报告尚未生成。" />
        )}
      </Panel>
    </div>
  )
}
