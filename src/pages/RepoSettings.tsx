import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert, App, Button, Card, Col, Empty, InputNumber, Popconfirm,
  Row, Select, Slider, Space, Spin, Statistic, Switch, Tag, Tooltip, Typography,
} from 'antd'
import {
  CommentOutlined, ControlOutlined, ReloadOutlined, SaveOutlined,
  ThunderboltOutlined, EyeOutlined, DeleteOutlined, InfoCircleOutlined, BarChartOutlined,
} from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { api, type RepoSettingsValues } from '../api/client'
import RepoPicker, { type Coords } from '../components/RepoPicker'
import { SEVERITY_FLOOR_OPTIONS } from '../constants/vocab'

/** 级别地板选项单源见 constants/vocab.SEVERITY_FLOOR_OPTIONS。 */

const REPORT_TEMPLATES = [
  { label: '跟随部署默认', value: '' },
  { label: 'standard（标准审查报告）', value: 'standard' },
  { label: 'analyst（分析师综合段）', value: 'analyst' },
  { label: 'minimal（极简）', value: 'minimal' },
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
  throttle: 0, cap: 0, floor: '', ocrEnabled: true,
  reportTemplate: '',
}

/** 一键预设：把三个回复旋钮组合成场景，降低「每个数字填多少」的理解成本。 */
const PRESETS: { label: string; desc: string; values: Partial<FormState> }[] = [
  { label: '少打扰', desc: '4 小时节流 · 每 MR top5 · medium 及以上', values: { throttle: 240, cap: 5, floor: 'medium' } },
  { label: '标准', desc: '1 小时节流 · 每 MR top10 · low 及以上', values: { throttle: 60, cap: 10, floor: 'low' } },
  { label: '全量', desc: '不节流 · 不封顶 · 报告全部级别', values: { throttle: 0, cap: 0, floor: '' } },
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
  const [platform, setPlatform] = useState(params.get('platform') || 'gitlab')
  const [owner, setOwner] = useState(params.get('owner') || '')
  const [repo, setRepo] = useState(params.get('repo') || '')
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [state, setState] = useState<FormState>(DEFAULTS)
  const [overrides, setOverrides] = useState<string[]>([])
  /** 近 30 天有审查任务的仓库（空态快速选择；免手输坐标）。 */
  const [activeRepos, setActiveRepos] = useState<{ platform: string; owner: string; repo: string }[]>([])
  /** 近 30 天生效情况（stats/overview 按仓行；null = 无任务）。 */
  const [effect, setEffect] = useState<any>(null)
  const effectSeq = useRef(0)

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
    api.listRepoSettings()
      .then((r) => {
        const rows = r?.settings ?? []
        setOverrides(rows.map((x) => `${x.platform}:${x.owner}/${x.repo}`))
      })
      .catch(() => {/* 清单失败不阻断手输 */})
  }, [])

  /** 近期活跃仓库：空态下给一键选择，省去手输 owner/repo（也避免子组仓库名写错）。 */
  useEffect(() => {
    api.statsOverview({ days: 30 })
      .then((s) => {
        const rows = (s?.repos ?? []) as { platform: string; owner: string; repo: string }[]
        setActiveRepos(rows.slice(0, 12))
      })
      .catch(() => {/* 统计失败不阻断手输 */})
  }, [])

  /** 生效情况（v8.5.0）：统计窗口内的任务量/节流次数/静默条数，
   *  让「旋钮是否真的生效」可验证而不是只写在表单里。与设置覆盖是否
   *  存在无关——404（无覆盖）也要拉，否则新仓库永远显示「暂无任务」。 */
  const loadEffect = (p: string, o: string, r: string) => {
    const seq = ++effectSeq.current
    api.statsOverview({ days: 30, platform: p, owner: o, repo: r })
      .then((s) => {
        if (seq === effectSeq.current) setEffect((s?.repos ?? [])[0] ?? null)
      })
      .catch(() => {
        if (seq === effectSeq.current) setEffect(null)
      })
  }

  const load = async (p = platform, o = owner, r = repo) => {
    if (!o || !r) {
      message.warning('请完整选择 owner 与仓库')
      return
    }
    setLoading(true)
    setEffect(null)
    setLoadError('')
    try {
      const row = await api.getRepoSettings(p, o, r)
      const v: RepoSettingsValues = row?.settings ?? (row?.settings_json ? JSON.parse(row.settings_json) : {})
      setState({
        throttle: v.comment_throttle_minutes ?? 0,
        cap: v.findings_cap ?? 0,
        floor: v.severity_floor ?? '',
        ocrEnabled: v.ocr_delegate_enabled ?? true,
        monthlyBudget: v.monthly_token_budget,
        taskBudget: v.task_token_budget,
        maxDiffChars: v.max_diff_chars,
        reportTemplate: v.report_template ?? '',
      })
      setLoaded(true)
      setDirty(false)
    } catch (e: any) {
      if (e?.status === 404) {
        // 404 = 无覆盖（全新仓库）：给默认值而非报错
        setState(DEFAULTS)
        setLoaded(true)
        setDirty(false)
        message.info('该仓库暂无自定义设置，当前为全局默认值')
      } else {
        // 403/500 等真错误不能伪装成「无配置」——否则用户以为在编辑默认值
        setLoaded(false)
        setLoadError(e?.message || '加载设置失败')
      }
    } finally {
      loadEffect(p, o, r)
      setLoading(false)
    }
  }

  // 从质量运营/任务详情带 platform/owner/repo 跳转时自动加载一次。
  const autoLoaded = useRef(false)
  useEffect(() => {
    if (autoLoaded.current) return
    autoLoaded.current = true
    if (owner && repo) load(platform, owner, repo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    } catch (e: any) {
      message.error(e?.message || '保存失败（需要 admin 档 token 且仓库在授权范围内）')
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
    } catch (e: any) {
      message.error(e?.message || '操作失败')
    }
  }

  const preview = useMemo(() => previewText(state), [state])

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        <ControlOutlined /> 仓库设置
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        按仓库定制审查行为：回复频次 / 数量 / 级别、预算上限、报告模板与 OCR 预检。
        未设置的项继承全局部署默认；修改对<strong>下一个审查任务</strong>生效。
      </Typography.Paragraph>

      {/* 仓库选择条 */}
      <Card size="small" className="glass" style={{ marginBottom: 16 }}>
        <Space wrap size={12}>
          <RepoPicker
            value={{ platform, owner, repo }}
            onChange={(c: Coords) => {
              setPlatform(c.platform)
              setOwner(c.owner)
              setRepo(c.repo)
              setLoaded(false)
              setLoadError('')
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
                setPlatform(p); setOwner(o); setRepo(r)
                load(p, o, r)
              }}
            />
          )}
        </Space>
      </Card>

      {activeRepos.length > 0 && (
        <Card
          size="small"
          style={{ marginBottom: 16 }}
          title={<Space><ThunderboltOutlined />近期活跃仓库</Space>}
          extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>近 30 天有审查任务 · 点击直接加载</Typography.Text>}
        >
          <Space wrap size={[8, 8]}>
            {activeRepos.map((r) => {
              const label = `${r.platform}/${r.owner}/${r.repo}`
              const active = r.platform === platform && r.owner === owner && r.repo === repo
              return (
                <Tag
                  key={label}
                  color={active ? 'blue' : undefined}
                  style={{ cursor: 'pointer', marginInlineEnd: 0 }}
                  onClick={() => {
                    setPlatform(r.platform); setOwner(r.owner); setRepo(r.repo)
                    void load(r.platform, r.owner, r.repo)
                  }}
                >
                  <span className="mono" style={{ fontSize: 12 }}>{label}</span>
                </Tag>
              )
            })}
          </Space>
        </Card>
      )}

      {loadError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title="加载设置失败"
          description={`${loadError}（403=令牌无该仓管理范围；这不代表仓库没有配置）`}
          action={<Button size="small" onClick={() => load()}>重试</Button>}
        />
      )}

      {!loaded && !loadError && (
        <Empty description="选择上方仓库加载设置；近期活跃仓库可一键载入" style={{ margin: '48px 0' }} />
      )}

      {loaded && (
        <Spin spinning={loading}>
          {/* ===== 回复控制（核心卡片） ===== */}
          <Card
            title={<Space><CommentOutlined />回复控制</Space>}
            style={{ marginBottom: 16 }}
            extra={dirty && <Tag color="orange">有未保存修改</Tag>}
          >
            <Space wrap style={{ marginBottom: 16 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>快捷预设：</Typography.Text>
              {PRESETS.map((p) => (
                <Tooltip key={p.label} title={p.desc}>
                  <Button size="small" onClick={() => patch(p.values)}>{p.label}</Button>
                </Tooltip>
              ))}
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                预设只改回复三个旋钮，保存后对下一个审查任务生效
              </Typography.Text>
            </Space>
            <Row gutter={[24, 16]}>
              <Col xs={24} md={8}>
                <Typography.Text strong>回复频次</Typography.Text>
                <Tooltip title="同一 MR 在该时间窗内不重复回帖（审查与报告照常，仅不回帖）。0 = 不节流。">
                  <InfoCircleOutlined style={{ marginLeft: 6, color: '#888' }} />
                </Tooltip>
                <Slider
                  min={0} max={1440} step={15}
                  marks={{ 0: '不节流', 30: '30分', 60: '1时', 240: '4时', 1440: '24时' }}
                  value={state.throttle}
                  onChange={(v) => patch({ throttle: v as number })}
                  tooltip={{ formatter: (v) => (v === 0 ? '不节流' : `${v} 分钟`) }}
                />
                <InputNumber
                  min={0} max={1440} value={state.throttle}
                  onChange={(v) => patch({ throttle: v ?? 0 })}
                  suffix="分钟" style={{ width: '100%' }}
                />
              </Col>
              <Col xs={24} md={8}>
                <Typography.Text strong>回复数量</Typography.Text>
                <Tooltip title="单个报告最多回帖的意见条数，超出按严重度取 top N，其余以计数行略去。0 = 不封顶。">
                  <InfoCircleOutlined style={{ marginLeft: 6, color: '#888' }} />
                </Tooltip>
                <div style={{ marginTop: 8 }}>
                  <InputNumber
                    min={0} max={50} value={state.cap}
                    onChange={(v) => patch({ cap: v ?? 0 })}
                    suffix="条 / 报告" style={{ width: '100%' }}
                  />
                </div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  建议 5–15；0 为不封顶
                </Typography.Text>
              </Col>
              <Col xs={24} md={8}>
                <Typography.Text strong>回复级别</Typography.Text>
                <Tooltip title="只回帖该级别及以上的意见；更低级别静默，报告中保留计数。">
                  <InfoCircleOutlined style={{ marginLeft: 6, color: '#888' }} />
                </Tooltip>
                <div style={{ marginTop: 8 }}>
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
              style={{ marginTop: 16 }}
              type="info"
              showIcon
              icon={<EyeOutlined />}
              title="效果预览"
              description={preview}
            />

            <div style={{ marginTop: 16 }}>
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
                    <InfoCircleOutlined style={{ marginLeft: 6 }} />
                  </Tooltip>
                </Typography.Text>
              </Space>
            </div>
          </Card>

          {/* ===== 近 30 天生效情况（v8.5.0：旋钮效果可验证） ===== */}
          <Card
            size="small"
            title={<Space><BarChartOutlined />近 30 天生效情况</Space>}
            style={{ marginBottom: 16 }}
          >
            {effect ? (
              <>
                <Row gutter={[24, 8]}>
                  <Col xs={12} md={6}><Statistic title="审查任务" value={effect.tasks_done ?? 0} /></Col>
                  <Col xs={12} md={6}>
                    <Statistic
                      title="节流跳过回帖"
                      value={effect.reply_throttled ?? 0}
                      suffix="次"
                      styles={{ content: { color: (effect.reply_throttled ?? 0) > 0 ? '#f0b429' : undefined } }}
                    />
                  </Col>
                  <Col xs={12} md={6}>
                    <Statistic title="低于级别地板静默" value={effect.silenced_floor ?? 0} suffix="条" />
                  </Col>
                  <Col xs={12} md={6}>
                    <Statistic title="超出数量上限静默" value={effect.silenced_cap ?? 0} suffix="条" />
                  </Col>
                </Row>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  静默只影响回帖/行内意见，审查与报告仍全量执行；每份报告的尾注会列出本轮静默条数。
                </Typography.Text>
              </>
            ) : (
              <Typography.Text type="secondary">近 30 天暂无已完成审查任务。</Typography.Text>
            )}
          </Card>

          {/* ===== 预算与上限 ===== */}
          <Card title={<Space><ThunderboltOutlined />预算与上限</Space>} style={{ marginBottom: 16 }}>
            <Row gutter={[24, 16]}>
              <Col xs={24} md={8}>
                <Typography.Text strong>月度 token 预算</Typography.Text>
                <InputNumber
                  min={1} max={1_000_000_000} value={state.monthlyBudget}
                  onChange={(v) => patch({ monthlyBudget: v ?? undefined })}
                  placeholder="继承全局"
                  style={{ width: '100%', marginTop: 8 }}
                />
              </Col>
              <Col xs={24} md={8}>
                <Typography.Text strong>单任务 token 预算</Typography.Text>
                <InputNumber
                  min={1} max={1_000_000_000} value={state.taskBudget}
                  onChange={(v) => patch({ taskBudget: v ?? undefined })}
                  placeholder="继承全局"
                  style={{ width: '100%', marginTop: 8 }}
                />
              </Col>
              <Col xs={24} md={8}>
                <Typography.Text strong>diff 字符上限</Typography.Text>
                <InputNumber
                  min={1} max={1_000_000_000} value={state.maxDiffChars}
                  onChange={(v) => patch({ maxDiffChars: v ?? undefined })}
                  placeholder="继承全局"
                  style={{ width: '100%', marginTop: 8 }}
                />
              </Col>
            </Row>
          </Card>

          {/* ===== 报告模板 ===== */}
          <Card title="报告模板" style={{ marginBottom: 16 }}>
            <Select
              value={state.reportTemplate}
              onChange={(v) => patch({ reportTemplate: v })}
              options={REPORT_TEMPLATES}
              style={{ width: 320 }}
            />
            <Typography.Text type="secondary" style={{ marginLeft: 12 }}>
              裁决链：任务级 &gt; 本设置 &gt; 仓库 yaml &gt; 部署默认
            </Typography.Text>
          </Card>

          {/* ===== 操作条 ===== */}
          <Space size={12}>
            <Button
              type="primary" icon={<SaveOutlined />}
              loading={saving} disabled={!dirty}
              onClick={save}
            >
              保存设置
            </Button>
            <Popconfirm
              title="恢复全局默认？"
              description="将删除本仓库的全部自定义设置。"
              okText="恢复默认" okButtonProps={{ danger: true }}
              cancelText="取消"
              onConfirm={reset}
            >
              <Button icon={<DeleteOutlined />} danger>恢复默认</Button>
            </Popconfirm>
            {dirty && (
              <Button icon={<ReloadOutlined />} onClick={() => load()}>
                放弃修改
              </Button>
            )}
          </Space>

          {dirty && (
            <div style={{ position: 'sticky', bottom: 16, marginTop: 16, zIndex: 10 }}>
              <Card size="small" className="glass">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <Tag color="orange">有未保存修改</Tag>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    保存后对下一个审查任务生效
                  </Typography.Text>
                  <div style={{ flex: 1 }} />
                  <Button size="small" onClick={() => load()}>放弃</Button>
                  <Button size="small" type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>
                    保存
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </Spin>
      )}
    </div>
  )
}
