import { useState, type ReactNode } from 'react'
import { Button, Result, Spin } from 'antd'
import { Navigate, useLocation } from '@umijs/max'
import { useAuth } from '../auth/AuthContext'
import { getToken } from '../api/client'
import AppLayout from '../components/AppLayout'

/** 全屏居中容器（登录校验期间 / 会话异常时占满视口）。 */
function Fullscreen({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      {children}
    </div>
  )
}

/**
 * 控制台布局：会话门 + 应用外壳（AppLayout 内渲染 <Outlet/>）。
 *
 * 会话语义：有 token 却取不到用户 = 校验接口瞬时故障（429/5xx/网络抖动），
 * 不踢下线——给重试；只有彻底没 token 才走登录页。
 */
export default function ConsoleLayout() {
  const { user, loading, refresh } = useAuth()
  const loc = useLocation()
  const [retrying, setRetrying] = useState(false)

  if (loading) {
    return (
      <Fullscreen>
        <Spin />
      </Fullscreen>
    )
  }
  if (!user) {
    if (getToken()) {
      return (
        <Fullscreen>
          <Result
            status="warning"
            title="暂时无法校验会话"
            subTitle="服务端限流或暂时不可达，已保留你的登录态。稍后重试即可。"
            extra={
              <Button
                type="primary"
                loading={retrying}
                onClick={() => {
                  setRetrying(true)
                  void refresh().finally(() => setRetrying(false))
                }}
              >
                重试
              </Button>
            }
          />
        </Fullscreen>
      )
    }
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  }
  return <AppLayout />
}
