import { useRef, useState } from 'react'
import { Bubble, Sender, Prompts } from '@ant-design/x'
import { XMarkdown } from '@ant-design/x-markdown'
import { App, Avatar, Button, Card, InputNumber, Popconfirm, Space, Typography } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { api, type TaskRow } from '../api/client'
import RepoPicker, { useConsoleOptions, type Coords } from '../components/RepoPicker'
import RecentTaskPicker from '../components/RecentTaskPicker'
import { useAuth } from '../auth/AuthContext'

type Msg = { id: string; role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  { key: '1', label: '这个 PR 有什么高危问题？', description: '汇总 critical / high 级意见' },
  { key: '2', label: '需求复核结论是什么？', description: '裁决结论与验收项完成度' },
  { key: '3', label: '能合并吗？', description: '合并资格门各检查项状态' },
]

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
  const [loading, setLoading] = useState(false)
  const [coords, setCoords] = useState<Coords>({
    platform: params.get('platform') || opts?.platforms?.[0] || '',
    owner: params.get('owner') || '',
    repo: params.get('repo') || '',
  })
  const [number, setNumber] = useState<number | null>(
    params.get('number') ? Number(params.get('number')) : null,
  )
  const idRef = useRef(0)

  const send = async (text: string) => {
    if (!text.trim()) return
    const uid = `u${++idRef.current}`
    const aid = `a${++idRef.current}`
    setMsgs((m) => [...m, { id: uid, role: 'user', content: text }])
    setLoading(true)
    setMsgs((m) => [...m, { id: aid, role: 'assistant', content: '' }])

    try {
      if (!coords.owner || !coords.repo || !number) {
        setMsgs((m) =>
          m.map((x) =>
            x.id === aid
              ? {
                  ...x,
                  content: [
                    '请先在上方选择或填写目标：平台 / owner / 仓库 / PR 号。',
                    '',
                    '选择「最近任务」可一键带入坐标。',
                  ].join('\n'),
                }
              : x,
          ),
        )
        return
      }
      const res = await api.ask({
        platform: coords.platform,
        owner: coords.owner,
        repo: coords.repo,
        number: String(number),
        question: text,
      })
      const answer =
        res.answer ||
        (res.review
          ? [
              `**最新审查结论** \`${coords.platform}/${coords.owner}/${coords.repo}#${number}\``,
              '',
              ...Object.entries(res.review).map(([k, v]) => `- **${k}**: ${v}`),
            ].join('\n')
          : res.message || '（报告尚未生成或内容为空）')
      setMsgs((m) => m.map((x) => (x.id === aid ? { ...x, content: answer } : x)))
    } catch (e: any) {
      message.error(e?.message || '请求失败')
      setMsgs((m) => m.filter((x) => x.id !== aid))
    } finally {
      setLoading(false)
    }
  }

  const pickTask = (t: TaskRow) => {
    setCoords({ platform: t.platform || '', owner: t.owner || '', repo: t.repo || '' })
    setNumber(Number(t.number) || null)
  }

  const target = coords.owner && coords.repo && number
    ? `${coords.platform}/${coords.owner}/${coords.repo}#${number}`
    : '未选择目标'

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        审查问答
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        基于指定 PR 的最近一次审查报告回答问题，例如：高危问题、需求复核结论、能否合并。
        当前目标：<span className="mono">{target}</span>
      </Typography.Paragraph>

      <Card className="glass" size="small" style={{ marginBottom: 14 }}>
        <Space orientation="vertical" size={10} style={{ width: '100%' }}>
          <RecentTaskPicker onPick={pickTask} placeholder="从最近任务载入目标" style={{ width: '100%', maxWidth: 560 }} />
          <Space wrap size={10}>
            <RepoPicker value={coords} onChange={setCoords} />
            <InputNumber
              placeholder="PR #"
              style={{ width: 110 }}
              min={1}
              value={number}
              onChange={(v) => setNumber(v ?? null)}
            />
          </Space>
        </Space>
      </Card>

      <div className="glass x-chat-wrap" style={{ padding: 18, minHeight: 460, display: 'flex', flexDirection: 'column' }}>
        {msgs.length === 0 ? (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
            <div style={{ textAlign: 'center', maxWidth: 520, width: '100%' }}>
              <Typography.Title level={5} style={{ marginBottom: 12, fontWeight: 500 }}>
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
                styles={{ item: { background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.14)' } }}
              />
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'auto', padding: '4px 8px' }}>
            <Bubble.List
              items={msgs.map((m) => ({
                key: m.id,
                role: (m.role === 'user' ? 'user' : 'ai') as 'user' | 'ai',
                content: m.content,
                contentRender: (content: any) =>
                  m.role === 'assistant' ? (
                    <XMarkdown>{String(content || '')}</XMarkdown>
                  ) : (
                    <span>{String(content || '')}</span>
                  ),
              }))}
              role={{
                ai: {
                  placement: 'start',
                  avatar: (
                    <Avatar size={30} style={{ background: '#2a3344', color: '#c7d6ff', fontSize: 13 }}>A</Avatar>
                  ),
                  variant: 'outlined',
                },
                user: {
                  placement: 'end',
                  avatar: (
                    <Avatar size={30} style={{ background: '#5b8def', color: '#0b1220' }} icon={<UserOutlined />} />
                  ),
                  variant: 'filled',
                },
              }}
              autoScroll
            />
            {loading && (
              <Space style={{ padding: 12 }}>
                <Typography.Text type="secondary">正在生成回答…</Typography.Text>
              </Space>
            )}
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <Sender
            placeholder="输入问题，例如：有哪些高危问题？能否合并？"
            loading={loading}
            onSubmit={(v) => void send(v)}
            style={{ borderRadius: 10 }}
          />
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {user?.username ? `${user.username} · 会话仅保留在当前页面` : ''}
            </Typography.Text>
            <Popconfirm
              title="清空当前会话？"
              okText="清空"
              cancelText="取消"
              onConfirm={() => setMsgs([])}
            >
              <Button size="small" type="text" disabled={msgs.length === 0}>清空会话</Button>
            </Popconfirm>
          </div>
        </div>
      </div>
    </div>
  )
}