import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BASE_URL, CRM_V2_ENABLED } from '../config/appConfig'
import {
  addTenantUser,
  getAdminTenants,
  getTenantUsers,
  getTenantWhatsappBinding,
  postTenantWhatsappBinding,
  updateAdminTenant,
  type AdminTenant,
  type TenantUser,
} from '../services/api'

const AdminTenants = () => {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [tenants, setTenants] = useState<AdminTenant[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [usersOpen, setUsersOpen] = useState(false)
  const [activeTenant, setActiveTenant] = useState<AdminTenant | null>(null)

  const [actionStatus, setActionStatus] = useState<'idle' | 'loading'>('idle')
  const [actionError, setActionError] = useState<string | null>(null)

  const [editForm, setEditForm] = useState({
    name: '',
    ai_prompt: '',
    ai_enabled: true,
    token: '',
    instance_id: '',
    phone_number: '',
    whatsapp_active: true,
  })
  const [tenantUsersError, setTenantUsersError] = useState<string | null>(null)
  const [aiToggleLoading, setAiToggleLoading] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([])
  const [tenantUsersStatus, setTenantUsersStatus] = useState<'idle' | 'loading'>('idle')
  const [addUserForm, setAddUserForm] = useState({ email: '', role: 'manager' as 'manager' | 'admin' })
  const [bindingLoading, setBindingLoading] = useState(false)
  const [webhookCopied, setWebhookCopied] = useState(false)

  const getWebhookUrl = (tenant: AdminTenant | null): string => {
    if (!tenant) return ''
    const url = tenant.webhook_url?.trim()
    if (url) return url
    const key = tenant.webhook_key?.trim()
    if (key) {
      const base = BASE_URL.replace(/\/+$/, '')
      return `${base}/api/webhook/chatflow?key=${encodeURIComponent(key)}`
    }
    return ''
  }

  const copyWebhookUrl = () => {
    const url = getWebhookUrl(activeTenant)
    if (!url) return
    navigator.clipboard.writeText(url).then(() => {
      setWebhookCopied(true)
      setTimeout(() => setWebhookCopied(false), 2000)
    })
  }

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
        else if (editOpen) closeEdit()
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [editOpen, usersOpen])

  const openEdit = (tenant: AdminTenant) => {
    setActiveTenant(tenant)
    setEditForm({
      name: tenant.name,
      ai_prompt: tenant.ai_prompt ?? '',
      ai_enabled: tenant.ai_enabled !== false,
      token: '',
      instance_id: '',
      phone_number: '',
      whatsapp_active: true,
    })
    setEditOpen(true)
    setActionError(null)
    setBindingLoading(true)
    getTenantWhatsappBinding(tenant.id)
      .then((b) => {
        setEditForm((prev) => ({
          ...prev,
          token: (b.token ?? '').toString(),
          instance_id: (b.instance_id ?? '').toString(),
          phone_number: (b.phone_number ?? '').toString(),
          whatsapp_active: b.active !== false,
        }))
      })
      .catch(() => {
        // leave binding fields empty
      })
      .finally(() => setBindingLoading(false))
  }

  const handleAiToggle = async (tenant: AdminTenant, nextEnabled: boolean) => {
    setAiToggleLoading(true)
    setActionError(null)
    setSavedMessage(null)
    try {
      await updateAdminTenant(tenant.id, { ai_enabled: nextEnabled })
      setTenants((prev) =>
        prev.map((t) =>
          t.id === tenant.id ? { ...t, ai_enabled: nextEnabled } : t,
        ),
      )
      if (activeTenant?.id === tenant.id) {
        setEditForm((p) => ({ ...p, ai_enabled: nextEnabled }))
        setActiveTenant((a) => (a?.id === tenant.id ? { ...a, ai_enabled: nextEnabled } : a))
      }
      setActionError(null)
      setSavedMessage('Сохранено')
      setTimeout(() => setSavedMessage(null), 2500)
    } catch (err) {
      const apiError = err as { message?: string }
      setActionError(apiError?.message || 'Ошибка')
    } finally {
      setAiToggleLoading(false)
    }
  }

  const closeEdit = () => {
    setEditOpen(false)
    setActiveTenant(null)
    setActionError(null)
  }

  const loadTenantUsers = useCallback(async (tenantId: string | number) => {
    setTenantUsersStatus('loading')
    setTenantUsersError(null)
    try {
      const list = await getTenantUsers(tenantId)
      setTenantUsers(list)
    } catch (err) {
      setTenantUsers([])
      const msg = err instanceof Error ? err.message : 'Не удалось загрузить пользователей'
      setTenantUsersError(msg)
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
    setTenantUsersError(null)
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

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!activeTenant) return
    setActionStatus('loading')
    setActionError(null)
    try {
      await updateAdminTenant(activeTenant.id, {
        name: editForm.name.trim(),
        slug: activeTenant.slug,
        default_owner_user_id: activeTenant.default_owner_user_id ?? null,
        is_active: activeTenant.is_active,
        ai_prompt: editForm.ai_prompt.trim() || null,
        ai_enabled: editForm.ai_enabled,
      })
    } catch (err) {
      const apiError = err as { message?: string }
      setActionError(apiError?.message || 'Не удалось сохранить tenant')
      setActionStatus('idle')
      return
    }
    const needBinding =
      editForm.whatsapp_active ||
      !!editForm.token.trim() ||
      !!editForm.instance_id.trim() ||
      !!editForm.phone_number.trim()
    if (needBinding) {
      if (import.meta.env.DEV) {
        console.log('[AdminTenants] POST whatsapp payload keys:', {
          chatflow_token: editForm.token ? `len=${editForm.token.trim().length}` : null,
          chatflow_instance_id: editForm.instance_id ? `len=${editForm.instance_id.trim().length}` : null,
          phone_number: editForm.phone_number?.trim() || null,
          active: editForm.whatsapp_active,
        })
      }
      try {
        await postTenantWhatsappBinding(activeTenant.id, {
          token: editForm.token.trim() || null,
          instance_id: editForm.instance_id.trim() || null,
          phone_number: editForm.phone_number.trim() || null,
          active: editForm.whatsapp_active,
        })
      } catch (bindErr) {
        const msg = (bindErr as { message?: string })?.message || 'Не удалось сохранить привязку'
        setActionError(msg)
        setActionStatus('idle')
        return
      }
      try {
        const binding = await getTenantWhatsappBinding(activeTenant.id)
        setEditForm((prev) => ({
          ...prev,
          token: (binding.token ?? '').toString(),
          instance_id: (binding.instance_id ?? '').toString(),
          phone_number: (binding.phone_number ?? '').toString(),
          whatsapp_active: binding.active !== false,
        }))
      } catch {
        // ignore refetch error
      }
    }
    await loadTenants()
    setSavedMessage('Сохранено')
    setTimeout(() => setSavedMessage(null), 2500)
    closeEdit()
    setActionStatus('idle')
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
          {CRM_V2_ENABLED && (
            <button
              className="ghost-button"
              type="button"
              onClick={() => navigate('/v2/leads-table')}
            >
              CRM v2 (таблица)
            </button>
          )}
          <button
            className="ghost-button"
            type="button"
            onClick={() => navigate('/admin/diagnostics')}
          >
            Диагностика
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

      {savedMessage && !editOpen && (
        <div className="info-text" style={{ color: 'var(--success)', marginBottom: 8 }}>{savedMessage}</div>
      )}
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
                onClick={() => openUsers(t)}
              >
                Пользователи
              </button>
            </div>
          </div>
        ))}

      {/* Edit tenant modal */}
      {editOpen && activeTenant && (
        <div className="dialog-backdrop" onClick={closeEdit}>
          <div className="dialog admin-dialog-wide" onClick={(e) => e.stopPropagation()}>
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
              <div className="field toggle-row toggle-row--between">
                <div>
                  <div className="field-label">AI-менеджер</div>
                  <div className="settings-hint" style={{ marginTop: 4 }}>
                    Когда выключено — бот не отвечает автоматически, но лиды продолжают сохраняться.
                  </div>
                  <div className="settings-hint" style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                    Команды /stop, /start работают только если сообщение попадает в webhook (обычно входящие). Надёжнее выключать из CRM.
                  </div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={editForm.ai_enabled}
                    disabled={aiToggleLoading}
                    onChange={(e) =>
                      activeTenant && handleAiToggle(activeTenant, e.target.checked)
                    }
                  />
                  <span className="switch-track">
                    <span className="switch-thumb" />
                  </span>
                </label>
              </div>
              {savedMessage && (
                <div className="info-text" style={{ color: 'var(--success)' }}>{savedMessage}</div>
              )}
              <div className="dialog-text" style={{ marginTop: 12, marginBottom: 4 }}>
                ChatFlow Webhook URL
              </div>
              <div className="settings-hint" style={{ marginBottom: 8 }}>
                Вставь этот URL в ChatFlow → Send a Webhook. Без него бот не поймёт, к какому клиенту относится чат.
              </div>
              <div className="field" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="field-input"
                  type="text"
                  readOnly
                  value={getWebhookUrl(activeTenant)}
                  style={{ flex: 1, background: 'var(--bg)' }}
                />
                <button
                  className="secondary-button"
                  type="button"
                  onClick={copyWebhookUrl}
                  disabled={!getWebhookUrl(activeTenant)}
                >
                  {webhookCopied ? 'Скопировано' : 'Copy'}
                </button>
              </div>
              <div className="dialog-text" style={{ marginTop: 12, marginBottom: 4 }}>
                WhatsApp / ChatFlow привязка
              </div>
              {bindingLoading && (
                <div className="info-text" style={{ marginBottom: 8 }}>Загрузка привязки...</div>
              )}
              <div className="settings-hint" style={{ marginBottom: 10 }}>
                Для каждого клиента нужен свой instance_id (QR в ChatFlow) + token. Без них бот отвечать не будет.
              </div>
              {!bindingLoading && (() => {
                const webhookUrl = getWebhookUrl(activeTenant)
                const noBinding = editForm.whatsapp_active && (!editForm.token.trim() || !editForm.instance_id.trim())
                const noWebhook = !webhookUrl
                if (noBinding || noWebhook) {
                  return (
                    <div className="error-text" style={{ marginBottom: 8 }}>
                      Не привязано — бот отвечать не будет.
                    </div>
                  )
                }
                return null
              })()}
              <label className="field">
                <span className="field-label">token</span>
                <textarea
                  className={`field-input field-input--textarea${actionError ? ' field-input--error' : ''}`}
                  value={editForm.token}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, token: e.target.value }))
                  }
                  placeholder="ChatFlow token (JWT)"
                  rows={3}
                />
              </label>
              <label className="field">
                <span className="field-label">instance_id</span>
                <input
                  className={`field-input${actionError ? ' field-input--error' : ''}`}
                  type="text"
                  value={editForm.instance_id}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, instance_id: e.target.value }))
                  }
                  placeholder="ID инстанса (QR в ChatFlow)"
                />
              </label>
              <label className="field">
                <span className="field-label">phone_number</span>
                <input
                  className={`field-input${actionError ? ' field-input--error' : ''}`}
                  type="text"
                  value={editForm.phone_number}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, phone_number: e.target.value }))
                  }
                  placeholder="+77001234567"
                />
              </label>
              <label className="field toggle-row">
                <span className="field-label">active</span>
                <input
                  type="checkbox"
                  checked={editForm.whatsapp_active}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, whatsapp_active: e.target.checked }))
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
            {tenantUsersError && (
              <div className="error-text" style={{ marginBottom: 12 }}>
                {tenantUsersError}
              </div>
            )}
            {tenantUsersStatus === 'loading' ? (
              <div className="info-text">Загрузка...</div>
            ) : tenantUsers.length === 0 && !tenantUsersError ? (
              <div className="info-text">Пользователей пока нет</div>
            ) : tenantUsers.length > 0 ? (
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
            ) : null}
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
    </div>
  )
}

export default AdminTenants
