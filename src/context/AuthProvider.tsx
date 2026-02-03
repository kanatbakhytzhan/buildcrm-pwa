import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from './AuthContext'
import type { UserRole } from './AuthContext'
import { getMe, login as apiLogin, setUnauthorizedHandler } from '../services/api'
import { clearToken, getToken, setToken } from '../services/auth'

const IS_ADMIN_KEY = 'buildcrm_is_admin'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate()
  const [tokenState, setTokenState] = useState<string | null>(() => getToken())
  const [isAdmin, setIsAdmin] = useState<boolean>(
    () => typeof window !== 'undefined' && localStorage.getItem(IS_ADMIN_KEY) === '1',
  )
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [tenantId, setTenantId] = useState<string | number | null>(null)
  const [userId, setUserId] = useState<string | number | null>(null)
  const [authMessage, setAuthMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!tokenState) {
      setUserRole(null)
      setTenantId(null)
      setUserId(null)
      return
    }
    getMe()
      .then((me) => {
        if (me?.role) setUserRole(me.role as UserRole)
        if (me?.tenant_id != null) setTenantId(me.tenant_id)
        if (me?.id != null) setUserId(me.id)
      })
      .catch(() => {
        setUserRole(null)
        setTenantId(null)
        setUserId(null)
      })
  }, [tokenState])

  const logout = useCallback((message?: string) => {
    clearToken()
    setTokenState(null)
    setIsAdmin(false)
    setUserRole(null)
    setTenantId(null)
    setUserId(null)
    try {
      localStorage.removeItem(IS_ADMIN_KEY)
    } catch {
      // ignore
    }
    if (message) {
      setAuthMessage(message)
    }
    navigate('/login', { replace: true })
  }, [navigate])

  const login = useCallback(async (
    email: string,
    password: string,
    options?: { redirectTo?: string },
  ) => {
    const token = await apiLogin(email, password)
    setToken(token)
    setTokenState(token)
    setAuthMessage(null)
    const admin = Boolean(options?.redirectTo?.startsWith('/admin'))
    setIsAdmin(admin)
    try {
      localStorage.setItem(IS_ADMIN_KEY, admin ? '1' : '0')
    } catch {
      // ignore
    }
    navigate(options?.redirectTo ?? '/leads', { replace: true })
  }, [navigate])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout('Сессия истекла. Войдите снова.')
    })
  }, [logout])

  const value = useMemo(
    () => ({
      token: tokenState,
      isAuthenticated: Boolean(tokenState),
      isAdmin,
      userRole,
      tenantId,
      userId,
      authMessage,
      login,
      logout,
      clearMessage: () => setAuthMessage(null),
    }),
    [tokenState, isAdmin, userRole, tenantId, userId, authMessage, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
