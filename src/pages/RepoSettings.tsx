import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Col,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Slider,
  Space,
  Spin,
  Statistic,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  CommentOutlined,
  ControlOutlined,
  ReloadOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  EyeOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import { useSearchParams } from '@umijs/max'
import { api, errMsg, isApiError, type RepoSettingsValues } from '../api/client'
import RepoPicker, { type Coords } from '../components/RepoPicker'
import { EmptyHint, Panel } from '../components/Widgets'
import { useDeepLink } from '../hooks/useDeepLink'
import { useApi } from '../hooks/useApi'
import { SEVERITY_FLOOR_OPTIONS } from '../constants/vocab'
import { useLatestRef } from '../hooks/async'
import { t } from '../theme/tokens'

/** 级别地板选项单源见 constants/vocab.SEVERITY_FLOOR_OPTIONS。 */

const REPORT_TEMPLATES = [
  { label: '跟随部署默认', value: '' },
  { label: 'standard（标准审查报告）', value: 'standard' },
  { label: 'analyst（分析师综合段）', value: 'analyst' },
  { label: 'minimal（极简）', value: 'minimal' },
]

/** 预算常用值预设（v8.8.0）：下拉一键填数，InputNumber 仍保留自由输入。 */
const TOKEN_BUDGET_PRESETS = [
  { label: '跟随全局', value: 0 },
  { label: '10 万', value: 100_000 },
  { label: '50 万', value: 500_000 },
  { label: '100 万', value: 1_000_000 },
  { label: '500 万', value: 5_000_000 },
]

const DIFF_CAP_PRESETS = [
  { label: '跟随全局', value: 0 },
  { label: '20 万字符', value: 200_000 },
  { label: '50 万字符', value: 500_000 },
  { label: '100 万字符', value: 1_000_000 },
]

interface FormState {
  throttle: number
  cap: number
  floor: string
  ocrEnabled: boolean
  monthlyBudget?: number
  taskBudget?: number
  maxDiffChars?: number
  reportTemplate: string
}

const DEFAULTS: FormState = {
  throttle: 0,
  cap: 0,
  floor: '',
  ocrEnabled: true,
  reportTemplate: '',
}

/** 一键预设：把三个回复旋钮组合成场景，降低「每个数字填多少」的理解成本。 */
const PRESETS: { label: string; desc: string; values: Partial<FormState> }[] = [
  {
    label: '少打扰',
    desc: '4 小时节流 · 每 MR top5 · medium 及以上',
    values: { throttle: 240, cap: 5, floor: 'medium' },
  },
  {
    label: '标准',
    desc: '1 小时节流 · 每 MR top10 · low 及以上',
    values: { throttle: 60, cap: 10, floor: 'low' },
  },
  {
    label: '全量',
    desc: '不节流 · 不封顶 · 报告全部级别',
    values: { throttle: 0, cap: 0, floor: '' },
  },
]

