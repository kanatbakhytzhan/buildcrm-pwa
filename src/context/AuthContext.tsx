import { createContext, useContext } from 'react'

export type AuthContextValue = {
  token: string | null
  isAuthenticated: boolean
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
