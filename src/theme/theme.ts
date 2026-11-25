/**
 * Argus 暗色主题（antd v6 token + 自定义 CSS 变量）。
 * 基调：石墨深底 + 单一蓝色强调；无渐变/光晕装饰，数据可读性优先。
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
    borderRadius: 8,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif",
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
      darkItemSelectedColor: '#c7d6ff',
      darkItemColor: palette.text2,
      itemBorderRadius: 6,
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
      defaultBg: 'rgba(148,163,184,0.10)',
      defaultColor: palette.text2,
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