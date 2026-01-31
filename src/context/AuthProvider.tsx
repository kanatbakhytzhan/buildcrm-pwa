import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from './AuthContext'
import { login as apiLogin, setUnauthorizedHandler } from '../services/api'
import { clearToken, getToken, setToken } from '../services/auth'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate()
  const [tokenState, setTokenState] = useState<string | null>(() => getToken())
  const [authMessage, setAuthMessage] = useState<string | null>(null)

  const logout = useCallback((message?: string) => {
    clearToken()
    setTokenState(null)
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
      authMessage,
      login,
      logout,
      clearMessage: () => setAuthMessage(null),
    }),
    [tokenState, authMessage, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
