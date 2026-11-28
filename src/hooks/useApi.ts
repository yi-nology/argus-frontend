import { useCallback, useEffect, useRef, useState } from 'react'
import { errMsg } from '../api/client'

/**
 * useApi —— 本仓的数据加载样板收敛（纯 React 实现，零额外依赖）。
 *
 * 动机：12 个页面各自手写 load + loadRef.current = load + loading/loadErr 双态
 * + useEffect 首跑样板（每页 20-30 行）。这里收敛成一个 hook，页面只写
 * `{ data, loading, errorText, run, refresh, mutate }`。
 *
 * 为什么不走 Umi 的 useRequest / ahooks：`@umijs/max` 的实际导出面里**没有**
 * useRequest（只有路由与 appData 钩子，见 src/.umi/exports.ts），request 插件
 * 也没生成对应导出——迁移到 Umi 后 `import { useRequest } from '@umijs/max'`
 * 是编译期就不存在的成员，靠构建缓存才没立刻炸。依赖树里也没有 ahooks。
 * 与其为一个 60 行的 hook 引第三方依赖，不如自己实现：语义完全可控。
 *
 * 语义（与「页面手写 load」一致）：
 * - `run()` 异常只进 errorText，**绝不向调用方抛**——`void run()` 安全；
 * - `refresh()` 用**最新**的 params 重跑（依赖变化时首跑的参数）；
 * - `manual: true` 时不由 effect 触发，交由按钮/深链/提交调用；
 * - `refreshDeps` 任一项变化即自动重查（替代 useEffect+loadRef 的依赖刷新）。
 */

export interface UseApiOptions<TArgs extends unknown[], TData> {
  /** 默认 false=挂载即自动执行；manual: true 时由 run() 触发。 */
  manual?: boolean
  /** 任一项变化即自动重查。 */
  refreshDeps?: unknown[]
  /** manual 模式下 ready=false 时 run() 记忆参数，ready 转 true 补跑。 */
  ready?: boolean
  defaultParams?: TArgs
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
  run: (...args: TArgs) => Promise<TData | undefined>
  refresh: () => Promise<TData | undefined>
  mutate: (data: TData | ((prev: TData | undefined) => TData)) => void
  /** 清空数据与错误（切换仓库/坐标时重置视图），不触发请求。 */
  reset: () => void
}

export function useApi<TArgs extends unknown[] = [], TData = unknown>(
  service: (...args: TArgs) => Promise<TData>,
  options: UseApiOptions<TArgs, TData> = {},
): UseApiResult<TArgs, TData> {
  const {
    manual = false,
    refreshDeps,
    ready = true,
    defaultParams,
    onSuccess,
    onError,
    errorFallback = '加载失败',
  } = options

  const [data, setData] = useState<TData | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState('')

  // 用 ref 吸收 service/回调的最新闭包，让 run/refresh 是稳定引用
  //（SSE/深链回调可以直接拿，不必再写 loadRef）。
  const serviceRef = useRef(service)
  serviceRef.current = service
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const defaultParamsRef = useRef(defaultParams)
  defaultParamsRef.current = defaultParams
  const lastParamsRef = useRef<TArgs | undefined>(defaultParams)
  const pendingRef = useRef<TArgs | undefined>(undefined)
  const readyRef = useRef(ready)
  readyRef.current = ready

  const exec = useCallback(
    async (params: TArgs): Promise<TData | undefined> => {
      if (!readyRef.current) {
        pendingRef.current = params // ready 转 true 时补跑
        return undefined
      }
      lastParamsRef.current = params
      setLoading(true)
      setErrorText('')
      try {
        const result = await serviceRef.current(...params)
        setData(result)
        onSuccessRef.current?.(result, params)
        return result
      } catch (e) {
        // 只进 errorText，不向调用方抛——页面可安全 `void run()`。
        setErrorText(errMsg(e, errorFallback))
        onErrorRef.current?.(e, params)
        return undefined
      } finally {
        setLoading(false)
      }
    },
    [errorFallback],
  )

  const run = useCallback((...args: TArgs) => exec(args), [exec])

  const refresh = useCallback(() => exec(lastParamsRef.current ?? ([] as unknown as TArgs)), [exec])

  const mutate = useCallback((next: TData | ((prev: TData | undefined) => TData)) => {
    setData((prev) =>
      typeof next === 'function' ? (next as (p: TData | undefined) => TData)(prev) : next,
    )
  }, [])

  // ready 从 false 转 true：补跑 manual 模式下被记忆的参数。
  useEffect(() => {
    if (ready && pendingRef.current) {
      const p = pendingRef.current
      pendingRef.current = undefined
      void exec(p)
    }
  }, [ready, exec])

  // 自动执行 / refreshDeps 变化重查。
  const deps = refreshDeps ?? []
  const depsKey = JSON.stringify(deps)
  useEffect(() => {
    if (manual) return
    void exec(defaultParamsRef.current ?? ([] as unknown as TArgs))
    // depsKey 编码 refreshDeps 的内容变化；首跑参数经 ref 取最新值，
    // 故 effect 依赖只列 manual/depsKey/exec——无需禁用 exhaustive-deps。
  }, [manual, depsKey, exec])

  const reset = useCallback(() => {
    setData(undefined)
    setErrorText('')
  }, [])

  return { data, loading, errorText, run, refresh, mutate, reset }
}
