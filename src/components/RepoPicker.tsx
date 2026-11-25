/**
 * RepoPicker —— 仓库坐标选择条（v8.7.0 控制台可用性迭代）。
 *
 * 平台 Select + owner/repo 级联 AutoComplete：选项来自后端 /console/options
 * 的 repos 登记面（已按租户 + token 仓库约束行过滤），同时保留自由输入
 * ——新仓库还没登记过（尚无任务/映射）时仍可直接填写，不被下拉锁死。
 */
import { useEffect, useMemo, useState } from 'react'
import { AutoComplete, Select, Space } from 'antd'
import { api, type ConsoleOptions } from '../api/client'
import { PLATFORMS } from '../constants/platforms'
import { platformLabel } from '../constants/vocab'

export interface Coords {
  platform: string
  owner: string
  repo: string
}

/** 模块级缓存：同一次页面会话只拉一次选项面。 */
let optionsCache: Promise<ConsoleOptions> | null = null

export function loadConsoleOptions(refresh = false): Promise<ConsoleOptions> {
  if (!optionsCache || refresh) {
    optionsCache = api.consoleOptions().catch(() => ({
      platforms: [],
      kinds: [],
      statuses: [],
      repos: [],
    }))
  }
  return optionsCache
}

/** 读取选项面（platforms/kinds/statuses/repos）；失败降级为空集，不阻断表单。 */
export function useConsoleOptions(): ConsoleOptions | null {
  const [opts, setOpts] = useState<ConsoleOptions | null>(null)
  useEffect(() => {
    let alive = true
    void loadConsoleOptions().then((o) => {
      if (alive) setOpts(o)
    })
    return () => {
      alive = false
    }
  }, [])
  return opts
}

export default function RepoPicker({
  value,
  onChange,
  platformWidth = 140,
  ownerWidth = 180,
  repoWidth = 200,
  disabled,
}: {
  value: Coords
  onChange: (v: Coords) => void
  platformWidth?: number
  ownerWidth?: number
  repoWidth?: number
  disabled?: boolean
}) {
  const opts = useConsoleOptions()
  const repos = opts?.repos ?? []
  const platforms = opts?.platforms?.length ? opts.platforms : [...PLATFORMS]

  // 选项面晚于页面挂载到达时回填默认平台（否则父级坐标一直缺 platform，
  // 用户看似选了平台却校验不过）。
  useEffect(() => {
    if (!value.platform && platforms.length > 0) {
      onChange({ platform: platforms[0], owner: value.owner, repo: value.repo })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platforms.length, value.platform])

  const ownerOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of repos) {
      if (value.platform && r.platform !== value.platform) continue
      set.add(r.owner)
    }
    return [...set].sort().map((o) => ({ value: o }))
  }, [repos, value.platform])

  const repoOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of repos) {
      if (value.platform && r.platform !== value.platform) continue
      if (value.owner && r.owner !== value.owner) continue
      set.add(r.repo)
    }
    return [...set].sort().map((r) => ({ value: r }))
  }, [repos, value.platform, value.owner])

  const filter = (input: string, opt?: { value?: string | number }) =>
    String(opt?.value ?? '').toLowerCase().includes(input.toLowerCase())

  return (
    <Space wrap size={8}>
      <Select
        showSearch
        value={value.platform || undefined}
        style={{ width: platformWidth }}
        placeholder="平台"
        optionFilterProp="label"
        disabled={disabled}
        onChange={(p: string) => onChange({ platform: p, owner: '', repo: '' })}
        options={platforms.map((p) => ({ value: p, label: platformLabel(p) }))}
      />
      <AutoComplete
        value={value.owner}
        style={{ width: ownerWidth }}
        placeholder="owner / 组织"
        disabled={disabled}
        options={ownerOptions}
        filterOption={filter}
        onChange={(o: string) => onChange({ ...value, owner: o, repo: o !== value.owner ? '' : value.repo })}
      />
      <AutoComplete
        value={value.repo}
        style={{ width: repoWidth }}
        placeholder="仓库名"
        disabled={disabled}
        options={repoOptions}
        filterOption={filter}
        onChange={(r: string) => onChange({ ...value, repo: r })}
      />
    </Space>
  )
}