/** 把旋钮翻译成人话（实时预览条）。 */
function previewText(s: FormState): string {
  const parts: string[] = []
  if (s.cap > 0) parts.push(`每个 MR 最多 ${s.cap} 条意见（按严重度取 top ${s.cap}）`)
  else parts.push('意见数量不封顶')
  if (s.floor) parts.push(`只报告 ${s.floor} 及以上级别，更低级别静默（报告保留计数）`)
  else parts.push('报告全部级别')
  if (s.throttle > 0) parts.push(`同一 MR ${s.throttle} 分钟内不重复回帖（报告仍生成落库）`)
  else parts.push('回帖不节流')
  if (!s.ocrEnabled) parts.push('OCR 预检本仓关闭')
  return parts.join('；') + '。'
}

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

  // 主设置查询：manual（按钮/深链触发）。404 = 无覆盖（全新仓库）→ 语义上返回
  // 默认值而非错误；403/500 等真错误必须抛出（不能伪装成「无配置」）。
  const settings = useApi(
    async (p: string, o: string, r: string) => {
      try {
        const row = await api.getRepoSettings(p, o, r)
        const v: RepoSettingsValues =
          row?.settings ?? (row?.settings_json ? JSON.parse(row.settings_json) : {})
        return {
          values: {
            throttle: v.comment_throttle_minutes ?? 0,
            cap: v.findings_cap ?? 0,
            floor: v.severity_floor ?? '',
            ocrEnabled: v.ocr_delegate_enabled ?? true,
            monthlyBudget: v.monthly_token_budget,
            taskBudget: v.task_token_budget,
            maxDiffChars: v.max_diff_chars,
            reportTemplate: v.report_template ?? '',
          } as FormState,
          isDefault: false,
        }
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
  const loading = settings.loading
  const loadError = settings.errorText

  // 生效情况（v8.5.0）：统计窗口内的任务量/节流次数/静默条数，让「旋钮是否真的
  // 生效」可验证而不是只写在表单里。best-effort：失败按「暂无任务」呈现。
  // 换仓重查时的过期响应由 ahooks 计数守卫自动丢弃（原 effectSeq 手动守卫）。
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

  // 分支面加载（best-effort：不可用不影响设置编辑主流程）。
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

  const preview = useMemo(() => previewText(state), [state])

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
          <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={() => load()}>
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
        <Panel
          bodyStyle={{ padding: t.space.md }}
          style={{ marginBottom: t.space.lg }}
          title="仓库信息"
          extra={
            <Button size="small" onClick={() => runRepoInfo(platform, owner, repo)}>
              刷新分支
            </Button>
          }
        >
          <Spin spinning={repoInfoLoading}>
            {repoInfoErr ? (
              <Typography.Text type="secondary" className="meta-sm">
                分支面不可用：{repoInfoErr}（不影响下方设置编辑）
              </Typography.Text>
            ) : (
              <Space wrap size={t.space.lg} align="center">
                <span>
                  <Typography.Text type="secondary" className="meta-sm">
                    默认分支（.reviewagents.yaml 配置来源）
                  </Typography.Text>
                  <div>
                    <Typography.Text className="mono" copyable={!!repoInfo?.default_branch}>
                      {repoInfo?.default_branch || '—'}
                    </Typography.Text>
                  </div>
                </span>
                <span style={{ minWidth: 260 }}>
                  <Typography.Text type="secondary" className="meta-sm">
                    分支速查（共 {repoInfo?.branches.length ?? 0} 个）
                  </Typography.Text>
                  <div style={{ display: 'flex', gap: t.space.sm, alignItems: 'center' }}>
                    <Select
                      showSearch
                      allowClear
                      placeholder="选择分支名"
                      style={{ width: 220 }}
                      value={branchPicked || undefined}
                      onChange={(v) => setBranchPicked(v || '')}
                      options={(repoInfo?.branches ?? []).map((b) => ({ value: b, label: b }))}
                    />
                    {branchPicked && (
                      <Typography.Text className="mono t-xs" copyable={{ text: branchPicked }}>
                        {branchPicked}
                      </Typography.Text>
                    )}
                  </div>
                </span>
              </Space>
            )}
          </Spin>
        </Panel>
      )}

      {loadError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: t.space.lg }}
          title="加载设置失败"
          description={`${loadError}（403=令牌无该仓管理范围；这不代表仓库没有配置）`}
          action={
            <Button size="small" onClick={() => load()}>
              重试
            </Button>
          }
        />
      )}

      {!loaded && !loadError && (
        <div style={{ margin: `${t.space.huge}px 0` }}>
          <EmptyHint description="选择上方仓库加载设置；近期活跃仓库可一键载入" />
        </div>
      )}

      {loaded && (
        <Spin spinning={loading}>
          {/* ===== 回复控制（核心卡片） ===== */}
          <Panel
            title={
              <Space>
                <CommentOutlined />
                回复控制
              </Space>
            }
            style={{ marginBottom: t.space.lg }}
            extra={dirty && <Tag color="orange">有未保存修改</Tag>}
          >
            <Space wrap style={{ marginBottom: t.space.lg }}>
              <Typography.Text type="secondary" className="meta-sm">
                快捷预设：
              </Typography.Text>
              {PRESETS.map((p) => (
                <Tooltip key={p.label} title={p.desc}>
                  <Button size="small" onClick={() => patch(p.values)}>
                    {p.label}
                  </Button>
                </Tooltip>
              ))}
              <Typography.Text type="secondary" className="meta-sm">
                预设只改回复三个旋钮，保存后对下一个审查任务生效
              </Typography.Text>
            </Space>
            <Row gutter={[t.space.xxl, t.space.lg]}>
              <Col xs={24} md={8}>
                <Typography.Text strong>回复频次</Typography.Text>
                <Tooltip title="同一 MR 在该时间窗内不重复回帖（审查与报告照常，仅不回帖）。0 = 不节流。">
                  <InfoCircleOutlined
                    style={{ marginLeft: t.space.sm, color: t.color.textSubtle }}
                  />
                </Tooltip>
                <Slider
                  min={0}
                  max={1440}
                  step={15}
                  marks={{ 0: '不节流', 30: '30分', 60: '1时', 240: '4时', 1440: '24时' }}
                  value={state.throttle}
                  onChange={(v) => patch({ throttle: v as number })}
                  tooltip={{ formatter: (v) => (v === 0 ? '不节流' : `${v} 分钟`) }}
                />
                <InputNumber
                  min={0}
                  max={1440}
                  value={state.throttle}
                  onChange={(v) => patch({ throttle: v ?? 0 })}
                  suffix="分钟"
                  style={{ width: '100%' }}
                />
              </Col>
              <Col xs={24} md={8}>
                <Typography.Text strong>回复数量</Typography.Text>
                <Tooltip title="单个报告最多回帖的意见条数，超出按严重度取 top N，其余以计数行略去。0 = 不封顶。">
                  <InfoCircleOutlined
                    style={{ marginLeft: t.space.sm, color: t.color.textSubtle }}
                  />
                </Tooltip>
                <div style={{ marginTop: t.space.sm }}>
                  <InputNumber
                    min={0}
                    max={50}
                    value={state.cap}
                    onChange={(v) => patch({ cap: v ?? 0 })}
                    suffix="条 / 报告"
                    style={{ width: '100%' }}
                  />
                </div>
                <Typography.Text type="secondary" className="meta-sm">
                  建议 5–15；0 为不封顶
                </Typography.Text>
              </Col>
              <Col xs={24} md={8}>
                <Typography.Text strong>回复级别</Typography.Text>
                <Tooltip title="只回帖该级别及以上的意见；更低级别静默，报告中保留计数。">
                  <InfoCircleOutlined
                    style={{ marginLeft: t.space.sm, color: t.color.textSubtle }}
                  />
                </Tooltip>
                <div style={{ marginTop: t.space.sm }}>
                  <Select
                    value={state.floor}
                    onChange={(v) => patch({ floor: v })}
                    options={SEVERITY_FLOOR_OPTIONS}
                    style={{ width: '100%' }}
                  />
                </div>
              </Col>
            </Row>

            <Alert
              style={{ marginTop: t.space.lg }}
              type="info"
              showIcon
              icon={<EyeOutlined />}
              title="效果预览"
              description={preview}
            />

            <div style={{ marginTop: t.space.lg }}>
              <Space>
                <Switch
                  checked={state.ocrEnabled}
                  onChange={(v) => patch({ ocrEnabled: v })}
                  checkedChildren="OCR 开"
                  unCheckedChildren="OCR 关"
                />
                <Typography.Text type="secondary">
                  OCR 预检（文件分诊 + 规则注入）
                  <Tooltip title="OCR 服务端点由部署环境变量控制（安全红线，不可在此配置）；此处仅控制本仓库是否使用。">
                    <InfoCircleOutlined style={{ marginLeft: t.space.sm }} />
                  </Tooltip>
                </Typography.Text>
              </Space>
            </div>
          </Panel>

          {/* ===== 近 30 天生效情况（v8.5.0：旋钮效果可验证） ===== */}
          <Panel
            bodyStyle={{ padding: t.space.md }}
            title={
              <Space>
                <BarChartOutlined />近 30 天生效情况
              </Space>
            }
            style={{ marginBottom: t.space.lg }}
          >
            {effect ? (
              <>
                <Row gutter={[t.space.xxl, t.space.sm]}>
                  <Col xs={12} md={6}>
                    <Statistic title="审查任务" value={effect.tasks_done ?? 0} />
                  </Col>
                  <Col xs={12} md={6}>
                    <Statistic
                      title="节流跳过回帖"
                      value={effect.reply_throttled ?? 0}
                      suffix="次"
                      styles={{
                        content: {
                          color: (effect.reply_throttled ?? 0) > 0 ? t.color.attention : undefined,
                        },
                      }}
                    />
                  </Col>
                  <Col xs={12} md={6}>
                    <Statistic
                      title="低于级别地板静默"
                      value={effect.silenced_floor ?? 0}
                      suffix="条"
                    />
                  </Col>
                  <Col xs={12} md={6}>
                    <Statistic
                      title="超出数量上限静默"
                      value={effect.silenced_cap ?? 0}
                      suffix="条"
                    />
                  </Col>
                </Row>
                <Typography.Text type="secondary" className="meta-sm">
                  静默只影响回帖/行内意见，审查与报告仍全量执行；每份报告的尾注会列出本轮静默条数。
                </Typography.Text>
              </>
            ) : (
              <Typography.Text type="secondary">近 30 天暂无已完成审查任务。</Typography.Text>
            )}
          </Panel>

          {/* ===== 预算与上限 ===== */}
          <Panel
            title={
              <Space>
                <ThunderboltOutlined />
                预算与上限
              </Space>
            }
            style={{ marginBottom: t.space.lg }}
          >
            <Row gutter={[t.space.xxl, t.space.lg]}>
              <Col xs={24} md={8}>
                <Typography.Text strong>月度 token 预算</Typography.Text>
                <div style={{ display: 'flex', gap: t.space.sm, marginTop: t.space.sm }}>
                  <InputNumber
                    min={1}
                    max={1_000_000_000}
                    value={state.monthlyBudget}
                    onChange={(v) => patch({ monthlyBudget: v ?? undefined })}
                    placeholder="继承全局"
                    style={{ flex: 1 }}
                  />
                  <Select
                    style={{ width: 118 }}
                    placeholder="常用值"
                    options={TOKEN_BUDGET_PRESETS}
                    value={undefined}
                    onChange={(v: number) => patch({ monthlyBudget: v > 0 ? v : undefined })}
                  />
                </div>
              </Col>
              <Col xs={24} md={8}>
                <Typography.Text strong>单任务 token 预算</Typography.Text>
                <div style={{ display: 'flex', gap: t.space.sm, marginTop: t.space.sm }}>
                  <InputNumber
                    min={1}
                    max={1_000_000_000}
                    value={state.taskBudget}
                    onChange={(v) => patch({ taskBudget: v ?? undefined })}
                    placeholder="继承全局"
                    style={{ flex: 1 }}
                  />
                  <Select
                    style={{ width: 118 }}
                    placeholder="常用值"
                    options={TOKEN_BUDGET_PRESETS}
                    value={undefined}
                    onChange={(v: number) => patch({ taskBudget: v > 0 ? v : undefined })}
                  />
                </div>
              </Col>
              <Col xs={24} md={8}>
                <Typography.Text strong>diff 字符上限</Typography.Text>
                <div style={{ display: 'flex', gap: t.space.sm, marginTop: t.space.sm }}>
                  <InputNumber
                    min={1}
                    max={1_000_000_000}
                    value={state.maxDiffChars}
                    onChange={(v) => patch({ maxDiffChars: v ?? undefined })}
                    placeholder="继承全局"
                    style={{ flex: 1 }}
                  />
                  <Select
                    style={{ width: 118 }}
                    placeholder="常用值"
                    options={DIFF_CAP_PRESETS}
                    value={undefined}
                    onChange={(v: number) => patch({ maxDiffChars: v > 0 ? v : undefined })}
                  />
                </div>
              </Col>
            </Row>
          </Panel>

          {/* ===== 报告模板 ===== */}
          <Panel title="报告模板" style={{ marginBottom: t.space.lg }}>
            <Select
              value={state.reportTemplate}
              onChange={(v) => patch({ reportTemplate: v })}
              options={REPORT_TEMPLATES}
              style={{ width: 320 }}
            />
            <Typography.Text type="secondary" style={{ marginLeft: t.space.md }}>
              裁决链：任务级 &gt; 本设置 &gt; 仓库 yaml &gt; 部署默认
            </Typography.Text>
          </Panel>

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
