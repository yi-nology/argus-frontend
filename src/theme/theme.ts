/**
 * Argus 暗色科技风主题（antd v6 token + 自定义 CSS 变量）。
 * 炫酷纪律：渐变只用于强调（主按钮/统计卡描边），大面积仍是深空底色，
 * 保证数据可读性优先于装饰。
 */
import type { ThemeConfig } from 'antd'

export const palette = {
  bg: '#070b14',
  bgElevated: '#0d1424',
  bgGlass: 'rgba(18, 28, 48, 0.72)',
  border: 'rgba(88, 148, 255, 0.16)',
  cyan: '#22d3ee',
  violet: '#8b5cf6',
  emerald: '#34d399',
  amber: '#fbbf24',
  rose: '#fb7185',
  text: '#e8eefc',
  text2: '#93a4c3',
  text3: '#5c6f92',
  gradient: 'linear-gradient(135deg, #22d3ee 0%, #8b5cf6 55%, #d946ef 100%)',
  gradientSoft: 'linear-gradient(135deg, rgba(34,211,238,.18), rgba(139,92,246,.18))',
}

export const antdTheme: ThemeConfig = {
  algorithm: undefined, // 自定义 token 覆盖，保持 dark 全量控制
  token: {
    colorPrimary: palette.cyan,
    colorSuccess: palette.emerald,
    colorWarning: palette.amber,
    colorError: palette.rose,
    colorInfo: palette.violet,
    colorBgBase: palette.bg,
    colorBgContainer: palette.bgElevated,
    colorBgElevated: '#121c30',
    colorBgLayout: palette.bg,
    colorBorder: palette.border,
    colorBorderSecondary: 'rgba(88,148,255,0.1)',
    colorText: palette.text,
    colorTextSecondary: palette.text2,
    colorTextTertiary: palette.text3,
    borderRadius: 10,
    fontFamily:
      "'Space Grotesk', system-ui, -apple-system, 'PingFang SC', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif",
    // 暗色下阴影过重会脏，统一压扁
    boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
    boxShadowSecondary: '0 4px 16px rgba(0,0,0,0.25)',
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
      darkItemSelectedBg: 'rgba(34,211,238,0.12)',
      darkItemSelectedColor: palette.cyan,
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
      headerBg: 'rgba(34,211,238,0.06)',
      headerColor: palette.text2,
      rowHoverBg: 'rgba(34,211,238,0.06)',
      borderColor: palette.border,
    },
    Button: {
      primaryShadow: '0 0 24px rgba(34,211,238,0.35)',
      defaultBg: 'rgba(34,211,238,0.08)',
      defaultBorderColor: palette.border,
      defaultColor: palette.text,
    },
    Tag: {
      defaultBg: 'rgba(34,211,238,0.1)',
      defaultColor: palette.cyan,
    },
    Input: {
      activeShadow: '0 0 0 2px rgba(34,211,238,0.18)',
    },
    Select: {
      activeOutlineColor: 'rgba(34,211,238,0.3)',
    },
    Spin: {
      colorPrimary: palette.cyan,
    },
    Segmented: {
      itemSelectedBg: 'rgba(34,211,238,0.15)',
    },
  },
}

export const monoFont = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace"
