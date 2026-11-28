import { useRef, useState } from 'react'
import { Bubble, Sender, Prompts } from '@ant-design/x'
import { XMarkdown } from '@ant-design/x-markdown'
import { App, Avatar, Button, Popconfirm, Space, Typography } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { useSearchParams } from '@umijs/max'
import { api, errMsg, type TaskRow } from '../api/client'
import { useApi } from '../hooks/useApi'
import RepoPicker, { useConsoleOptions, type Coords } from '../components/RepoPicker'
import RecentTaskPicker from '../components/RecentTaskPicker'
import PRPicker from '../components/PRPicker'
import { useAuth } from '../auth/AuthContext'
import { Panel } from '../components/Widgets'
import { t } from '../theme/tokens'

type Msg = { id: string; role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  { key: '1', label: '这个 PR 有什么高危问题？', description: '汇总 critical / high 级意见' },
  { key: '2', label: '需求复核结论是什么？', description: '裁决结论与验收项完成度' },
  { key: '3', label: '能合并吗？', description: '合并资格门各检查项状态' },
]

/** 坐标条宽度（PR 号下拉）。 */
const PR_W = 170
/** 问答区最小高度（px）。 */
const CHAT_MIN_H = 460
/** 空态建议卡宽度（px）。 */
const SUGGEST_MAX_W = 520

/**
 * 审查问答：绑定仓库坐标后基于最近一次审查报告回答问题。
 * 输出是报告/结论的检索与解释，不做计划性写操作（写操作走审批/合并/推送页）。
 */
