/**
 * 插件能力（v8.8.2）：/agents 清单页——运维视角看启用了哪些插件、
 * 触发条件、运行约束（needs），以及按仓 .reviewagents.yaml 的生效视图。
 */
import { useEffect, useState } from 'react'
import {
  Alert, App, Button, Card, Empty, Select, Space, Table, Tag, Tooltip, Typography,
} from 'antd'
import { AppstoreOutlined, ReloadOutlined } from '@ant-design/icons'
import { api, type AgentManifest, type RepoConfigView } from '../api/client'
import { useConsoleOptions } from '../components/RepoPicker'

const KIND_LABEL: Record<number, { text: string; color: string }> = {
  0: { text: '内置', color: 'blue' },
  1: { text: '命令行', color: 'purple' },
  2: { text: '远程', color: 'geekblue' },
}

const PROTOCOL_LABEL: Record<number, string> = { 0: '—', 1: 'A2A', 2: 'MCP' }

/** 仓库生效词表（与后端 repoEffect 词表一致）。 */
const EFFECT_LABEL: Record<string, string> = {
  default: '默认启用',
  selected: '显式启用',
  routed: '路由启用',
  excluded_by_use: '未被 use 选中',
  disabled: '显式停用',
  locked: '协议锁定',
}

const listTags = (items?: string[]) =>
  items && items.length > 0
    ? (
      <Space size={4} wrap>
        {items.map((x) => <Tag key={x} style={{ marginInlineEnd: 0 }}>{x}</Tag>)}
      </Space>
    )
    : <Typography.Text type="secondary">—</Typography.Text>

