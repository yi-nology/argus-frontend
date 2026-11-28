/**
 * 深链坐标自动执行：`?platform&owner&repo&number`（或三参仓库域）完整时触发一次查询。
 * 五个治理页（意见治理/修复审批/合并资格门/受控推送/仓库设置）共用同一语义，
 * 此前各页手抄一份 + 各自 eslint-disable；这里用回调 ref 吸收依赖，无需禁用 lint。
 */
import { useEffect, useRef } from 'react'
import { useSearchParams } from '@umijs/max'
import type { Coords } from '../components/RepoPicker'
import { defer, useLatestRef } from './async'

export interface DeepLinkOptions {
  /**
   * 是否要求 PR 号才触发（默认 true，对齐审批/合并/推送这类 PR 域操作）。
   * 仓库域页面（意见治理/仓库设置）传 false：三参坐标即自动加载。
   */
  requireNumber?: boolean
}

export function useDeepLink(
  onCoords: (coords: Coords, number: number | null) => void,
  opts: DeepLinkOptions = {},
): void {
  const requireNumber = opts.requireNumber !== false
  const [params] = useSearchParams()
  const cbRef = useLatestRef(onCoords)
  // 去重盒（非「最新值」语义）：记录已消费的 query key，必须保留跨渲染状态。
  const lastRef = useRef('')
  const key = params.toString()

  useEffect(() => {
    if (!key || key === lastRef.current) return
    lastRef.current = key
    const q = new URLSearchParams(key)
    const platform = q.get('platform')
    const owner = q.get('owner')
    const repo = q.get('repo')
    const number = q.get('number')
    if (!platform || !owner || !repo) return
    if (requireNumber && !number) return
    // 回调（及其状态写入）经 continuation 执行：effect 体不做同步 setState。
    defer(() => {
      cbRef.current({ platform, owner, repo }, number ? Number(number) || null : null)
    })
  }, [key, requireNumber, cbRef])
}

/** 治理页共用的查询参数构造（`?platform&owner&repo&number` 深链契约）。 */
export function scopeQuery(c: Coords, n?: number | null): string {
  const q = new URLSearchParams()
  if (c.platform) q.set('platform', c.platform)
  if (c.owner) q.set('owner', c.owner)
  if (c.repo) q.set('repo', c.repo)
  if (n) q.set('number', String(n))
  const s = q.toString()
  return s ? `?${s}` : ''
}
