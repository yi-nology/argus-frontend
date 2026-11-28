import { useEffect, useRef, useState } from 'react'
import { Alert, App, Button, Popconfirm, Select, Space, Spin, Tag, Typography } from 'antd'
import {
  ControlOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SaveOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useSearchParams } from '@umijs/max'
import { api, errMsg, isApiError, type RepoSettingsValues } from '../api/client'
import RepoPicker, { type Coords } from '../components/RepoPicker'
import { EmptyHint, Panel } from '../components/Widgets'
import BudgetCard from '../components/repo-settings/BudgetCard'
import EffectCard from '../components/repo-settings/EffectCard'
import ReplyControlCard from '../components/repo-settings/ReplyControlCard'
import RepoInfoCard from '../components/repo-settings/RepoInfoCard'
import ReportTemplateCard from '../components/repo-settings/ReportTemplateCard'
import { DEFAULTS, toFormState, type FormState } from '../components/repo-settings/types'
import { useDeepLink } from '../hooks/useDeepLink'
import { useApi } from '../hooks/useApi'
import { useLatestRef } from '../hooks/async'
import { t } from '../theme/tokens'

/**
 * 仓库设置编排层：坐标选择 + 四张卡片（回复控制 / 生效情况 / 预算上限 / 报告模板）
 * + 保存/恢复默认。表单卡片在 components/repo-settings/ 下单职责拆分。
 *
 * 查询语义：404 = 无覆盖（全新仓库）→ 加载默认值而非报错；403/500 等真错误必须
 * 呈现（不能伪装成「无配置」）。生效情况与分支面均 best-effort。
 */
