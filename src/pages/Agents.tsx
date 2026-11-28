/**
 * 插件能力（v8.8.2）：/agents 清单页——运维视角看启用了哪些插件、
 * 触发条件、运行约束（needs），以及按仓 .reviewagents.yaml 的生效视图。
 */
import { useState } from 'react'
import { Alert, App, Button, Select, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { AppstoreOutlined, ReloadOutlined } from '@ant-design/icons'
import { api, errMsg, type AgentManifest } from '../api/client'
import { useConsoleOptions } from '../components/RepoPicker'
import { EmptyHint, Panel } from '../components/Widgets'
import { useApi } from '../hooks/useApi'
import { t } from '../theme/tokens'

/** 插件类型（page vocab；中性 Tag，不用彩色混色系）。 */
const KIND_LABEL: Record<number, string> = {
  0: '内置',
  1: '命令行',
  2: '远程',
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

/** repoEffect → sev 色档（启用=low/info 蓝、停用=info 灰、锁定=medium 黄）。 */
const EFFECT_TONE: Record<string, string> = {
  default: 'low',
  selected: 'low',
  routed: 'low',
  excluded_by_use: 'info',
  disabled: 'info',
  locked: 'medium',
}

const listTags = (items?: string[]) =>
  items && items.length > 0 ? (
    <Space size={4} wrap>
      {items.map((x) => (
        <Tag key={x} style={{ marginInlineEnd: 0 }}>
          {x}
        </Tag>
      ))}
    </Space>
  ) : (
    <Typography.Text type="secondary">—</Typography.Text>
  )

/** 启用/停用（StatusDot 视觉语言：色点 + 中文标签）。 */
function EnabledDot({ enabled }: { enabled: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
      <span className={`dot ${enabled ? 'ok' : 'mute'}`} />
      <span className="t-sm">{enabled ? '启用' : '停用'}</span>
    </span>
  )
}

export default function Agents() {
  const { message } = App.useApp()
  const opts = useConsoleOptions()
  const [repoKey, setRepoKey] = useState('')

  const {
    data,
    loading,
    errorText: err,
    refresh,
  } = useApi(
    async () => {
      const rp = repoKey ? repoKey.split('/') : []
      return rp.length >= 3
        ? api.listAgents({ platform: rp[0], owner: rp[1], repo: rp.slice(2).join('/') })
        : api.listAgents()
    },
    {
      refreshDeps: [repoKey],
      errorFallback: '插件清单加载失败',
      onError: (e) => message.error(errMsg(e, '插件清单加载失败')),
    },
  )
  const agents = data?.agents ?? []
  const config = data?.repo_config ?? null

  /** 仓库选项（仓库过滤可选：空 = 全局清单）。 */
  const repoOptions = (opts?.repos ?? []).map((r) => ({
    label: `${r.platform}/${r.owner}/${r.repo}`,
    value: `${r.platform}/${r.owner}/${r.repo}`,
  }))

  const enabledCount = agents.filter((a) => a.enabled).length

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        <AppstoreOutlined style={{ marginRight: t.space.sm }} />
        插件能力
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        已装配插件（{enabledCount}/{agents.length} 启用）及其触发条件与运行约束。选择仓库可查看
        <span className="mono"> .reviewagents.yaml </span>
        的按仓生效视图（use/disable/routing 与冲突告警）。
      </Typography.Paragraph>

      <Panel bodyStyle={{ padding: t.space.md }} style={{ marginBottom: t.space.lg }}>
        <Space wrap size={t.space.md}>
          <Select
            allowClear
            showSearch
            placeholder="全部仓库（全局清单）"
            style={{ width: 300 }}
            value={repoKey || undefined}
            onChange={(v) => setRepoKey(v || '')}
            options={repoOptions}
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void refresh()}>
            刷新
          </Button>
          <Typography.Text type="secondary" className="meta-sm">
            触发条件：路径/标签匹配才派发；needs 为运行前置（凭证/工具链）
          </Typography.Text>
        </Space>
      </Panel>

      {err && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: t.space.lg }}
          title="插件清单加载失败"
          description={err}
          action={
            <Button size="small" onClick={() => void refresh()}>
              重试
            </Button>
          }
        />
      )}

      {config && config.warnings && config.warnings.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: t.space.lg }}
          title="仓库配置告警（信任边界）"
          description={listTags(config.warnings)}
        />
      )}

      <Panel className="section" title="插件清单">
        {agents.length === 0 && !loading ? (
          <EmptyHint description="无已装配插件" />
        ) : (
          <Table<AgentManifest>
            size="small"
            rowKey="name"
            loading={loading}
            dataSource={agents}
            pagination={false}
            scroll={{ x: 1330 }}
            columns={[
              {
                title: '名称',
                dataIndex: 'name',
                width: 150,
                render: (v: string) => <span className="mono">{v}</span>,
              },
              {
                title: '类型',
                dataIndex: 'kind',
                width: 90,
                render: (v?: number) => <Tag>{KIND_LABEL[v ?? 0] || String(v)}</Tag>,
              },
              {
                title: '状态',
                dataIndex: 'enabled',
                width: 80,
                render: (v: boolean) => <EnabledDot enabled={v} />,
              },
              {
                title: '协议',
                dataIndex: 'protocol',
                width: 80,
                render: (v?: number) => PROTOCOL_LABEL[v ?? 0] || String(v),
              },
              {
                title: '版本',
                dataIndex: 'version',
                width: 100,
                render: (v?: string) => <span className="mono meta-sm">{v || '—'}</span>,
              },
              {
                title: '超时',
                dataIndex: 'timeoutMs',
                width: 90,
                render: (v?: number) => (
                  <span className="mono meta-sm">{v ? `${Math.round(v / 1000)} s` : '—'}</span>
                ),
              },
              { title: '成本', dataIndex: 'cost', width: 100, render: (v?: string) => v || '—' },
              {
                title: 'Skills',
                width: 200,
                render: (_, a) => (
                  <Tooltip title={(a.skills || []).join(' / ')}>{listTags(a.skills)}</Tooltip>
                ),
              },
              {
                title: '运行前置（needs）',
                width: 200,
                render: (_, a) => (
                  <Tooltip title={(a.needs || []).join(' / ')}>{listTags(a.needs)}</Tooltip>
                ),
              },
              {
                title: '触发条件',
                width: 240,
                render: (_, a) => {
                  const triggers = [
                    ...(a.triggerPaths || []),
                    ...(a.triggerLabels || []).map((x) => `label:${x}`),
                  ]
                  return <Tooltip title={triggers.join(' / ')}>{listTags(triggers)}</Tooltip>
                },
              },
            ]}
          />
        )}
      </Panel>

      {repoKey && config && (
        <Panel
          className="section"
          title={`仓库生效视图 · ${repoKey}`}
          extra={
            config.loaded ? (
              <span className="sev sev-low">已读取 .reviewagents.yaml</span>
            ) : (
              <span className="sev sev-info">未找到配置文件（按默认）</span>
            )
          }
        >
          <Space orientation="vertical" size={t.space.lg} style={{ width: '100%' }}>
            <Space wrap size={t.space.lg}>
              <span>
                <Typography.Text type="secondary" className="meta-sm">
                  use（显式启用）
                </Typography.Text>
                <div>{listTags(config.use)}</div>
              </span>
              <span>
                <Typography.Text type="secondary" className="meta-sm">
                  disable（显式停用）
                </Typography.Text>
                <div>{listTags(config.disable)}</div>
              </span>
            </Space>

            {config.routing && config.routing.length > 0 && (
              <div>
                <Typography.Text type="secondary" className="meta-sm">
                  routing 规则
                </Typography.Text>
                {config.routing.map((r, i) => (
                  <div key={i} style={{ padding: `${t.space.xs}px 0` }}>
                    <Space wrap size={t.space.sm}>
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
                scroll={{ x: 640 }}
                columns={[
                  {
                    title: '插件',
                    dataIndex: 'name',
                    width: 160,
                    render: (v: string) => <span className="mono">{v}</span>,
                  },
                  {
                    title: '生效',
                    dataIndex: 'repoEffect',
                    width: 140,
                    render: (v?: string) => {
                      const key = v || ''
                      const text = EFFECT_LABEL[key] || v || '—'
                      return <span className={`sev sev-${EFFECT_TONE[key] || 'info'}`}>{text}</span>
                    },
                  },
                  {
                    title: 'routedBy',
                    dataIndex: 'routedBy',
                    width: 120,
                    render: (v?: string) => v || '—',
                  },
                  { title: '备注', dataIndex: 'note', render: (v?: string) => v || '—' },
                ]}
              />
            )}
          </Space>
        </Panel>
      )}
    </div>
  )
}