export default function Agents() {
  const { message } = App.useApp()
  const opts = useConsoleOptions()
  const [repoKey, setRepoKey] = useState('')
  const [agents, setAgents] = useState<AgentManifest[]>([])
  const [config, setConfig] = useState<RepoConfigView | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const load = async (key = repoKey) => {
    setLoading(true)
    setErr('')
    try {
      const rp = key ? key.split('/') : []
      const res = rp.length >= 3
        ? await api.listAgents({ platform: rp[0], owner: rp[1], repo: rp.slice(2).join('/') })
        : await api.listAgents()
      setAgents(res?.agents ?? [])
      setConfig(res?.repo_config ?? null)
    } catch (e: any) {
      setAgents([])
      setConfig(null)
      setErr(e?.message || '插件清单加载失败')
      message.error(e?.message || '插件清单加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 仓库选项（仓库过滤可选：空 = 全局清单）。 */
  const repoOptions = (opts?.repos ?? []).map((r) => ({
    label: `${r.platform}/${r.owner}/${r.repo}`,
    value: `${r.platform}/${r.owner}/${r.repo}`,
  }))

  const enabledCount = agents.filter((a) => a.enabled).length

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        <AppstoreOutlined style={{ marginRight: 8 }} />
        插件能力
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        已装配插件（{enabledCount}/{agents.length} 启用）及其触发条件与运行约束。选择仓库可查看
        <span className="mono"> .reviewagents.yaml </span>
        的按仓生效视图（use/disable/routing 与冲突告警）。
      </Typography.Paragraph>

      <Card className="glass" size="small" style={{ marginBottom: 16 }}>
        <Space wrap size={10}>
          <Select
            allowClear
            showSearch
            placeholder="全部仓库（全局清单）"
            style={{ width: 300 }}
            value={repoKey || undefined}
            onChange={(v) => {
              setRepoKey(v || '')
              void load(v || '')
            }}
            options={repoOptions}
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => load()}>
            刷新
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            触发条件：路径/标签匹配才派发；needs 为运行前置（凭证/工具链）
          </Typography.Text>
        </Space>
      </Card>

      {err && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title="插件清单加载失败"
          description={err}
          action={<Button size="small" onClick={() => load()}>重试</Button>}
        />
      )}

      {config && config.warnings && config.warnings.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="仓库配置告警（信任边界）"
          description={listTags(config.warnings)}
        />
      )}

      <Card className="glass" size="small" title="插件清单" style={{ marginBottom: 16 }}>
        {agents.length === 0 && !loading ? (
          <Empty description="无已装配插件" />
        ) : (
          <Table<AgentManifest>
            size="small"
            rowKey="name"
            loading={loading}
            dataSource={agents}
            pagination={false}
            columns={[
              { title: '名称', dataIndex: 'name', width: 150, render: (v: string) => <span className="mono">{v}</span> },
              {
                title: '类型', dataIndex: 'kind', width: 90,
                render: (v?: number) => {
                  const k = KIND_LABEL[v ?? 0] || { text: String(v), color: 'default' }
                  return <Tag color={k.color}>{k.text}</Tag>
                },
              },
              {
                title: '状态', dataIndex: 'enabled', width: 80,
                render: (v: boolean) => (v ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>),
              },
              {
                title: '协议', dataIndex: 'protocol', width: 80,
                render: (v?: number) => PROTOCOL_LABEL[v ?? 0] || String(v),
              },
              { title: '版本', dataIndex: 'version', width: 100, render: (v?: string) => <span className="mono" style={{ fontSize: 12 }}>{v || '—'}</span> },
              {
                title: '超时', dataIndex: 'timeoutMs', width: 90,
                render: (v?: number) => (
                  <span className="mono" style={{ fontSize: 12 }}>
                    {v ? `${Math.round(v / 1000)} s` : '—'}
                  </span>
                ),
              },
              { title: '成本', dataIndex: 'cost', width: 100, render: (v?: string) => v || '—' },
              {
                title: 'Skills', width: 200,
                render: (_, a) => <Tooltip title={(a.skills || []).join(' / ')}>{listTags(a.skills)}</Tooltip>,
              },
              {
                title: '运行前置（needs）', width: 200,
                render: (_, a) => <Tooltip title={(a.needs || []).join(' / ')}>{listTags(a.needs)}</Tooltip>,
              },
              {
                title: '触发条件', width: 240,
                render: (_, a) => {
                  const triggers = [...(a.triggerPaths || []), ...(a.triggerLabels || []).map((x) => `label:${x}`)]
                  return <Tooltip title={triggers.join(' / ')}>{listTags(triggers)}</Tooltip>
                },
              },
            ]}
          />
        )}
      </Card>

      {repoKey && config && (
        <Card
          className="glass"
          size="small"
          title={`仓库生效视图 · ${repoKey}`}
          extra={config.loaded ? <Tag color="success">已读取 .reviewagents.yaml</Tag> : <Tag>未找到配置文件（按默认）</Tag>}
        >
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Space wrap size={16}>
              <span>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>use（显式启用）</Typography.Text>
                <div>{listTags(config.use)}</div>
              </span>
              <span>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>disable（显式停用）</Typography.Text>
                <div>{listTags(config.disable)}</div>
              </span>
            </Space>

            {config.routing && config.routing.length > 0 && (
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>routing 规则</Typography.Text>
                {config.routing.map((r, i) => (
                  <div key={i} style={{ padding: '4px 0' }}>
                    <Space wrap size={8}>
                      {listTags(r.paths)}
                      {listTags(r.labels?.map((x) => `label:${x}`))}
                      <Typography.Text type="secondary">→</Typography.Text>
                      {listTags(r.use)}
                    </Space>
                  </div>
                ))}
              </div>
            )}

            {config.plugins && config.plugins.length > 0 && (
              <Table
                size="small"
                rowKey="name"
                pagination={false}
                dataSource={config.plugins}
                columns={[
                  { title: '插件', dataIndex: 'name', width: 160, render: (v: string) => <span className="mono">{v}</span> },
                  {
                    title: '生效', dataIndex: 'repoEffect', width: 140,
                    render: (v?: string) => {
                      const text = EFFECT_LABEL[v || ''] || v || '—'
                      const color = v === 'disabled' || v === 'excluded_by_use' ? 'default' : v === 'locked' ? 'warning' : 'blue'
                      return <Tag color={color}>{text}</Tag>
                    },
                  },
                  { title: 'routedBy', dataIndex: 'routedBy', width: 120, render: (v?: string) => v || '—' },
                  { title: '备注', dataIndex: 'note', render: (v?: string) => v || '—' },
                ]}
              />
            )}
          </Space>
        </Card>
      )}
    </div>
  )
}
