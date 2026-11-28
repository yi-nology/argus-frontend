import { useCallback, useRef } from 'react'
import { useRequest } from '@umijs/max'
import { errMsg } from '../api/client'
import { useLatestRef } from './async'

/**
 * useApi —— Umi useRequest 的本仓薄封装。
 *
 * 动机：12 个页面各自手写 load + loadRef.current = load + loading/loadErr 双态
 * + useEffect 首跑样板（每页 20-30 行）。useRequest 的 service 是 persist 函数
 * （run/refresh 恒调最新闭包），SSE/深链回调可直接拿稳定引用——loadRef 整类消失。
 *
 * 与裸 useRequest 的差异：
 * - dataField 已在 .umirc.ts 置 ''（api/client.ts 解包信封后返回裸数据，不能多剥一层）；
 * - errorText：异常 → 可展示文案（errMsg 收敛，供 <LoadError> 常驻展示）；
 * - run/refresh 是稳定引用（内部经 ref 转发），可安全作 effect 依赖；
 * - run/refresh 失败不向调用方抛（本仓 load() 语义：异常只进 errorText）；
 * - 泛型对外干净：页面只见 TData/TArgs，umi 松散类型只在本文件收口。
 */

export interface UseApiOptions<TArgs extends unknown[], TData> {
  /** 默认 true=自动执行；manual: true 时由 run() 触发（按钮/深链/提交）。 */
  manual?: boolean
  /** 任一项变化即自动重查（替代 useEffect+loadRef 的依赖刷新）。 */
  refreshDeps?: unknown[]
  defaultParams?: TArgs
  pollingInterval?: number
  debounceInterval?: number
  onSuccess?: (data: TData, params: TArgs) => void
  onError?: (error: unknown, params: TArgs) => void
  /** errMsg 兜底文案（默认「加载失败」）。 */
  errorFallback?: string
}

export interface UseApiResult<TArgs extends unknown[], TData> {
  data: TData | undefined
  loading: boolean
  /** 异常已转展示文案；无错为空串（喂 <LoadError error=...>）。 */
  errorText: string
  /** 手动触发（失败只进 errorText，不抛）；稳定引用。 */
  run: (...args: TArgs) => Promise<TData | undefined>
  /** 按上次参数重查（失败只进 errorText，不抛）；稳定引用。 */
  refresh: () => Promise<TData | undefined>
  mutate: (data: TData | ((prev: TData | undefined) => TData)) => void
  /** 清空数据与错误（换仓/换目标重置场景）。 */
  reset: () => void
}

/** umi useRequest 的松散内部签名（各重载统一收口到这一种）。 */
interface UmiRequestLike {
  (
    service: unknown,
    options?: unknown,
  ): {
    data: unknown
    loading: boolean
    error: unknown
    run: (...args: unknown[]) => Promise<unknown>
    refresh: () => Promise<unknown>
    mutate: (data: unknown) => void
    reset: () => void
  }
}

/** 失败静默为 undefined（errorText 兜住展示），成功透传。 */
function quiet<TData>(p: Promise<unknown>): Promise<TData | undefined> {
  return p.then((d) => d as TData).catch(() => undefined)
}

export function useApi<TArgs extends unknown[] = [], TData = unknown>(
  service: (...args: TArgs) => Promise<TData>,
  options: UseApiOptions<TArgs, TData> = {},
): UseApiResult<TArgs, TData> {
  const { errorFallback = '加载失败', onSuccess, onError, ...rest } = options
  // ahooks 失败分支会把 data 重置为 undefined（刷新失败旧表即空）；本仓语义是
  // 「失败保留上次成功数据 + 常驻错误条」。last-good 只在成功时更新。
  const lastGood = useRef<TData | undefined>(undefined)
  const req = (useRequest as unknown as UmiRequestLike)(service, {
    ...rest,
    onSuccess: (data: unknown, params: unknown[]) => {
      lastGood.current = data as TData
      onSuccess?.(data as TData, params as TArgs)
    },
    onError: (error: unknown, params: unknown[]) => onError?.(error, params as TArgs),
  })
  // ahooks 返回的 run/refresh 在首次请求前是每次渲染新建的兜底 stub；经 ref 转发
  // 让对外引用恒稳（SSE/订阅 effect 以 [refresh] 为依赖不会反复重挂）。
  const invoke = useLatestRef({
    run: req.run,
    refresh: req.refresh,
    mutate: req.mutate,
    reset: req.reset,
  })
  const reset = useCallback(() => {
    // reset 清掉 ahooks 内部 fetch 状态（data/error/loading 归零）；
    // last-good 同步清空，否则下次失败会把旧数据「复活」。
    lastGood.current = undefined
    invoke.current.reset()
  }, [invoke])
  const run = useCallback(
    (...args: TArgs) => quiet<TData>(invoke.current.run(...args)),
    [invoke],
  ) as (...args: TArgs) => Promise<TData | undefined>
  const refresh = useCallback(
    () => quiet<TData>(invoke.current.refresh()),
    [invoke],
  ) as () => Promise<TData | undefined>
  const mutate = useCallback(
    (data: TData | ((prev: TData | undefined) => TData)) => {
      // 函数式更新器先在本地解析：last-good 必须存解析后的值（不是函数）。
      const next =
        typeof data === 'function'
          ? (data as (prev: TData | undefined) => TData)(lastGood.current)
          : data
      lastGood.current = next
      invoke.current.mutate(next)
    },
    [invoke],
  ) as (data: TData | ((prev: TData | undefined) => TData)) => void
  return {
    // 失败时回退上次成功数据（错误照常进 errorText）。
    data: (req.error ? lastGood.current : req.data) as TData | undefined,
    loading: req.loading,
    errorText: req.error ? errMsg(req.error, errorFallback) : '',
    run,
    refresh,
    mutate,
    reset,
  }
}
