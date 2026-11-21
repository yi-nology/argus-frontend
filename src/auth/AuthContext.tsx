import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  api,
  getCachedUser,
  getToken,
  setCachedUser,
  setToken,
  type Me,
  type PermissionBits,
} from '../api/client'

interface AuthCtx {
  user: Me | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  can: (key: keyof PermissionBits) => boolean
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(getCachedUser())
  const [loading, setLoading] = useState(!!getToken())

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      setCachedUser(null)
      return
    }
    setLoading(true)
    try {
      const me = await api.me()
      setUser(me)
      setCachedUser(me)
    } catch {
      setToken('')
      setUser(null)
      setCachedUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await api.login(username, password)
      setToken(res.token)
      setUser({ username: res.username, role: res.role, scope: res.scope })
      setCachedUser({ username: res.username, role: res.role, scope: res.scope })
      void refresh()
    },
    [refresh],
  )

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      /* 本地清理优先 */
    }
    setToken('')
    setUser(null)
    setCachedUser(null)
  }, [])

  const can = useCallback(
    (key: keyof PermissionBits) => !!(user?.permissions && user.permissions[key]),
    [user],
  )

  const value = useMemo(() => ({ user, loading, login, logout, refresh, can }), [user, loading, login, logout, refresh, can])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used within AuthProvider')
  return v
}
