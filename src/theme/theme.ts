/**
 * antd v6 主题配置：从 tokens 的调色板派生，浅/深双主题共用同一套语义名。
 * 装饰性效果（渐变 / 光晕 / 毛玻璃）一律不进主题；阴影仅浮层使用。
 */
import { theme } from 'antd'
import type { ThemeConfig } from 'antd'
import { fontSans, paletteDark, paletteLight, shadow, type Palette, type ThemeMode } from './tokens'

function buildTheme(p: Palette, mode: ThemeMode): ThemeConfig {
  return {
    // 必须用 algorithm：只覆盖 token 会漏掉派生色（placeholder、Alert 背景、
    // Menu 文本、Popconfirm 等仍是另一套主题 → 白底浅字/深底深字看不清）。
    algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: p.accent,
      colorSuccess: p.success,
      colorWarning: p.attention,
      colorError: p.danger,
      colorInfo: p.info,
      colorBgBase: p.canvas,
      colorBgContainer: p.surface,
      colorBgElevated: p.surface,
      colorBgLayout: p.canvas,
      colorBgSpotlight: p.surfaceSubtle,
      colorBorder: p.border,
      colorBorderSecondary: p.borderMuted,
      colorText: p.text,
      colorTextSecondary: p.textMuted,
      colorTextTertiary: p.textSubtle,
      colorTextQuaternary: p.textSubtle,
      colorFillTertiary: p.surfaceSubtle,
      borderRadius: 6,
      borderRadiusLG: 8,
      borderRadiusSM: 4,
      fontFamily: fontSans,
      // 阴影只留给浮层；卡片靠 1px 边框分层，不做「发光」。
      boxShadow: shadow.sm,
      boxShadowSecondary: shadow.xs,
      controlHeight: 32,
      controlHeightSM: 24,
      controlHeightLG: 36,
      motionDurationFast: '0.12s',
      motionDurationMid: '0.18s',
      motionDurationSlow: '0.24s',
    },
    components: {
      Layout: {
        bodyBg: p.canvas,
        headerBg: p.surface,
        siderBg: p.surface,
      },
      Menu: {
        itemBg: 'transparent',
        subMenuItemBg: 'transparent',
        itemSelectedBg: p.accentSubtle,
        itemSelectedColor: p.accent,
        itemColor: p.textMuted,
        itemHoverBg: p.surfaceMuted,
        itemHoverColor: p.text,
        itemBorderRadius: 6,
        itemMarginInline: 8,
        itemHeight: 34,
      },
      Card: {
        colorBgContainer: p.surface,
        colorBorderSecondary: p.borderMuted,
        headerBg: p.surface,
        headerFontSize: 14,
      },
      Table: {
        colorBgContainer: p.surface,
        headerBg: p.surfaceSubtle,
        headerColor: p.textMuted,
        rowHoverBg: p.surfaceMuted,
        rowSelectedBg: p.accentSubtle,
        borderColor: p.borderMuted,
        headerSplitColor: p.borderMuted,
      },
      Button: {
        primaryShadow: 'none',
        defaultBg: p.surface,
        defaultBorderColor: p.border,
        defaultColor: p.text,
        fontWeight: 500,
      },
      Tag: {
        defaultBg: p.surfaceSubtle,
        defaultColor: p.textMuted,
      },
      Input: {
        activeShadow: `0 0 0 2px ${p.accentSubtle}`,
        activeBorderColor: p.accent,
      },
      Select: {
        activeOutlineColor: p.accentSubtle,
        optionSelectedBg: p.accentSubtle,
      },
      Segmented: {
        itemSelectedBg: p.surface,
        itemSelectedColor: p.text,
        trackBg: p.surfaceSubtle,
      },
      Spin: {
        colorPrimary: p.accent,
      },
      Alert: {
        colorInfoBg: p.infoSubtle,
        colorSuccessBg: p.successSubtle,
        colorWarningBg: p.attentionSubtle,
        colorErrorBg: p.dangerSubtle,
      },
      Descriptions: {
        labelBg: p.surfaceSubtle,
      },
      Modal: {
        contentBg: p.surface,
        headerBg: p.surface,
      },
      Tooltip: {
        colorBgSpotlight: p.text,
        colorTextLightSolid: p.surface,
      },
    },
  }
}

export const lightTheme = buildTheme(paletteLight, 'light')
export const darkTheme = buildTheme(paletteDark, 'dark')

export function themeFor(mode: ThemeMode): ThemeConfig {
  return mode === 'dark' ? darkTheme : lightTheme
}
