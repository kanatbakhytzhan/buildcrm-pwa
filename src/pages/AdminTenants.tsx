import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  addTenantUser,
  addTenantWhatsapp,
  createAdminTenant,
  deleteTenantWhatsapp,
  getAdminTenants,
  getTenantUsers,
  getTenantWhatsapps,
  updateAdminTenant,
  type AdminTenant,
  type TenantUser,
  type TenantWhatsapp,
} from '../services/api'

const AdminTenants = () => {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [tenants, setTenants] = useState<AdminTenant[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [whatsappOpen, setWhatsappOpen] = useState(false)
  const [usersOpen, setUsersOpen] = useState(false)
  const [activeTenant, setActiveTenant] = useState<AdminTenant | null>(null)

  const [actionStatus, setActionStatus] = useState<'idle' | 'loading'>('idle')
  const [actionError, setActionError] = useState<string | null>(null)

  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    default_owner_user_id: '' as string | number,
    is_active: true,
  })
  const [editForm, setEditForm] = useState({
    name: '',
    slug: '',
    default_owner_user_id: '' as string | number,
    is_active: true,
    ai_prompt: '',
  })

  const [whatsapps, setWhatsapps] = useState<TenantWhatsapp[]>([])
  const [whatsappStatus, setWhatsappStatus] = useState<'idle' | 'loading'>('idle')
  const [deletingAccountId, setDeletingAccountId] = useState<string | number | null>(null)
  const [addWhatsappForm, setAddWhatsappForm] = useState({
    phone_number: '',
    phone_number_id: '',
    verify_token: '',
    waba_id: '',
  })

  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([])
  const [tenantUsersStatus, setTenantUsersStatus] = useState<'idle' | 'loading'>('idle')
  const [addUserForm, setAddUserForm] = useState({ email: '', role: 'manager' as 'manager' | 'admin' })

  const loadTenants = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const data = await getAdminTenants()
      setTenants(data)
      setStatus('idle')
    } catch (err) {
      const apiError = err as { status?: number; message?: string }
      if (apiError?.status === 403) {
        setError('Нет доступа. Нужен администратор.')
      } else if (err instanceof TypeError) {
        setError('Ошибка сети')
      } else {
        setError(apiError?.message || 'Не удалось загрузить клиентов')
      }
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    loadTenants()
  }, [loadTenants])

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (usersOpen) closeUsers()
        else if (whatsappOpen) closeWhatsapp()
        else if (editOpen) closeEdit()
        else if (createOpen) closeCreate()
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [createOpen, editOpen, whatsappOpen, usersOpen])

  const loadWhatsapps = useCallback(
    async (tenantId: string | number) => {
      setWhatsappStatus('loading')
      try {
        const data = await getTenantWhatsapps(tenantId)
        setWhatsapps(data)
      } catch {
        setWhatsapps([])
      } finally {
        setWhatsappStatus('idle')
      }
    },
    [],
  )

  const openWhatsapp = (tenant: AdminTenant) => {
    setActiveTenant(tenant)
    setWhatsappOpen(true)
    setAddWhatsappForm({ phone_number: '', phone_number_id: '', verify_token: '', waba_id: '' })
    loadWhatsapps(tenant.id)
  }

  const closeCreate = () => {
    setCreateOpen(false)
    setCreateForm({ name: '', slug: '', default_owner_user_id: '', is_active: true })
    setActionError(null)
  }

  const openEdit = (tenant: AdminTenant) => {
    setActiveTenant(tenant)
    setEditForm({
      name: tenant.name,
      slug: tenant.slug,
      default_owner_user_id: tenant.default_owner_user_id ?? '',
      is_active: tenant.is_active,
      ai_prompt: tenant.ai_prompt ?? '',
    })
    setEditOpen(true)
    setActionError(null)
  }

  const closeEdit = () => {
    setEditOpen(false)
    setActiveTenant(null)
    setActionError(null)
  }

  const closeWhatsapp = () => {
    setWhatsappOpen(false)
    setActiveTenant(null)
  }

  const loadTenantUsers = useCallback(async (tenantId: string | number) => {
    setTenantUsersStatus('loading')
    try {
      const list = await getTenantUsers(tenantId)
      setTenantUsers(list)
    } catch {
      setTenantUsers([])
    } finally {
      setTenantUsersStatus('idle')
    }
  }, [])

  const openUsers = (tenant: AdminTenant) => {
    setActiveTenant(tenant)
    setUsersOpen(true)
    setAddUserForm({ email: '', role: 'manager' })
    setActionError(null)
    loadTenantUsers(tenant.id)
  }

  const closeUsers = () => {
    setUsersOpen(false)
    setActiveTenant(null)
    setTenantUsers([])
  }

  const handleAddUserSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!activeTenant) return
    setActionStatus('loading')
    setActionError(null)
    try {
      await addTenantUser(activeTenant.id, {
        email: addUserForm.email.trim(),
        role: addUserForm.role,
      })
      setAddUserForm({ email: '', role: 'manager' })
      await loadTenantUsers(activeTenant.id)
    } catch (err) {
      const apiError = err as { status?: number; message?: string }
      setActionError(apiError?.message || 'Не удалось добавить пользователя')
    } finally {
      setActionStatus('idle')
    }
  }

  const handleCreateSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setActionStatus('loading')
    setActionError(null)
    try {
      await createAdminTenant({
        name: createForm.name.trim(),
        slug: createForm.slug.trim(),
        default_owner_user_id: createForm.default_owner_user_id
          ? Number(createForm.default_owner_user_id)
          : undefined,
        is_active: createForm.is_active,
      })
      closeCreate()
      await loadTenants()
    } catch (err) {
      const apiError = err as { message?: string }
      setActionError(apiError?.message || 'Не удалось создать клиента')
    } finally {
      setActionStatus('idle')
    }
  }

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!activeTenant) return
    setActionStatus('loading')
    setActionError(null)
    try {
      await updateAdminTenant(activeTenant.id, {
        name: editForm.name.trim(),
        slug: editForm.slug.trim(),
        default_owner_user_id: editForm.default_owner_user_id
          ? Number(editForm.default_owner_user_id)
          : null,
        is_active: editForm.is_active,
        ai_prompt: editForm.ai_prompt.trim() || null,
      })
      closeEdit()
      await loadTenants()
    } catch (err) {
      const apiError = err as { message?: string }
      setActionError(apiError?.message || 'Не удалось сохранить')
    } finally {
      setActionStatus('idle')
    }
  }

  const handleAddWhatsappSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!activeTenant) return
    setActionStatus('loading')
    setActionError(null)
    try {
      await addTenantWhatsapp(activeTenant.id, {
        phone_number: addWhatsappForm.phone_number.trim(),
        phone_number_id: addWhatsappForm.phone_number_id.trim(),
        verify_token: addWhatsappForm.verify_token.trim() || undefined,
        waba_id: addWhatsappForm.waba_id.trim() || undefined,
      })
      setAddWhatsappForm({ phone_number: '', phone_number_id: '', verify_token: '', waba_id: '' })
      setActionError(null)
      await loadWhatsapps(activeTenant.id)
    } catch (err) {
      const apiError = err as { status?: number; message?: string }
      setActionError(apiError?.message || 'Не удалось добавить номер')
    } finally {
      setActionStatus('idle')
    }
  }

  const handleDeleteWhatsapp = async (w: TenantWhatsapp) => {
    if (!activeTenant) return
    const id = w.id ?? w.phone_number_id
    if (!window.confirm(`Удалить номер ${w.phone_number}?`)) return
    setDeletingAccountId(id)
    setActionError(null)
    try {
      await deleteTenantWhatsapp(activeTenant.id, id)
      await loadWhatsapps(activeTenant.id)
    } catch (err) {
      const apiError = err as { message?: string }
      setActionError(apiError?.message || 'Не удалось удалить номер')
    } finally {
      setDeletingAccountId(null)
    }
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div className="page-header__text">
          <h1 className="title">Админка</h1>
          <p className="subtitle">Клиенты (Tenants)</p>
        </div>
        <div className="action-card">
          <button
            className="primary-button"
            type="button"
            onClick={() => setCreateOpen(true)}
          >
            Создать клиента
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={loadTenants}
            disabled={status === 'loading'}
          >
            Обновить
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={() => navigate('/admin/users')}
          >
            Пользователи
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
        <div className="card-title">
          {status === 'loading' ? 'Загрузка...' : `Клиентов: ${tenants.length}`}
        </div>
        {error && <div className="error-text">{error}</div>}
      </div>

      {!error && tenants.length === 0 && status !== 'loading' && (
        <div className="card">
          <div className="info-text">Клиентов пока нет</div>
        </div>
      )}

      {!error &&
        tenants.map((t) => (
          <div className="card" key={t.id}>
            <div className="toggle-row">
              <div>
                <div className="toggle-title">{t.name}</div>
                <div className="toggle-subtitle">slug: {t.slug}</div>
                <div className="info-text">
                  Owner ID: {t.default_owner_user_id ?? '—'} ·{' '}
                  {t.is_active ? 'Активен' : 'Неактивен'}
                </div>
              </div>
            </div>
            <div className="toggle-row">
              <button
                className="secondary-button"
                type="button"
                onClick={() => openEdit(t)}
              >
                Редактировать
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => openWhatsapp(t)}
              >
                WhatsApp номера
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => openUsers(t)}
              >
                Пользователи
              </button>
            </div>
          </div>
        ))}

      {/* Create tenant modal */}
      {createOpen && (
        <div className="dialog-backdrop" onClick={closeCreate}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Создать клиента</div>
            <form className="form-grid" onSubmit={handleCreateSubmit}>
              <label className="field">
                <span className="field-label">Название</span>
                <input
                  className="field-input"
                  type="text"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="Компания"
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Slug</span>
                <input
                  className="field-input"
                  type="text"
                  value={createForm.slug}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, slug: e.target.value }))
                  }
                  placeholder="company"
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Default Owner User ID</span>
                <input
                  className="field-input"
                  type="number"
                  value={createForm.default_owner_user_id}
                  onChange={(e) =>
                    setCreateForm((p) => ({
                      ...p,
                      default_owner_user_id: e.target.value,
                    }))
                  }
                  placeholder="1"
                />
              </label>
              <label className="field toggle-row">
                <span className="field-label">Активен</span>
                <input
                  type="checkbox"
                  checked={createForm.is_active}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, is_active: e.target.checked }))
                  }
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

      {/* Edit tenant modal */}
      {editOpen && activeTenant && (
        <div className="dialog-backdrop" onClick={closeEdit}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Редактировать клиента</div>
            <form className="form-grid" onSubmit={handleEditSubmit}>
              <label className="field">
                <span className="field-label">Название</span>
                <input
                  className="field-input"
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, name: e.target.value }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Slug</span>
                <input
                  className="field-input"
                  type="text"
                  value={editForm.slug}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, slug: e.target.value }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Default Owner User ID</span>
                <input
                  className="field-input"
                  type="number"
                  value={editForm.default_owner_user_id}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      default_owner_user_id: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">AI инструкция (prompt)</span>
                <textarea
                  className="field-input field-input--textarea"
                  value={editForm.ai_prompt}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, ai_prompt: e.target.value }))
                  }
                  placeholder="Инструкция для AI по этому клиенту"
                  rows={4}
                />
              </label>
              <label className="field toggle-row">
                <span className="field-label">Активен</span>
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, is_active: e.target.checked }))
                  }
                />
              </label>
              {actionError && <div className="error-text">{actionError}</div>}
              <div className="dialog-actions">
                <button className="ghost-button" type="button" onClick={closeEdit}>
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

      {/* WhatsApp numbers modal */}
      {/* Tenant users modal */}
      {usersOpen && activeTenant && (
        <div className="dialog-backdrop" onClick={closeUsers}>
          <div
            className="dialog admin-dialog-wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-title">
              Пользователи — {activeTenant.name}
            </div>
            {tenantUsersStatus === 'loading' ? (
              <div className="info-text">Загрузка...</div>
            ) : tenantUsers.length === 0 ? (
              <div className="info-text">Пользователей пока нет</div>
            ) : (
              <div className="admin-whatsapp-list">
                {tenantUsers.map((u) => (
                  <div className="card admin-whatsapp-row" key={u.id}>
                    <div>
                      <div className="toggle-title">{u.email}</div>
                      <div className="toggle-subtitle">
                        {u.role === 'admin' ? 'Админ' : 'Менеджер'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="dialog-text">Добавить пользователя</div>
            <form className="form-grid" onSubmit={handleAddUserSubmit}>
              <label className="field">
                <span className="field-label">Email</span>
                <input
                  className="field-input"
                  type="email"
                  value={addUserForm.email}
                  onChange={(e) =>
                    setAddUserForm((p) => ({ ...p, email: e.target.value }))
                  }
                  placeholder="user@company.ru"
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Роль</span>
                <select
                  className="field-input"
                  value={addUserForm.role}
                  onChange={(e) =>
                    setAddUserForm((p) => ({
                      ...p,
                      role: e.target.value as 'manager' | 'admin',
                    }))
                  }
                >
                  <option value="manager">Менеджер</option>
                  <option value="admin">Админ</option>
                </select>
              </label>
              {actionError && <div className="error-text">{actionError}</div>}
              <div className="dialog-actions">
                <button className="ghost-button" type="button" onClick={closeUsers}>
                  Закрыть
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={actionStatus === 'loading'}
                >
                  {actionStatus === 'loading' ? 'Добавляю...' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {whatsappOpen && activeTenant && (
        <div className="dialog-backdrop" onClick={closeWhatsapp}>
          <div
            className="dialog admin-dialog-wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-title">
              WhatsApp номера — {activeTenant.name}
            </div>

            {whatsappStatus === 'loading' ? (
              <div className="info-text">Загрузка...</div>
            ) : whatsapps.length === 0 ? (
              <div className="info-text">Номеров пока нет</div>
            ) : (
              <div className="admin-whatsapp-list">
                {whatsapps.map((w, i) => (
                  <div className="card admin-whatsapp-row" key={w.id ?? w.phone_number_id ?? i}>
                    <div>
                      <div className="toggle-title">{w.phone_number}</div>
                      <div className="toggle-subtitle">
                        ID: {w.phone_number_id} ·{' '}
                        {w.is_active ? 'Активен' : 'Неактивен'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="secondary-button admin-whatsapp-delete"
                      onClick={() => handleDeleteWhatsapp(w)}
                      disabled={deletingAccountId === (w.id ?? w.phone_number_id)}
                    >
                      {deletingAccountId === (w.id ?? w.phone_number_id)
                        ? 'Удаляю...'
                        : 'Удалить'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="dialog-text">Добавить номер</div>
            <form className="form-grid" onSubmit={handleAddWhatsappSubmit}>
              <label className="field">
                <span className="field-label">Phone number</span>
                <input
                  className="field-input"
                  type="text"
                  value={addWhatsappForm.phone_number}
                  onChange={(e) =>
                    setAddWhatsappForm((p) => ({
                      ...p,
                      phone_number: e.target.value,
                    }))
                  }
                  placeholder="+77001234567"
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Phone number ID</span>
                <input
                  className="field-input"
                  type="text"
                  value={addWhatsappForm.phone_number_id}
                  onChange={(e) =>
                    setAddWhatsappForm((p) => ({
                      ...p,
                      phone_number_id: e.target.value,
                    }))
                  }
                  placeholder="123456789"
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Verify token (опционально)</span>
                <input
                  className="field-input"
                  type="text"
                  value={addWhatsappForm.verify_token}
                  onChange={(e) =>
                    setAddWhatsappForm((p) => ({
                      ...p,
                      verify_token: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">WABA ID (опционально)</span>
                <input
                  className="field-input"
                  type="text"
                  value={addWhatsappForm.waba_id}
                  onChange={(e) =>
                    setAddWhatsappForm((p) => ({ ...p, waba_id: e.target.value }))
                  }
                />
              </label>
              {actionError && <div className="error-text">{actionError}</div>}
              <div className="dialog-actions">
                <button className="ghost-button" type="button" onClick={closeWhatsapp}>
                  Закрыть
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={actionStatus === 'loading'}
                >
                  {actionStatus === 'loading' ? 'Добавляю...' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminTenants
