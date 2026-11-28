/**
 * 平台词表（前端单一事实源）。
 * 必须与后端 internal/config.SupportedPlatforms 保持一字不差——词表漂移会让
 * 前端把「装配了但没列出」的平台藏起来、或把「没装配」的平台当可选项
 * （v8.5.0 修复：仓库设置页曾用 bitbucket/azure-devops/tencentcode 错误词表）。
 */
export const PLATFORMS = [
  'gitea',
  'forgejo',
  'github',
  'gitlab',
  'gitee',
  'gitcode',
  'tencent_code',
] as const

export type Platform = (typeof PLATFORMS)[number]