export default function RepoSettings() {
  const { message } = App.useApp()
  const [params] = useSearchParams()
  const [platform, setPlatform] = useState(params.get('platform') || '')
  const [owner, setOwner] = useState(params.get('owner') || '')
  const [repo, setRepo] = useState(params.get('repo') || '')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [state, setState] = useState<FormState>(DEFAULTS)
  const [overrides, setOverrides] = useState<string[]>([])
  /** 近 30 天有审查任务的仓库（空态快速选择；免手输坐标）。 */
  const [activeRepos, setActiveRepos] = useState<
    { platform: string; owner: string; repo: string }[]
  >([])
  const [branchPicked, setBranchPicked] = useState<string>('')

  // 主设置查询：manual（按钮/深链触发）。404 → 默认值（service 内消化）。
  const settings = useApi(
    async (p: string, o: string, r: string) => {
      try {
        const row = await api.getRepoSettings(p, o, r)
        const v: RepoSettingsValues =
          row?.settings ?? (row?.settings_json ? JSON.parse(row.settings_json) : {})
        return { values: toFormState(v), isDefault: false }
      } catch (e) {
        if (isApiError(e) && e.status === 404) return { values: DEFAULTS, isDefault: true }
        throw e
      }
    },
    {
      manual: true,
      errorFallback: '加载设置失败',
      onSuccess: (d) => {
        setState(d.values)
        setDirty(false)
        if (d.isDefault) message.info('该仓库暂无自定义设置，当前为全局默认值')
      },
    },
  )
  // 真错误（403/500）时表单区收起、只留错误条——不能让旧表单伪装成该仓配置。
  const loaded = settings.data !== undefined && !settings.errorText

  // 生效情况：换仓重查时的过期响应由 ahooks 计数守卫自动丢弃。
  const {
    data: effect,
    run: runEffect,
    reset: resetEffect,
  } = useApi(
    async (p: string, o: string, r: string) => {
      const s = await api.statsOverview({ days: 30, platform: p, owner: o, repo: r })
      return (s?.repos ?? [])[0] ?? null
    },
    { manual: true },
  )

  // 分支面（best-effort：不可用不影响设置编辑主流程）。
  const {
    data: repoInfo,
    loading: repoInfoLoading,
    errorText: repoInfoErr,
    run: runRepoInfo,
  } = useApi(
    async (p: string, o: string, r: string) => {
      const res = await api.repoBranches({ platform: p, owner: o, repo: r })
      return { default_branch: res?.default_branch || '', branches: res?.branches ?? [] }
    },
    { manual: true, errorFallback: '分支清单加载失败' },
  )

  const load = (p = platform, o = owner, r = repo) => {
    if (!o || !r) {
      message.warning('请完整选择 owner 与仓库')
      return
    }
    setBranchPicked('')
    resetEffect()
    void settings.run(p, o, r)
    void runEffect(p, o, r)
    void runRepoInfo(p, o, r)
  }
  // 深链/回调场景经 ref 取最新 load（load 闭包含最新 coords 默认参）。
  const loadRef = useLatestRef(load)

  const patch = (p: Partial<FormState>) => {
    setState((s) => ({ ...s, ...p }))
    setDirty(true)
  }

  /** 有未保存修改时离开页面给出浏览器级确认（误关标签页丢旋钮配置）。 */
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  /** 已有覆盖的仓库清单（快捷选择，免手输）。 */
  useEffect(() => {
    api
      .listRepoSettings()
      .then((r) => {
        const rows = r?.settings ?? []
        setOverrides(rows.map((x) => `${x.platform}:${x.owner}/${x.repo}`))
      })
      .catch(() => {
        /* 清单失败不阻断手输 */
      })
  }, [])

  /** 近期活跃仓库：空态下给一键选择，省去手输 owner/repo（也避免子组仓库名写错）。 */
  useEffect(() => {
    api
      .statsOverview({ days: 30 })
      .then((s) => {
        setActiveRepos((s?.repos ?? []).slice(0, 12))
      })
      .catch(() => {
        /* 统计失败不阻断手输 */
      })
  }, [])

  // 从质量运营/任务详情带 platform/owner/repo 跳转时自动加载；同路由换参数也重跑。
  // useDeepLink 覆盖「四参齐全」契约；仓库设置另收只带三元组的入口（按仓设置直达），
  // 下方补一条三元组深链，保持「owner/repo 齐全即加载」的原行为，避免双载。
  useDeepLink((c) => {
    setPlatform(c.platform)
    setOwner(c.owner)
    setRepo(c.repo)
    load(c.platform, c.owner, c.repo)
  })

  const dlKey = params.toString()
  const lastDlKey = useRef('')
  useEffect(() => {
    if (!dlKey || dlKey === lastDlKey.current) return
    lastDlKey.current = dlKey
    const q = new URLSearchParams(dlKey)
    const p = q.get('platform') || ''
    const o = q.get('owner')
    const r = q.get('repo')
    const n = q.get('number')
    if (!o || !r || (p && n)) return
    if (p) setPlatform(p)
    setOwner(o)
    setRepo(r)
    void loadRef.current(p || undefined, o, r)
  }, [dlKey, loadRef])

  const save = async () => {
    setSaving(true)
    try {
      const body: RepoSettingsValues = {
        comment_throttle_minutes: state.throttle > 0 ? state.throttle : undefined,
        findings_cap: state.cap > 0 ? state.cap : undefined,
        severity_floor: state.floor || undefined,
        ocr_delegate_enabled: state.ocrEnabled ? undefined : false,
        monthly_token_budget: state.monthlyBudget,
        task_token_budget: state.taskBudget,
        max_diff_chars: state.maxDiffChars,
        report_template: state.reportTemplate || undefined,
      }
      // 全空 = 语义等同恢复默认
      const hasValue = Object.values(body).some((v) => v !== undefined)
      const key = `${platform}:${owner}/${repo}`
      if (!hasValue) {
        await api.deleteRepoSettings(platform, owner, repo)
        setOverrides((prev) => prev.filter((x) => x !== key))
        message.success('已恢复全局默认（覆盖已删除）')
      } else {
        await api.putRepoSettings(platform, owner, repo, body)
        setOverrides((prev) => (prev.includes(key) ? prev : [...prev, key]))
        message.success('设置已保存，下一个审查任务起生效')
      }
      setDirty(false)
    } catch (e) {
      message.error(errMsg(e, '保存失败（需要 admin 档 token 且仓库在授权范围内）'))
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    try {
      await api.deleteRepoSettings(platform, owner, repo)
      setOverrides((prev) => prev.filter((x) => x !== `${platform}:${owner}/${repo}`))
      setState(DEFAULTS)
      setDirty(false)
      message.success('已恢复全局默认')
    } catch (e) {
      message.error(errMsg(e, '操作失败'))
    }
  }

  return (
    <div className="page">
      <Typography.Title level={3} className="page-title">
        <ControlOutlined /> 仓库设置
      </Typography.Title>
      <Typography.Paragraph className="page-sub">
        按仓库定制审查行为：回复频次 / 数量 / 级别、预算上限、报告模板与 OCR 预检。
        未设置的项继承全局部署默认；修改对<strong>下一个审查任务</strong>生效。
      </Typography.Paragraph>

      {/* 仓库选择条 */}
      <Panel bodyStyle={{ padding: t.space.md }} style={{ marginBottom: t.space.lg }}>
        <Space wrap size={t.space.md}>
          <RepoPicker
            value={{ platform, owner, repo }}
            onChange={(c: Coords) => {
              setPlatform(c.platform)
              setOwner(c.owner)
              setRepo(c.repo)
              // 换仓即弃用上一仓的表单与错误态（404/403 都要清，避免误读）。
              settings.reset()
            }}
            platformWidth={150}
          />
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            loading={settings.loading}
            onClick={() => load()}
          >
            加载设置
          </Button>
          {loaded && overrides.includes(`${platform}:${owner}/${repo}`) && (
            <Tag color="blue">本仓已有覆盖</Tag>
          )}
          {overrides.length > 0 && (
            <Select
              placeholder={`已有覆盖（${overrides.length}）`}
              style={{ width: 220 }}
              showSearch
              options={overrides.map((o) => ({ label: o, value: o }))}
              onChange={(v: string) => {
                const [p, rest] = v.split(':')
                const [o, r] = rest.split('/')
                setPlatform(p)
                setOwner(o)
                setRepo(r)
                load(p, o, r)
              }}
            />
          )}
        </Space>
      </Panel>

      {activeRepos.length > 0 && (
        <Panel
          bodyStyle={{ padding: t.space.md }}
          style={{ marginBottom: t.space.lg }}
          title={
            <Space>
              <ThunderboltOutlined />
              近期活跃仓库
            </Space>
          }
          extra={
            <Typography.Text type="secondary" className="meta-sm">
              近 30 天有审查任务 · 点击直接加载
            </Typography.Text>
          }
        >
          <Space wrap size={[t.space.sm, t.space.sm]}>
            {activeRepos.map((r) => {
              const label = `${r.platform}/${r.owner}/${r.repo}`
              const active = r.platform === platform && r.owner === owner && r.repo === repo
              return (
                <Tag
                  key={label}
                  color={active ? 'blue' : undefined}
                  style={{ cursor: 'pointer', marginInlineEnd: 0 }}
                  onClick={() => {
                    setPlatform(r.platform)
                    setOwner(r.owner)
                    setRepo(r.repo)
                    void load(r.platform, r.owner, r.repo)
                  }}
                >
                  <span className="mono t-xs">{label}</span>
                </Tag>
              )
            })}
          </Space>
        </Panel>
      )}

      {loaded && (
        <RepoInfoCard
          repoInfo={repoInfo}
          loading={repoInfoLoading}
          errorText={repoInfoErr}
          branchPicked={branchPicked}
          onBranchPicked={setBranchPicked}
          onRefresh={() => runRepoInfo(platform, owner, repo)}
        />
      )}

      {settings.errorText && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: t.space.lg }}
          title="加载设置失败"
          description={`${settings.errorText}（403=令牌无该仓管理范围；这不代表仓库没有配置）`}
          action={
            <Button size="small" onClick={() => load()}>
              重试
            </Button>
          }
        />
      )}

      {!loaded && !settings.errorText && (
        <div style={{ margin: `${t.space.huge}px 0` }}>
          <EmptyHint description="选择上方仓库加载设置；近期活跃仓库可一键载入" />
        </div>
      )}

      {loaded && (
        <Spin spinning={settings.loading}>
          <ReplyControlCard state={state} patch={patch} dirty={dirty} />
          <EffectCard effect={effect} />
          <BudgetCard state={state} patch={patch} />
          <ReportTemplateCard state={state} patch={patch} />

          {/* ===== 操作条 ===== */}
          <Space size={t.space.md}>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              disabled={!dirty}
              onClick={save}
            >
              保存设置
            </Button>
            <Popconfirm
              title="恢复全局默认？"
              description="将删除本仓库的全部自定义设置。"
              okText="恢复默认"
              okButtonProps={{ danger: true }}
              cancelText="取消"
              onConfirm={reset}
            >
              <Button icon={<DeleteOutlined />} danger>
                恢复默认
              </Button>
            </Popconfirm>
            {dirty && (
              <Button icon={<ReloadOutlined />} onClick={() => load()}>
                放弃修改
              </Button>
            )}
          </Space>

          {dirty && (
            <div
              style={{ position: 'sticky', bottom: t.space.lg, marginTop: t.space.lg, zIndex: 10 }}
            >
              <Panel bodyStyle={{ padding: t.space.md }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: t.space.md,
                    flexWrap: 'wrap',
                  }}
                >
                  <Tag color="orange">有未保存修改</Tag>
                  <Typography.Text type="secondary" className="meta-sm">
                    保存后对下一个审查任务生效
                  </Typography.Text>
                  <div style={{ flex: 1 }} />
                  <Button size="small" onClick={() => load()}>
                    放弃
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={saving}
                    onClick={save}
                  >
                    保存
                  </Button>
                </div>
              </Panel>
            </div>
          )}
        </Spin>
      )}
    </div>
  )
}
