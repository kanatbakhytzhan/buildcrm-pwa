import { createContext, useContext } from 'react'

export type UserRole = 'admin' | 'owner' | 'rop' | 'manager'

export type AuthContextValue = {
  token: string | null
  isAuthenticated: boolean
  /** True when user logged in via /admin/login (redirectTo /admin/*) */
  isAdmin: boolean
  /** From GET /api/me — owner/rop see all + assign; manager only own leads */
  userRole: UserRole | null
  tenantId: string | number | null
  userId: string | number | null
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
