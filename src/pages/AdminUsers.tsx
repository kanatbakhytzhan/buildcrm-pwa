import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  createAdminUser,
  getAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
  type AdminUser,
} from '../services/api'
import { formatLeadBadge } from '../utils/dateFormat'

const AdminUsers = () => {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [activeUser, setActiveUser] = useState<AdminUser | null>(null)
  const [busyUserId, setBusyUserId] = useState<string | number | null>(null)
  const [actionStatus, setActionStatus] = useState<'idle' | 'loading'>('idle')
  const [actionError, setActionError] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    companyName: '',
  })
  const [resetPassword, setResetPassword] = useState('')

  const loadUsers = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const data = await getAdminUsers()
      setUsers(data)
      setStatus('idle')
    } catch (err) {
      const apiError = err as { status?: number; message?: string }
      if (apiError?.status === 403) {
        setError('Нет доступа. Нужен администратор.')
      } else if (err instanceof TypeError) {
        setError('Ошибка сети')
      } else {
        setError(apiError?.message || 'Не удалось загрузить пользователей')
      }
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const usersCountLabel = useMemo(() => {
    if (status === 'loading') {
      return 'Загрузка пользователей...'
    }
    return `Пользователей: ${users.length}`
  }, [status, users.length])

  const closeCreate = () => {
    setCreateOpen(false)
    setCreateForm({ email: '', password: '', companyName: '' })
    setActionError(null)
  }

  const closeReset = () => {
    setResetOpen(false)
    setActiveUser(null)
    setResetPassword('')
    setActionError(null)
  }

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActionStatus('loading')
    setActionError(null)
    try {
      await createAdminUser({
        email: createForm.email.trim(),
        password: createForm.password,
        company_name: createForm.companyName.trim() || undefined,
      })
      closeCreate()
      await loadUsers()
    } catch (err) {
      const apiError = err as { status?: number; message?: string }
      if (err instanceof TypeError) {
        setActionError('Ошибка сети')
      } else {
        setActionError(apiError?.message || 'Не удалось создать пользователя')
      }
    } finally {
      setActionStatus('idle')
    }
  }

  const handleResetSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeUser) {
      return
    }
    setActionStatus('loading')
    setActionError(null)
    try {
      await resetAdminUserPassword(activeUser.id, resetPassword)
      closeReset()
    } catch (err) {
      const apiError = err as { status?: number; message?: string }
      if (err instanceof TypeError) {
        setActionError('Ошибка сети')
      } else {
        setActionError(apiError?.message || 'Не удалось обновить пароль')
      }
    } finally {
      setActionStatus('idle')
    }
  }

  const handleToggleActive = async (user: AdminUser) => {
    setBusyUserId(user.id)
    setError(null)
    try {
      await updateAdminUser(user.id, { is_active: !user.is_active })
      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id ? { ...item, is_active: !item.is_active } : item,
        ),
      )
    } catch (err) {
      const apiError = err as { status?: number; message?: string }
      if (err instanceof TypeError) {
        setError('Ошибка сети')
      } else {
        setError(apiError?.message || 'Не удалось обновить статус')
      }
    } finally {
      setBusyUserId(null)
    }
  }

  const handleOpenReset = (user: AdminUser) => {
    setActiveUser(user)
    setResetPassword('')
    setResetOpen(true)
    setActionError(null)
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div className="page-header__text">
          <h1 className="title">Админка</h1>
          <p className="subtitle">Пользователи CRM</p>
        </div>
        <div className="action-card">
          <button
            className="primary-button"
            type="button"
            onClick={() => setCreateOpen(true)}
          >
            Создать пользователя
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={loadUsers}
            disabled={status === 'loading'}
          >
            Обновить
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              logout()
              navigate('/admin/login')
            }}
          >
            Выйти
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">{usersCountLabel}</div>
        {error && <div className="error-text">{error}</div>}
      </div>

      {!error && users.length === 0 && status !== 'loading' && (
        <div className="card">
          <div className="info-text">Пользователей пока нет</div>
        </div>
      )}

      {!error &&
        users.map((user) => (
          <div className="card" key={user.id}>
            <div className="toggle-row">
              <div>
                <div className="toggle-title">{user.email}</div>
                <div className="toggle-subtitle">
                  {user.company_name || 'Компания не указана'}
                </div>
                <div className="info-text">
                  Создан: {formatLeadBadge(user.created_at)}
                </div>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => handleOpenReset(user)}
              >
                Сбросить пароль
              </button>
            </div>
            <div className="toggle-row">
              <div className="info-text">
                Статус: {user.is_active ? 'Активен' : 'Неактивен'}
              </div>
              <button
                className="ghost-button"
                type="button"
                onClick={() => handleToggleActive(user)}
                disabled={busyUserId === user.id}
              >
                {user.is_active ? 'Сделать неактивным' : 'Сделать активным'}
              </button>
            </div>
          </div>
        ))}

      {createOpen && (
        <div className="dialog-backdrop">
          <div className="dialog">
            <div className="dialog-title">Создать пользователя</div>
            <form className="form-grid" onSubmit={handleCreateSubmit}>
              <label className="field">
                <span className="field-label">Email</span>
                <input
                  className="field-input"
                  type="email"
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                  placeholder="client@company.ru"
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Пароль</span>
                <input
                  className="field-input"
                  type="password"
                  value={createForm.password}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Введите пароль"
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Компания</span>
                <input
                  className="field-input"
                  type="text"
                  value={createForm.companyName}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      companyName: event.target.value,
                    }))
                  }
                  placeholder="Название компании"
                />
              </label>
              {actionError && <div className="error-text">{actionError}</div>}
              <div className="dialog-actions">
                <button className="ghost-button" type="button" onClick={closeCreate}>
                  Отмена
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={actionStatus === 'loading'}
                >
                  {actionStatus === 'loading' ? 'Создаю...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetOpen && activeUser && (
        <div className="dialog-backdrop">
          <div className="dialog">
            <div className="dialog-title">Сбросить пароль</div>
            <div className="dialog-text">{activeUser.email}</div>
            <form className="form-grid" onSubmit={handleResetSubmit}>
              <label className="field">
                <span className="field-label">Новый пароль</span>
                <input
                  className="field-input"
                  type="password"
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  placeholder="Введите новый пароль"
                  required
                />
              </label>
              {actionError && <div className="error-text">{actionError}</div>}
              <div className="dialog-actions">
                <button className="ghost-button" type="button" onClick={closeReset}>
                  Отмена
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={actionStatus === 'loading'}
                >
                  {actionStatus === 'loading' ? 'Сохраняю...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminUsers
