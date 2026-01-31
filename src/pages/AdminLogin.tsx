import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'

const AdminLogin = () => {
  const { login: authLogin, authMessage, clearMessage } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('loading')
    setError(null)
    clearMessage()
    try {
      await authLogin(email.trim(), password, { redirectTo: '/admin/users' })
    } catch (err) {
      const apiError = err as { status?: number; message?: string }
      if (apiError?.status === 401) {
        setError('Неверный логин или пароль')
      } else if (err instanceof TypeError) {
        setError('Ошибка сети')
      } else {
        setError(apiError?.message || 'Не удалось выполнить вход')
      }
      setStatus('error')
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-icon">
            <img className="login-logo" src="/buildCRM.png" alt="BuildCRM" />
          </div>
          <div className="login-title">BuildCRM Admin</div>
          <div className="login-subtitle">
            Войдите, чтобы управлять пользователями
          </div>
        </div>
        {authMessage && <div className="alert">{authMessage}</div>}
        <form onSubmit={handleSubmit} className="form-grid">
          <label className="field">
            <span className="field-label">Email</span>
            <input
              className="field-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@company.ru"
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Пароль</span>
            <input
              className="field-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Введите пароль"
              required
            />
          </label>
          <button
            className="primary-button"
            type="submit"
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Входим...' : 'Войти'}
          </button>
          {error && <div className="error-text">{error}</div>}
        </form>
      </div>
    </div>
  )
}

export default AdminLogin