export default function Assistant() {
  const { message } = App.useApp()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const opts = useConsoleOptions()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [coords, setCoords] = useState<Coords>({
    platform: params.get('platform') || opts?.platforms?.[0] || '',
    owner: params.get('owner') || '',
    repo: params.get('repo') || '',
  })
  const [number, setNumber] = useState<number | null>(
    params.get('number') ? Number(params.get('number')) : null,
  )
  const idRef = useRef(0)

  // 问答：未选目标返回指引文案（不是异常）；真请求失败撤掉占位气泡。
  // aid（占位气泡 id）经 params 透传给 onSuccess/onError，service 本身不用。
  const { run: askApi, loading } = useApi<[string, string], string>(
    async (text: string, _aid: string) => {
      if (!coords.owner || !coords.repo || !number) {
        return [
          '请先在上方选择或填写目标：平台 / owner / 仓库 / PR 号。',
          '',
          '选择「最近任务」可一键带入坐标。',
        ].join('\n')
      }
      const res = await api.ask({
        platform: coords.platform,
        owner: coords.owner,
        repo: coords.repo,
        number: String(number),
        question: text,
      })
      return (
        res.answer ||
        (res.review
          ? [
              `**最新审查结论** \`${coords.platform}/${coords.owner}/${coords.repo}#${number}\``,
              '',
              ...Object.entries(res.review).map(([k, v]) => `- **${k}**: ${v}`),
            ].join('\n')
          : res.message || '（报告尚未生成或内容为空）')
      )
    },
    {
      manual: true,
      onSuccess: (answer, [, aid]) => {
        setMsgs((m) => m.map((x) => (x.id === aid ? { ...x, content: answer } : x)))
      },
      onError: (e, [, aid]) => {
        message.error(errMsg(e, '请求失败'))
        setMsgs((m) => m.filter((x) => x.id !== aid))
      },
    },
  )

  const send = (text: string) => {
    if (!text.trim()) return
    const uid = `u${++idRef.current}`
    const aid = `a${++idRef.current}`
    setMsgs((m) => [
      ...m,
      { id: uid, role: 'user', content: text },
      { id: aid, role: 'assistant', content: '' },
    ])
    void askApi(text, aid)
  }

  const pickTask = (task: TaskRow) => {
    setCoords({ platform: task.platform || '', owner: task.owner || '', repo: task.repo || '' })
    setNumber(Number(task.number) || null)
  }

  const target =
    coords.owner && coords.repo && number
      ? `${coords.platform}/${coords.owner}/${coords.repo}#${number}`
      : '未选择目标'

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        审查问答
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        基于指定 PR 的最近一次审查报告回答问题，例如：高危问题、需求复核结论、能否合并。 当前目标：
        <span className="mono">{target}</span>
      </Typography.Paragraph>

      <Panel bodyStyle={{ padding: t.space.md }}>
        <Space orientation="vertical" size={t.space.md} style={{ width: '100%' }}>
          <RecentTaskPicker
            onPick={pickTask}
            placeholder="从最近任务载入目标"
            style={{ width: '100%', maxWidth: 560 }}
          />
          <Space wrap size={t.space.md}>
            <RepoPicker value={coords} onChange={setCoords} />
            <PRPicker
              coords={coords}
              value={number}
              style={{ width: PR_W }}
              onChange={(v) => setNumber(v ?? null)}
            />
          </Space>
        </Space>
      </Panel>

      <div
        className="panel x-chat-wrap"
        style={{
          padding: t.space.lg,
          minHeight: CHAT_MIN_H,
          display: 'flex',
          flexDirection: 'column',
          marginTop: t.space.lg,
        }}
      >
        {msgs.length === 0 ? (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
            <div style={{ textAlign: 'center', maxWidth: SUGGEST_MAX_W, width: '100%' }}>
              <Typography.Title level={5} style={{ marginBottom: t.space.md, fontWeight: 500 }}>
                选择目标后开始提问
              </Typography.Title>
              <Prompts
                title="常用问题"
                vertical
                items={SUGGESTIONS.map((s) => ({
                  key: s.key,
                  label: s.label,
                  description: s.description,
                }))}
                onItemClick={(info) => void send(String(info.data?.label || ''))}
                styles={{
                  item: {
                    background: t.color.surfaceSubtle,
                    border: `1px solid ${t.color.borderMuted}`,
                  },
                }}
              />
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'auto', padding: `${t.space.xs}px ${t.space.sm}px` }}>
            <Bubble.List
              items={msgs.map((m) => ({
                key: m.id,
                role: (m.role === 'user' ? 'user' : 'ai') as 'user' | 'ai',
                content: m.content,
                // 待回复的 assistant 空消息用 Bubble 原生 loading 态（内置打点动效）。
                loading: m.role === 'assistant' && !m.content && loading,
                contentRender: (content: string) =>
                  m.role === 'assistant' ? (
                    <XMarkdown>{content || ''}</XMarkdown>
                  ) : (
                    <span>{content || ''}</span>
                  ),
              }))}
              role={{
                ai: {
                  placement: 'start',
                  avatar: (
                    <Avatar
                      size={30}
                      style={{
                        background: t.color.surfaceSubtle,
                        color: t.color.text,
                        fontSize: t.font.sm,
                      }}
                    >
                      A
                    </Avatar>
                  ),
                  variant: 'outlined',
                },
                user: {
                  placement: 'end',
                  avatar: (
                    <Avatar
                      size={30}
                      style={{ background: t.color.accent, color: t.color.surface }}
                      icon={<UserOutlined />}
                    />
                  ),
                  variant: 'filled',
                },
              }}
              autoScroll
            />
          </div>
        )}

        <div style={{ marginTop: t.space.lg }}>
          <Sender
            placeholder="输入问题，例如：有哪些高危问题？能否合并？"
            loading={loading}
            onSubmit={(v) => void send(v)}
            style={{ borderRadius: t.radius.lg }}
          />
          <div
            style={{
              marginTop: t.space.sm,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography.Text type="secondary" className="meta-sm">
              {user?.username ? `${user.username} · 会话仅保留在当前页面` : ''}
            </Typography.Text>
            <Popconfirm
              title="清空当前会话？"
              okText="清空"
              cancelText="取消"
              onConfirm={() => setMsgs([])}
            >
              <Button size="small" type="text" disabled={msgs.length === 0}>
                清空会话
              </Button>
            </Popconfirm>
          </div>
        </div>
      </div>
    </div>
  )
}
