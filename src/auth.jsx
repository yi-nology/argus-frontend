import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, getCachedUser, setCachedUser, setToken, getToken } from './api'

const AuthCtx = createContext(null)

/** 权限位来自 GET /auth/me 的 permissions 投影（服务端下发，前端不自造）。 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(getCachedUser())
  const [loading, setLoading] = useState(!!getToken())

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      setCachedUser(null)
      return null
    }
    setLoading(true)
    try {
      const me = await api.me()
      setUser(me)
      setCachedUser(me)
      return me
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        setToken('')
        setUser(null)
        setCachedUser(null)
      }
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (getToken()) refresh()
    else setLoading(false)
  }, [refresh])

  const login = useCallback(async (username, password) => {
    const res = await api.login(username, password)
    setToken(res.token)
    setCachedUser(res)
    setUser({
      username: res.username,
      role: res.role,
      scope: res.scope,
      permissions: null,
    })
    // 拉完整权限投影
    refresh()
    return res
  }, [refresh])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      /* 忽略：本地清理优先 */
    }
    setToken('')
    setUser(null)
    setCachedUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refresh,
      can: (key) => !!(user?.permissions && user.permissions[key]),
      scope: user?.scope || '',
    }),
    [user, loading, login, logout, refresh],
  )

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  return useContext(AuthCtx)
}
