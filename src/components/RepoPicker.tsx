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
import { defer, useLatestRef } from '../hooks/async'

export interface Coords {
  platform: string
  owner: string
  repo: string
}

/** 三个下拉的默认宽度（px）。 */
const W_PLATFORM = 140
const W_OWNER = 180
const W_REPO = 200

/** 模块级缓存：同一次页面会话只拉一次选项面。**失败不入缓存**（否则一次网络抖动就把下拉锁死到会话结束）。 */
let optionsCache: Promise<ConsoleOptions> | null = null

export function loadConsoleOptions(refresh = false): Promise<ConsoleOptions> {
  if (!optionsCache || refresh) {
    optionsCache = api.consoleOptions().catch((e) => {
      optionsCache = null // 失败不缓存：下次挂载可重试
      throw e
    })
  }
  return optionsCache.catch(() => ({
    platforms: [],
    kinds: [],
    statuses: [],
    repos: [],
  }))
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
  platformWidth = W_PLATFORM,
  ownerWidth = W_OWNER,
  repoWidth = W_REPO,
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
  // `?? []` 每次渲染都是新数组会让下游 useMemo 恒失效，这里单独 memo 收口。
  const repos = useMemo(() => opts?.repos ?? [], [opts?.repos])
  const platforms = opts?.platforms?.length ? opts.platforms : [...PLATFORMS]

  // 选项面晚于页面挂载到达时回填默认平台（否则父级坐标一直缺 platform，
  // 用户看似选了平台却校验不过）。回调/坐标走 ref 取最新值，effect 只跟
  // 首选平台与 platform 值变化走，无需禁用 lint。
  //
  // 只用**真实选项**的第一个平台回填：静态 PLATFORMS 只作下拉展示兜底，
  // 若用它回填，会在 /console/options 到达前把 platform 抢先写成 gitea，
  // 真实选项到达后 value.platform 已非空而被 return，永远纠不回来。
  const changeRef = useLatestRef(onChange)
  const valueRef = useLatestRef(value)
  const firstPlatform = opts?.platforms?.[0] ?? ''
  useEffect(() => {
    if (!firstPlatform) return
    if (value.platform) return
    // 回填经 continuation 执行（effect 体不做同步状态写入）。
    defer(() => {
      const v = valueRef.current
      changeRef.current({ platform: firstPlatform, owner: v.owner, repo: v.repo })
    })
  }, [firstPlatform, value.platform, changeRef, valueRef])

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
    String(opt?.value ?? '')
      .toLowerCase()
      .includes(input.toLowerCase())

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
        onChange={(o: string) =>
          onChange({ ...value, owner: o, repo: o !== value.owner ? '' : value.repo })
        }
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
