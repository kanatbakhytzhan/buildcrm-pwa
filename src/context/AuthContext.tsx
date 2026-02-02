import { createContext, useContext } from 'react'

export type AuthContextValue = {
  token: string | null
  isAuthenticated: boolean
  /** True when user logged in via /admin/login (redirectTo /admin/*) */
  isAdmin: boolean
  authMessage: string | null
  login: (
    email: string,
    password: string,
    options?: { redirectTo?: string },
  ) => Promise<void>
  logout: (message?: string) => void
  clearMessage: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const useAuth = () => {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('AuthContext not found')
  }
  return value
}
