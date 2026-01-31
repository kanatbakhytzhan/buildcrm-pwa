import { useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { checkApiHealth } from '../services/api'
import { BASE_URL, isDebugMode } from '../config/appConfig'

const Login = () => {
  const { login: authLogin, authMessage, clearMessage } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [healthStatus, setHealthStatus] = useState<string | null>(null)
  const [checkingHealth, setCheckingHealth] = useState(false)

  const handleCheckHealth = async () => {
    setCheckingHealth(true)
    setHealthStatus(null)
    const result = await checkApiHealth()
    setHealthStatus(result.ok ? `✓ ${result.message}` : `✗ ${result.message}`)
    setCheckingHealth(false)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('loading')
    setError(null)
    clearMessage()
    try {
      await authLogin(email.trim(), password)
      localStorage.setItem('buildcrm_profile_email', email.trim())
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
          <div className="login-title">BuildCRM</div>
          <div className="login-subtitle">Войдите в ваш рабочий кабинет</div>
        </div>
        {authMessage && <div className="alert">{authMessage}</div>}
        <form onSubmit={handleSubmit} className="form-grid">
          <label className="field">
            <span className="field-label">Электронная почта</span>
            <input
              className="field-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Пароль</span>
            <div className="field-wrap">
              <input
                className="field-input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Введите пароль"
                required
              />
              <button
                type="button"
                className="field-toggle-visibility"
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
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
        <div className="login-hint">
          <span>Нет аккаунта?</span>
          <a
            className="login-hint-link"
            href="https://wa.me/77768776637"
            target="_blank"
            rel="noreferrer"
          >
            Свяжитесь с нами
          </a>
        </div>
        {isDebugMode() && (
          <div className="login-debug">
            <button
              type="button"
              className="login-debug-btn"
              onClick={handleCheckHealth}
              disabled={checkingHealth}
            >
              {checkingHealth ? 'Проверка...' : 'Проверить API'}
            </button>
            <div className="login-debug-info">API: {BASE_URL}</div>
            {healthStatus && (
              <div className={`login-debug-result ${healthStatus.startsWith('✓') ? 'ok' : 'fail'}`}>
                {healthStatus}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Login
