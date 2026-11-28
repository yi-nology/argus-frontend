/**
 * 主题跟随系统 `prefers-color-scheme`（明亮企业风：浅色主基调，暗色随系统）。
 * 变化时把调色板写进 :root，antd 主题与 CSS 共用同一事实源。
 */
import { useEffect, useState } from 'react'
import { applyPalette, currentThemeMode, paletteFor, type ThemeMode } from './tokens'

export function useThemeMode(): ThemeMode {
  const [mode, setMode] = useState<ThemeMode>(() => currentThemeMode())

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setMode(currentThemeMode())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    applyPalette(paletteFor(mode))
  }, [mode])

  return mode
}
