import { useEffect, useRef } from 'react'

/**
 * 最新值 ref：订阅/回调闭包借此读到最新渲染值。
 * 赋值在 effect 里完成——渲染期写 ref 违反 react-hooks/refs（并发渲染下可能被
 * 中断/重放，写入时机不受控）。
 */
export function useLatestRef<T>(value: T): { current: T } {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}

/**
 * 把动作调度进 Promise continuation 执行。effect 体只做订阅/调度，状态写入
 * 落在回调里（react-hooks/set-state-in-effect：effect 体同步 setState 会触发
 * 级联渲染）。事件处理器里的同步调用不经此函数。
 */
export function defer(fn: () => void): void {
  void Promise.resolve().then(fn)
}
