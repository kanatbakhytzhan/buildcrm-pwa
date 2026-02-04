import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  createAdminUser,
  getAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
  type AdminUser,
} from '../services/api'
import { formatLeadBadge } from '../utils/dateFormat'

const AdminUsers = () => {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Modals
  const [createOpen, setCreateOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetResultOpen, setResetResultOpen] = useState(false)
  const [tempPassword, setTempPassword] = useState('')
  const [activeUser, setActiveUser] = useState<AdminUser | null>(null)
  const [busyUserId, setBusyUserId] = useState<string | number | null>(null)
  const [actionStatus, setActionStatus] = useState<'idle' | 'loading'>('idle')
  const [actionError, setActionError] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    companyName: '',
  })

  // Filters
  const [filterActive, setFilterActive] = useState<string>('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const loadUsers = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const data = await getAdminUsers()
      setUsers(Array.isArray(data) ? data : [])
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

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (filterActive === 'active' && !u.is_active) return false
      if (filterActive === 'inactive' && u.is_active) return false
      return true
    })
  }, [users, filterActive])

  const closeCreate = () => {
    setCreateOpen(false)
    setCreateForm({ email: '', password: '', companyName: '' })
    setActionError(null)
  }

  const closeReset = () => {
    setResetOpen(false)
    setActiveUser(null)
    setActionError(null)
  }

  const closeResetResult = () => {
    setResetResultOpen(false)
    setTempPassword('')
    setActiveUser(null)
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
      showToast('Пользователь создан ✅')
      await loadUsers()
    } catch (err) {
      const apiError = err as { status?: number; message?: string }
      setActionError(apiError?.message || 'Не удалось создать пользователя')
    } finally {
      setActionStatus('idle')
    }
  }

  const handleResetConfirm = async () => {
    if (!activeUser) return
    setActionStatus('loading')
    setActionError(null)
    try {
      const { temporary_password } = await resetAdminUserPassword(activeUser.id)
      closeReset()
      setTempPassword(temporary_password)
      setResetResultOpen(true)
    } catch (err) {
      const apiError = err as { status?: number; message?: string }
      setActionError(apiError?.message || 'Не удалось сбросить пароль')
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
        prev.map((item) => (item.id === user.id ? { ...item, is_active: !item.is_active } : item))
      )
      showToast(user.is_active ? 'Пользователь деактивирован' : 'Пользователь активирован ✅')
    } catch (err) {
      const apiError = err as { status?: number; message?: string }
      setError(apiError?.message || 'Не удалось обновить статус')
    } finally {
      setBusyUserId(null)
    }
  }

  const handleOpenReset = (user: AdminUser) => {
    setActiveUser(user)
    setResetOpen(true)
    setActionError(null)
  }

  // Escape key handling
  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (resetResultOpen) closeResetResult()
        else if (resetOpen) closeReset()
        else if (createOpen) closeCreate()
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [createOpen, resetOpen, resetResultOpen])

  return (
    <div className="admin-content-wrapper">
      <div className="admin-header">
        <div>
          <h1 className="admin-title">Пользователи</h1>
          <p style={{ color: 'var(--admin-text-secondary)', marginTop: 4 }}>
            {status === 'loading' ? 'Загрузка...' : `Всего: ${users.length}`}
          </p>
        </div>
        <div className="admin-btn-group">
          <button className="admin-btn admin-btn--primary" type="button" onClick={() => setCreateOpen(true)}>
            + Создать пользователя
          </button>
          <button
            className="admin-btn admin-btn--secondary"
            type="button"
            onClick={loadUsers}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Загрузка...' : '🔄 Обновить'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-filters">
        <select
          className="admin-input admin-input--filter"
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
        >
          <option value="">Все статусы</option>
          <option value="active">Активные</option>
          <option value="inactive">Неактивные</option>
        </select>
      </div>

      {error && <div className="admin-alert admin-alert--error">{error}</div>}

      {status === 'loading' && (
        <div className="admin-loading-panel">
          <div className="admin-spinner" />
          <p>Загрузка пользователей...</p>
        </div>
      )}

      {!error && status !== 'loading' && filteredUsers.length === 0 && (
        <div className="admin-empty">
          {users.length === 0 ? 'Пользователей пока нет' : 'Нет пользователей по фильтру'}
        </div>
      )}

      {!error && filteredUsers.length > 0 && (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Компания</th>
                <th>Статус</th>
                <th>Создан</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td className="admin-table-name">{user.email}</td>
                  <td>{user.company_name || '—'}</td>
                  <td>
                    <span className={`admin-badge ${user.is_active ? 'admin-badge--ok' : 'admin-badge--off'}`}>
                      {user.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                  </td>
                  <td className="admin-table-date">{formatLeadBadge(user.created_at)}</td>
                  <td className="admin-table-actions">
                    <button className="admin-btn admin-btn--sm" type="button" onClick={() => handleOpenReset(user)}>
                      Сбросить пароль
                    </button>
                    <button
                      className={`admin-btn admin-btn--sm ${user.is_active ? 'admin-btn--ghost' : 'admin-btn--accent'}`}
                      type="button"
                      onClick={() => handleToggleActive(user)}
                      disabled={busyUserId === user.id}
                    >
                      {busyUserId === user.id ? '...' : user.is_active ? 'Деактивировать' : 'Активировать'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="admin-toast">{toast}</div>}

      {/* Create User Modal */}
      {createOpen && (
        <div className="admin-modal-overlay" onClick={closeCreate}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Создать пользователя</h2>
              <button className="admin-modal-close" type="button" onClick={closeCreate}>
                ×
              </button>
            </div>
            <div className="admin-modal-body">
              <form className="admin-settings-section" onSubmit={handleCreateSubmit}>
                <div className="admin-settings-block">
                  <label className="admin-label">Email</label>
                  <input
                    className="admin-input"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="client@company.ru"
                    required
                  />
                </div>
                <div className="admin-settings-block">
                  <label className="admin-label">Пароль</label>
                  <input
                    className="admin-input"
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Введите пароль"
                    required
                  />
                </div>
                <div className="admin-settings-block">
                  <label className="admin-label">Компания (опционально)</label>
                  <input
                    className="admin-input"
                    type="text"
                    value={createForm.companyName}
                    onChange={(e) => setCreateForm((p) => ({ ...p, companyName: e.target.value }))}
                    placeholder="Название компании"
                  />
                </div>
                {actionError && <div className="admin-alert admin-alert--error">{actionError}</div>}
                <div className="admin-modal-footer">
                  <button className="admin-btn admin-btn--ghost" type="button" onClick={closeCreate}>
                    Отмена
                  </button>
                  <button className="admin-btn admin-btn--primary" type="submit" disabled={actionStatus === 'loading'}>
                    {actionStatus === 'loading' ? 'Создание...' : 'Создать'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Confirmation Modal */}
      {resetOpen && activeUser && (
        <div className="admin-modal-overlay" onClick={closeReset}>
          <div className="admin-modal admin-modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Сбросить пароль</h2>
              <button className="admin-modal-close" type="button" onClick={closeReset}>
                ×
              </button>
            </div>
            <div className="admin-modal-body">
              <p className="admin-modal-text">Сгенерировать временный пароль для {activeUser.email}?</p>
              {actionError && <div className="admin-alert admin-alert--error">{actionError}</div>}
              <div className="admin-modal-footer">
                <button className="admin-btn admin-btn--ghost" type="button" onClick={closeReset}>
                  Отмена
                </button>
                <button
                  className="admin-btn admin-btn--primary"
                  type="button"
                  onClick={handleResetConfirm}
                  disabled={actionStatus === 'loading'}
                >
                  {actionStatus === 'loading' ? 'Сброс...' : 'Сбросить пароль'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Temp Password Result Modal */}
      {resetResultOpen && tempPassword && (
        <div className="admin-modal-overlay" onClick={closeResetResult}>
          <div className="admin-modal admin-modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Временный пароль</h2>
              <button className="admin-modal-close" type="button" onClick={closeResetResult}>
                ×
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-alert admin-alert--warn">
                ⚠️ Сохраните пароль сейчас — потом он не будет показан!
              </div>
              <div className="admin-temp-password">
                <code className="admin-temp-password-value">{tempPassword}</code>
                <button
                  className="admin-btn admin-btn--secondary"
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(tempPassword).catch(() => { })
                    showToast('Пароль скопирован')
                  }}
                >
                  📋 Копировать
                </button>
              </div>
              <div className="admin-modal-footer">
                <button className="admin-btn admin-btn--primary" type="button" onClick={closeResetResult}>
                  Готово
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminUsers
