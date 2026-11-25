/**
 * Argus 暗色主题（antd v6 token + 自定义 CSS 变量）。
 * 基调：石墨深底 + 克制的蓝紫强调；渐变/光晕只作极轻点缀，数据可读性优先。
 */
import { theme } from 'antd'
import type { ThemeConfig } from 'antd'

export const palette = {
  bg: '#0b0f16',
  bgElevated: '#121826',
  bgGlass: 'rgba(18, 24, 36, 0.78)',
  border: 'rgba(148, 163, 184, 0.14)',
  cyan: '#5b8def',
  violet: '#8b7cf6',
  emerald: '#34d399',
  amber: '#f0b429',
  rose: '#f07178',
  text: '#e6ebf5',
  text2: '#9aa8bc',
  text3: '#64748b',
  gradient: 'linear-gradient(135deg, #5b8def 0%, #8b7cf6 100%)',
  gradientSoft: 'linear-gradient(135deg, rgba(91,141,239,.14), rgba(139,124,246,.14))',
}

export const antdTheme: ThemeConfig = {
  // 必须用 darkAlgorithm：只覆盖 token 会漏掉派生色（placeholder、Alert info
  // 背景、Menu 文本、Popconfirm 等仍是 light 主题 → 白底浅字/深底深字看不清）。
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: palette.cyan,
    colorSuccess: palette.emerald,
    colorWarning: palette.amber,
    colorError: palette.rose,
    colorInfo: palette.violet,
    colorBgBase: palette.bg,
    colorBgContainer: palette.bgElevated,
    colorBgElevated: '#161d2c',
    colorBgLayout: palette.bg,
    colorBorder: palette.border,
    colorBorderSecondary: 'rgba(148,163,184,0.09)',
    colorText: palette.text,
    colorTextSecondary: palette.text2,
    colorTextTertiary: palette.text3,
    borderRadius: 10,
    fontFamily:
      "'Space Grotesk', system-ui, -apple-system, 'PingFang SC', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif",
    // 暗色下阴影过重会脏，统一压扁
    boxShadow: '0 6px 24px rgba(0,0,0,0.28)',
    boxShadowSecondary: '0 3px 12px rgba(0,0,0,0.22)',
  },
  components: {
    Layout: {
      bodyBg: palette.bg,
      headerBg: 'transparent',
      siderBg: 'transparent',
    },
    Menu: {
      darkItemBg: 'transparent',
      darkSubMenuItemBg: 'transparent',
      darkItemSelectedBg: 'rgba(91,141,239,0.14)',
      darkItemSelectedColor: '#a9c1ff',
      darkItemColor: palette.text2,
      itemBorderRadius: 8,
      itemMarginInline: 8,
    },
    Card: {
      colorBgContainer: palette.bgGlass,
      colorBorderSecondary: palette.border,
    },
    Table: {
      colorBgContainer: 'transparent',
      headerBg: 'rgba(148,163,184,0.06)',
      headerColor: palette.text2,
      rowHoverBg: 'rgba(91,141,239,0.06)',
      borderColor: palette.border,
    },
    Button: {
      primaryShadow: 'none',
      defaultBg: 'rgba(148,163,184,0.06)',
      defaultBorderColor: palette.border,
      defaultColor: palette.text,
    },
    Tag: {
      defaultBg: 'rgba(91,141,239,0.10)',
      defaultColor: '#a9c1ff',
    },
    Input: {
      activeShadow: '0 0 0 2px rgba(91,141,239,0.18)',
    },
    Select: {
      activeOutlineColor: 'rgba(91,141,239,0.28)',
    },
    Spin: {
      colorPrimary: palette.cyan,
    },
    Segmented: {
      itemSelectedBg: 'rgba(91,141,239,0.16)',
      itemSelectedColor: '#c7d6ff',
    },
  },
}

export const monoFont = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace"
