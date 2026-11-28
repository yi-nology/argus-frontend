import { App as AntApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { XProvider } from '@ant-design/x'
import type { ReactNode } from 'react'
import { AuthProvider } from './auth/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import { themeFor } from './theme/theme'
import { useThemeMode } from './theme/useThemeMode'
import './theme/global.css'

/**
 * 全局 Provider 栈（Umi rootContainer）：主题 → antd App → XProvider → 错误边界 → 会话。
 * 主题模式是运行时状态（跟随系统 prefers-color-scheme），所以包一层组件用 hook。
 * XProvider 让 @ant-design/x 组件（Bubble/Sender/ThoughtChain…）继承 antd 主题变量。
 */
function Providers({ children }: { children: ReactNode }) {
  const mode = useThemeMode()
  return (
    <ConfigProvider theme={themeFor(mode)} locale={zhCN}>
      <AntApp>
        <XProvider>
          <ErrorBoundary area="Argus 工作台">
            <AuthProvider>{children}</AuthProvider>
          </ErrorBoundary>
        </XProvider>
      </AntApp>
    </ConfigProvider>
  )
}

export function rootContainer(container: React.ReactNode) {
  return <Providers>{container}</Providers>
}
