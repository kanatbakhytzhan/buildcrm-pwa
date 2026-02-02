import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from './AuthContext'
import { login as apiLogin, setUnauthorizedHandler } from '../services/api'
import { clearToken, getToken, setToken } from '../services/auth'

const IS_ADMIN_KEY = 'buildcrm_is_admin'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate()
  const [tokenState, setTokenState] = useState<string | null>(() => getToken())
  const [isAdmin, setIsAdmin] = useState<boolean>(
    () => typeof window !== 'undefined' && localStorage.getItem(IS_ADMIN_KEY) === '1',
  )
  const [authMessage, setAuthMessage] = useState<string | null>(null)

  const logout = useCallback((message?: string) => {
    clearToken()
    setTokenState(null)
    setIsAdmin(false)
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
      authMessage,
      login,
      logout,
      clearMessage: () => setAuthMessage(null),
    }),
    [tokenState, isAdmin, authMessage, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
