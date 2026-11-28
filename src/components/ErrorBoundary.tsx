/**
 * 路由/区块级错误边界：单个页面或部件抛错不得白屏整个工作台。
 * 错误带 trace 语义（组件栈），便于上报与排障。
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Result } from 'antd'

interface Props {
  children: ReactNode
  /** 出错时的区域名，用于提示文案。 */
  area?: string
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 结构化留痕：组件栈是定位的关键，不用 console.log 淹没。
    console.error('[argus-ui] render error', {
      area: this.props.area || 'unknown',
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    })
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <Result
          status="error"
          title={this.props.area ? `${this.props.area} 渲染失败` : '页面渲染失败'}
          subTitle={
            <span className="meta">
              {this.state.error.message || '未知错误'}
              。刷新页面可重试；若持续出现请携带该提示联系管理员。
            </span>
          }
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              刷新页面
            </Button>
          }
        />
      )
    }
    return this.props.children
  }
}
