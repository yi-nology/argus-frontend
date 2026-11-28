/**
 * 设计 token 单源（明亮企业风：浅色主基调，暗色跟随系统）。
 *
 * 纪律：
 * - 颜色只在本文件出现具体色值；组件/页面一律引用 CSS 变量（`color.text` 之类），
 *   由 `applyPalette()` 在运行时写入 :root，随 `prefers-color-scheme` 自动换肤，
 *   因此 TSX / global.css 中**禁止**出现裸色值（#hex / rgb() / rgba()）。
 * - 字号 / 间距 / 圆角等不随主题变化的标尺以数值导出，同样禁止散落裸值。
 * - 语义优先：组件表达「这是次要文本 / 这是危险态」，不表达「这是 #59636e」。
 */

/** 字号标尺（px）。UI 正文 14，密集数据 13，辅助 12。 */
export const font = {
  xs: 12,
  sm: 13,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 30,
} as const

export const weight = {
  regular: 400,
  medium: 500,
  semibold: 600,
} as const

/** 间距标尺（px），4 为基数。 */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
  huge: 48,
} as const

export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
} as const

export const line = {
  tight: 1.3,
  normal: 1.55,
  relaxed: 1.7,
} as const

/** 动效标尺（ms）。仅用于 transform/opacity，且尊重 prefers-reduced-motion。 */
export const motion = {
  fast: 120,
  base: 180,
  slow: 240,
} as const

/** 阴影：仅浮层（Modal/Drawer/Dropdown）使用，卡片不靠阴影分层。 */
export const shadow = {
  xs: '0 1px 2px rgba(31, 35, 40, 0.06)',
  sm: '0 3px 8px rgba(31, 35, 40, 0.10)',
  md: '0 8px 24px rgba(31, 35, 40, 0.14)',
} as const

export const fontMono =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace"

export const fontSans =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif"

/** 调色板：唯一允许出现具体色值的地方。key 即 CSS 变量名后缀。 */
export interface Palette {
  canvas: string
  surface: string
  surfaceSubtle: string
  surfaceMuted: string
  border: string
  borderMuted: string
  text: string
  textMuted: string
  textSubtle: string
  accent: string
  accentSubtle: string
  success: string
  successSubtle: string
  attention: string
  attentionSubtle: string
  danger: string
  dangerSubtle: string
  info: string
  infoSubtle: string
  sevCritical: string
  sevCriticalSubtle: string
  sevHigh: string
  sevHighSubtle: string
  sevMedium: string
  sevMediumSubtle: string
  sevLow: string
  sevLowSubtle: string
  sevInfo: string
  sevInfoSubtle: string
}

/** 浅色主基调：GitHub / Stripe 一路的中性表面坡度 + 单一强调蓝。 */
export const paletteLight: Palette = {
  canvas: '#f6f8fa',
  surface: '#ffffff',
  surfaceSubtle: '#eef1f5',
  surfaceMuted: '#f2f4f8',
  border: '#d0d7de',
  borderMuted: '#e4e8ee',
  text: '#1f2328',
  textMuted: '#59636e',
  textSubtle: '#78828f',
  accent: '#0969da',
  accentSubtle: '#eef4fd',
  success: '#1a7f37',
  successSubtle: '#dafbe1',
  attention: '#9a6700',
  attentionSubtle: '#fff8c5',
  danger: '#cf222e',
  dangerSubtle: '#ffebe9',
  info: '#0969da',
  infoSubtle: '#ddf4ff',
  sevCritical: '#a40e26',
  sevCriticalSubtle: '#ffebe9',
  sevHigh: '#bc4c00',
  sevHighSubtle: '#fff1e5',
  sevMedium: '#9a6700',
  sevMediumSubtle: '#fff8c5',
  sevLow: '#0969da',
  sevLowSubtle: '#ddf4ff',
  sevInfo: '#59636e',
  sevInfoSubtle: '#eef1f5',
}

/** 暗色：随系统切换，与浅色共用同一套语义名。 */
export const paletteDark: Palette = {
  canvas: '#0d1117',
  surface: '#161b22',
  surfaceSubtle: '#21262d',
  surfaceMuted: '#1c2128',
  border: '#30363d',
  borderMuted: '#21262d',
  text: '#e6edf3',
  textMuted: '#8b949e',
  textSubtle: '#6e7681',
  accent: '#4493f8',
  accentSubtle: '#121d2f',
  success: '#3fb950',
  successSubtle: '#12261e',
  attention: '#d29922',
  attentionSubtle: '#272115',
  danger: '#f85149',
  dangerSubtle: '#25171c',
  info: '#4493f8',
  infoSubtle: '#121d2f',
  sevCritical: '#f85149',
  sevCriticalSubtle: '#25171c',
  sevHigh: '#f0883e',
  sevHighSubtle: '#2a1c10',
  sevMedium: '#d29922',
  sevMediumSubtle: '#272115',
  sevLow: '#4493f8',
  sevLowSubtle: '#121d2f',
  sevInfo: '#8b949e',
  sevInfoSubtle: '#21262d',
}

/** 颜色引用：组件写这些，永远拿到 `var(--color-xxx)`，自动跟随主题。 */
export const color = Object.fromEntries(
  Object.keys(paletteLight).map((k) => {
    const varName = '--color-' + k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
    return [k, `var(${varName})`]
  }),
) as { [K in keyof Palette]: string }

/** 把调色板写进 :root，使 CSS 与 antd 共用同一事实源。 */
export function applyPalette(p: Palette): void {
  const root = document.documentElement
  for (const [k, v] of Object.entries(p)) {
    const varName = '--color-' + k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
    root.style.setProperty(varName, v)
  }
}

export type ThemeMode = 'light' | 'dark'

export function currentThemeMode(): ThemeMode {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function paletteFor(mode: ThemeMode): Palette {
  return mode === 'dark' ? paletteDark : paletteLight
}

/** 便捷聚合导出：页面里 `import { t } from '../theme/tokens'` 一次性拿标尺+颜色。 */
export const t = {
  font,
  weight,
  space,
  radius,
  line,
  motion,
  shadow,
  color,
  fontMono,
  fontSans,
} as const
