import { useRef, useState } from 'react'
import { Bubble, Sender, Prompts } from '@ant-design/x'
import { XMarkdown } from '@ant-design/x-markdown'
import { App, Avatar, Button, Card, Form, Input, Space, Tag, Typography } from 'antd'
import { RobotOutlined, UserOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'

type Msg = { id: string; role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  { key: '1', label: '这个 PR 有什么高危问题？', description: '汇总 critical/high 发现' },
  { key: '2', label: '需求复核结论是什么？', description: 'R5 裁决与 AC 完成度' },
  { key: '3', label: '能合并吗？', description: '合并资格门七条判定' },
]

export default function Assistant() {
  useAuth()
  const { message } = App.useApp()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [loading, setLoading] = useState(false)
  const [target, setTarget] = useState({ platform: 'gitea', owner: '', repo: '', number: '' })
  const idRef = useRef(0)

  const send = async (text: string) => {
    if (!text.trim()) return
    const uid = `u${++idRef.current}`
    const aid = `a${++idRef.current}`
    setMsgs((m) => [...m, { id: uid, role: 'user', content: text }])
    setLoading(true)
    setMsgs((m) => [...m, { id: aid, role: 'assistant', content: '' }])

    try {
      const hasTarget = target.owner && target.repo && target.number
      if (!hasTarget) {
        setMsgs((m) =>
          m.map((x) =>
            x.id === aid
              ? {
                  ...x,
                  content: [
                    `收到：${text}`,
                    '',
                    '请先在上方填写 **platform / owner / repo / PR#**，我才能绑定审查上下文。',
                    '',
                    '也可直接使用侧栏：审查任务 · 修复审批 · 合并资格门 · 受控推送。',
                  ].join('\n'),
                }
              : x,
          ),
        )
        return
      }
      const res = await api.ask({
        platform: target.platform,
        owner: target.owner,
        repo: target.repo,
        number: target.number,
        question: text,
      })
      const answer =
        res.answer ||
        (res.review
          ? [
              `**最新审查结论** \`${target.platform}/${target.owner}/${target.repo}#${target.number}\``,
              '',
              ...Object.entries(res.review).map(([k, v]) => `- **${k}**: ${v}`),
            ].join('\n')
          : res.message || '（无结论）')
      setMsgs((m) => m.map((x) => (x.id === aid ? { ...x, content: answer } : x)))
    } catch (e: any) {
      message.error(e?.message || '发送失败')
      setMsgs((m) => m.filter((x) => x.id !== aid))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        Argus 助手 <span className="grad-text">/ AI Copilot</span>
        <Tag color="cyan" style={{ marginLeft: 10 }}>@ant-design/x</Tag>
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        Ant Design X 驱动的审查问答面 · Markdown 渲染 · 与受控变更闭环联动
      </Typography.Paragraph>

      <Card className="glass" size="small" style={{ marginBottom: 14 }}>
        <Form layout="inline" style={{ rowGap: 8 }}>
          <Form.Item label="platform">
            <Input value={target.platform} style={{ width: 110 }}
              onChange={(e) => setTarget({ ...target, platform: e.target.value })} />
          </Form.Item>
          <Form.Item label="owner">
            <Input value={target.owner} style={{ width: 130 }}
              onChange={(e) => setTarget({ ...target, owner: e.target.value })} />
          </Form.Item>
          <Form.Item label="repo">
            <Input value={target.repo} style={{ width: 130 }}
              onChange={(e) => setTarget({ ...target, repo: e.target.value })} />
          </Form.Item>
          <Form.Item label="PR#">
            <Input value={target.number} style={{ width: 90 }}
              onChange={(e) => setTarget({ ...target, number: e.target.value })} />
          </Form.Item>
        </Form>
      </Card>

      <div className="glass x-chat-wrap" style={{ padding: 18, minHeight: 480, display: 'flex', flexDirection: 'column' }}>
        {msgs.length === 0 ? (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
            <div style={{ textAlign: 'center', maxWidth: 520 }}>
              <ThunderboltOutlined style={{ fontSize: 40, color: '#5b8def' }} />
              <Typography.Title level={4} style={{ marginTop: 8 }}>
                <span className="grad-text">Argus 审查助手</span>
              </Typography.Title>
              <Prompts
                title="试试这些问题"
                vertical
                items={SUGGESTIONS.map((s) => ({
                  key: s.key,
                  label: s.label,
                  description: s.description,
                }))}
                onItemClick={(info) => void send(String(info.data?.label || ''))}
                styles={{ item: { background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)' } }}
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
                    <Avatar size={32} style={{ background: '#5b8def' }} icon={<RobotOutlined />} />
                  ),
                  variant: 'outlined',
                },
                user: {
                  placement: 'end',
                  avatar: (
                    <Avatar size={32} style={{ background: '#8b7cf6' }} icon={<UserOutlined />} />
                  ),
                  variant: 'filled',
                },
              }}
              autoScroll
            />
            {loading && (
              <Space style={{ padding: 12 }}>
                <Avatar size="small" style={{ background: '#5b8def' }} icon={<RobotOutlined />} />
                <Typography.Text type="secondary">思考中…</Typography.Text>
              </Space>
            )}
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <Sender
            placeholder="向 Argus 提问：需求复核 / 高危发现 / 能否合并…"
            loading={loading}
            onSubmit={(v) => void send(v)}
            style={{ borderRadius: 14 }}
          />
          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <Button size="small" type="text" onClick={() => setMsgs([])}>
              清空会话
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
