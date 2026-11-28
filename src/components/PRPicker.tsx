/**
 * PRPicker —— PR/MR 号选择（v8.8.1 控制台可用性迭代）。
 *
 * 坐标齐备时拉平台在开 PR/MR 清单（GET /repos/crs），下拉展示 #号+标题+作者；
 * 同时保留纯数字自由输入（平台不可达/新 PR 未同步时不被锁死）。
 */
import { useEffect, useMemo, useState } from 'react'
import { AutoComplete } from 'antd'
import { api, type RepoCR } from '../api/client'
import { defer } from '../hooks/async'
import type { Coords } from './RepoPicker'

type CacheEntry = { at: number; items: RepoCR[] }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60_000

export default function PRPicker({
  coords,
  value,
  onChange,
  disabled,
  style,
  placeholder = 'PR #',
}: {
  coords: Coords
  value?: number | null
  onChange?: (v: number | undefined) => void
  disabled?: boolean
  style?: React.CSSProperties
  placeholder?: string
}) {
  const [items, setItems] = useState<RepoCR[]>([])
  const [loading, setLoading] = useState(false)
  // 调用方可能传对象字面量：按字段取原语做 effect 依赖，避免对象身份变化导致循环。
  const { platform, owner, repo } = coords
  const complete = !!(platform && owner && repo)

  useEffect(() => {
    if (!complete) return
    let alive = true
    // 状态写入经 continuation（react-hooks/set-state-in-effect）：effect 体不做同步 setState。
    defer(() => {
      if (!alive) return
      const key = `${platform}/${owner}/${repo}`
      const hit = cache.get(key)
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
        setItems(hit.items)
        return
      }
      setLoading(true)
      api
        .repoCRs({ platform, owner, repo })
        .then((res) => {
          const list = res?.items ?? []
          cache.set(key, { at: Date.now(), items: list })
          if (alive) setItems(list)
        })
        .catch(() => {
          if (alive) setItems([]) // 平台不可达：降级为自由输入
        })
        .finally(() => {
          if (alive) setLoading(false)
        })
    })
    return () => {
      alive = false
    }
  }, [platform, owner, repo, complete])

  // 坐标不全时选项为空：派生而非 effect 里同步 setItems([])（避免级联渲染）。
  const options = useMemo(
    () =>
      (complete ? items : []).map((c) => ({
        value: c.number,
        label: `#${c.number} ${c.title}${c.draft ? '（草稿）' : ''}${c.author ? ` · ${c.author}` : ''}`,
      })),
    [items, complete],
  )

  return (
    <AutoComplete
      value={value != null ? String(value) : ''}
      options={options}
      style={style}
      disabled={disabled}
      placeholder={complete ? (loading ? '加载 PR 列表…' : placeholder) : '先选仓库'}
      filterOption={(input, opt) =>
        String(opt?.label ?? '')
          .toLowerCase()
          .includes(input.toLowerCase()) || String(opt?.value ?? '').startsWith(input)
      }
      onChange={(text: string) => {
        const digits = text.replace(/[^0-9]/g, '')
        onChange?.(digits ? Number(digits) : undefined)
      }}
    />
  )
}
