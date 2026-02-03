import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { CRM_V2_ENABLED } from '../config/appConfig'
import {
  addTenantUser,
  getAdminTenants,
  getAmoAuthUrl,
  getAmoPipelineMapping,
  getAmoStatus,
  getTenantSettings,
  getTenantUsers,
  saveAmoPipelineMapping,
  updateTenantSettings,
  type AdminTenant,
  type AmoPipelineMapping,
  type AmoStatus,
  type TenantSettings,
  type TenantUser,
} from '../services/api'

type ModalTab = 'ai' | 'whatsapp' | 'amocrm'

const STAGE_KEY_LABELS: Record<string, string> = {
  new: 'Новый лид',
  in_progress: 'В работе',
  done: 'Успешно закрыт',
  cancelled: 'Отказ',
}

const AdminTenants = () => {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [tenants, setTenants] = useState<AdminTenant[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [usersOpen, setUsersOpen] = useState(false)
  const [activeTenant, setActiveTenant] = useState<AdminTenant | null>(null)
  const [activeTab, setActiveTab] = useState<ModalTab>('ai')

  const [actionStatus, setActionStatus] = useState<'idle' | 'loading'>('idle')
  const [actionError, setActionError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const [settings, setSettings] = useState<TenantSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(false)

  const [amoStatus, setAmoStatus] = useState<AmoStatus | null>(null)
  const [amoMapping, setAmoMapping] = useState<AmoPipelineMapping[]>([])
  const [amoLoading, setAmoLoading] = useState(false)

  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([])
  const [tenantUsersStatus, setTenantUsersStatus] = useState<'idle' | 'loading'>('idle')
  const [tenantUsersError, setTenantUsersError] = useState<string | null>(null)
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
        else if (editOpen) closeEdit()
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [editOpen, usersOpen])

  const loadSettings = useCallback(async (tenantId: string | number) => {
    setSettingsLoading(true)
    try {
      const s = await getTenantSettings(tenantId)
      setSettings(s)
    } catch {
      setSettings(null)
    } finally {
      setSettingsLoading(false)
    }
  }, [])

  const loadAmo = useCallback(async (tenantId: string | number) => {
    setAmoLoading(true)
    try {
      const [st, mp] = await Promise.all([
        getAmoStatus(tenantId).catch(() => ({ connected: false })),
        getAmoPipelineMapping(tenantId).catch(() => []),
      ])
      setAmoStatus(st)
      setAmoMapping(mp.length > 0 ? mp : [
        { stage_key: 'new', stage_id: null },
        { stage_key: 'in_progress', stage_id: null },
        { stage_key: 'done', stage_id: null },
        { stage_key: 'cancelled', stage_id: null },
      ])
    } catch {
      setAmoStatus({ connected: false })
      setAmoMapping([])
    } finally {
      setAmoLoading(false)
    }
  }, [])

  const openEdit = (tenant: AdminTenant) => {
    setActiveTenant(tenant)
    setActiveTab('ai')
    setEditOpen(true)
    setActionError(null)
    setSavedMessage(null)
    loadSettings(tenant.id)
    loadAmo(tenant.id)
  }

  const closeEdit = () => {
    setEditOpen(false)
    setActiveTenant(null)
    setSettings(null)
    setAmoStatus(null)
    setAmoMapping([])
    setActionError(null)
  }

  const handleSaveAi = async () => {
    if (!activeTenant || !settings) return
    setActionStatus('loading')
    setActionError(null)
    try {
      await updateTenantSettings(activeTenant.id, {
        ai_enabled: settings.ai_enabled,
        ai_prompt: settings.ai_prompt,
        ai_after_submit_behavior: settings.ai_after_submit_behavior,
      })
      setSavedMessage('Сохранено')
      setTimeout(() => setSavedMessage(null), 2500)
      loadTenants()
    } catch (err) {
      setActionError((err as { message?: string })?.message || 'Ошибка сохранения')
    } finally {
      setActionStatus('idle')
    }
  }

  const handleSaveWhatsApp = async () => {
    if (!activeTenant || !settings) return
    setActionStatus('loading')
    setActionError(null)
    try {
      await updateTenantSettings(activeTenant.id, {
        whatsapp_source: settings.whatsapp_source,
        chatflow_token: settings.chatflow_token,
        chatflow_instance_id: settings.chatflow_instance_id,
        chatflow_phone_number: settings.chatflow_phone_number,
        chatflow_active: settings.chatflow_active,
      })
      setSavedMessage('Сохранено')
      setTimeout(() => setSavedMessage(null), 2500)
      loadTenants()
    } catch (err) {
      setActionError((err as { message?: string })?.message || 'Ошибка сохранения')
    } finally {
      setActionStatus('idle')
    }
  }

  const handleConnectAmo = async () => {
    if (!activeTenant) return
    setActionStatus('loading')
    setActionError(null)
    try {
      const { url } = await getAmoAuthUrl(activeTenant.id)
      if (url) {
        window.open(url, '_blank')
      } else {
        setActionError('URL авторизации не получен')
      }
    } catch (err) {
      setActionError((err as { message?: string })?.message || 'Ошибка')
    } finally {
      setActionStatus('idle')
    }
  }

  const handleRefreshAmoStatus = async () => {
    if (!activeTenant) return
    setAmoLoading(true)
    try {
      const st = await getAmoStatus(activeTenant.id)
      setAmoStatus(st)
    } catch {
      setAmoStatus({ connected: false })
    } finally {
      setAmoLoading(false)
    }
  }

  const handleSaveAmoMapping = async () => {
    if (!activeTenant) return
    setActionStatus('loading')
    setActionError(null)
    try {
      await saveAmoPipelineMapping(activeTenant.id, amoMapping)
      setSavedMessage('Маппинг сохранён')
      setTimeout(() => setSavedMessage(null), 2500)
    } catch (err) {
      setActionError((err as { message?: string })?.message || 'Ошибка сохранения')
    } finally {
      setActionStatus('idle')
    }
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

  const isBound = settings?.chatflow_token && settings?.chatflow_instance_id

  return (
    <div className="page-stack">
      <div className="page-header">
        <div className="page-header__text">
          <h1 className="title">Клиенты</h1>
          <p className="subtitle">Tenants</p>
        </div>
        <div className="action-card">
          <button className="ghost-button" type="button" onClick={loadTenants} disabled={status === 'loading'}>
            Обновить
          </button>
          <button className="ghost-button" type="button" onClick={() => navigate('/admin/users')}>
            Пользователи
          </button>
          {CRM_V2_ENABLED && (
            <button className="ghost-button" type="button" onClick={() => navigate('/v2/leads-table')}>
              CRM v2
            </button>
          )}
          <button className="ghost-button" type="button" onClick={() => { logout(); navigate('/admin/login') }}>
            Выйти
          </button>
        </div>
      </div>

      {savedMessage && !editOpen && (
        <div className="info-text" style={{ color: 'var(--success)', marginBottom: 8 }}>{savedMessage}</div>
      )}
      <div className="card">
        <div className="card-title">{status === 'loading' ? 'Загрузка...' : `Клиентов: ${tenants.length}`}</div>
        {error && <div className="error-text">{error}</div>}
      </div>

      {!error && tenants.length === 0 && status !== 'loading' && (
        <div className="card"><div className="info-text">Клиентов пока нет</div></div>
      )}

      {!error && tenants.map((t) => (
        <div className="card tenant-card" key={t.id}>
          <div className="tenant-card-row">
            <div className="tenant-card-name">{t.name}</div>
            <div className="tenant-card-badges">
              <span className={`tenant-badge ${t.is_active ? 'tenant-badge--ok' : 'tenant-badge--off'}`}>
                {t.is_active ? 'Active' : 'Inactive'}
              </span>
              <span className={`tenant-badge ${t.ai_enabled !== false ? 'tenant-badge--ok' : 'tenant-badge--off'}`}>
                AI {t.ai_enabled !== false ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>
          <div className="tenant-card-actions">
            <button className="secondary-button" type="button" onClick={() => openEdit(t)}>Настроить</button>
            <button className="ghost-button" type="button" onClick={() => openUsers(t)}>Пользователи</button>
          </div>
        </div>
      ))}

      {/* Edit tenant modal with tabs */}
      {editOpen && activeTenant && (
        <div className="dialog-backdrop" onClick={closeEdit}>
          <div className="dialog admin-dialog-wide" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">{activeTenant.name}</div>
            <div className="tenant-tabs">
              <button type="button" className={`tenant-tab ${activeTab === 'ai' ? 'tenant-tab--active' : ''}`} onClick={() => setActiveTab('ai')}>AI</button>
              <button type="button" className={`tenant-tab ${activeTab === 'whatsapp' ? 'tenant-tab--active' : ''}`} onClick={() => setActiveTab('whatsapp')}>WhatsApp</button>
              <button type="button" className={`tenant-tab ${activeTab === 'amocrm' ? 'tenant-tab--active' : ''}`} onClick={() => setActiveTab('amocrm')}>AmoCRM</button>
            </div>

            {settingsLoading && <div className="info-text" style={{ padding: 16 }}>Загрузка настроек...</div>}

            {!settingsLoading && settings && activeTab === 'ai' && (
              <div className="tenant-tab-content">
                <div className="field toggle-row toggle-row--between">
                  <div>
                    <div className="field-label">AI-менеджер (глобально)</div>
                    <div className="settings-hint">Когда выключено — бот не отвечает, но лиды сохраняются.</div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={settings.ai_enabled !== false}
                      onChange={(e) => setSettings({ ...settings, ai_enabled: e.target.checked })}
                    />
                    <span className="switch-track"><span className="switch-thumb" /></span>
                  </label>
                </div>
                <label className="field">
                  <span className="field-label">AI инструкция (prompt)</span>
                  <textarea
                    className="field-input field-input--textarea"
                    value={settings.ai_prompt ?? ''}
                    onChange={(e) => setSettings({ ...settings, ai_prompt: e.target.value })}
                    placeholder="Инструкция для AI..."
                    rows={5}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Поведение после заявки</span>
                  <select
                    className="field-input"
                    value={settings.ai_after_submit_behavior ?? 'polite_close'}
                    onChange={(e) => setSettings({ ...settings, ai_after_submit_behavior: e.target.value })}
                  >
                    <option value="polite_close">Вежливо завершить</option>
                  </select>
                </label>
                {actionError && <div className="error-text">{actionError}</div>}
                {savedMessage && <div className="info-text" style={{ color: 'var(--success)' }}>{savedMessage}</div>}
                <button className="primary-button" type="button" onClick={handleSaveAi} disabled={actionStatus === 'loading'} style={{ marginTop: 12 }}>
                  {actionStatus === 'loading' ? 'Сохраняю...' : 'Сохранить'}
                </button>
              </div>
            )}

            {!settingsLoading && settings && activeTab === 'whatsapp' && (
              <div className="tenant-tab-content">
                <label className="field">
                  <span className="field-label">Источник WhatsApp</span>
                  <select
                    className="field-input"
                    value={settings.whatsapp_source ?? 'chatflow'}
                    onChange={(e) => setSettings({ ...settings, whatsapp_source: e.target.value as TenantSettings['whatsapp_source'] })}
                  >
                    <option value="chatflow">ChatFlow</option>
                    <option value="amomarket">AmoCRM Marketplace</option>
                  </select>
                </label>
                <div className="settings-hint" style={{ marginBottom: 12, color: 'var(--warning)' }}>
                  Выберите только один источник. Нельзя использовать оба одновременно.
                </div>

                {settings.whatsapp_source === 'amomarket' ? (
                  <div className="info-text" style={{ padding: 12, background: 'var(--bg)', borderRadius: 8 }}>
                    WhatsApp подключается внутри AmoCRM Marketplace. Вебхук настраивать не нужно.
                  </div>
                ) : (
                  <>
                    <div className={`tenant-status ${isBound ? 'tenant-status--ok' : 'tenant-status--warn'}`}>
                      {isBound ? 'Привязано' : 'Не привязано — бот отвечать не будет'}
                    </div>
                    <label className="field">
                      <span className="field-label">ChatFlow Token</span>
                      <textarea
                        className="field-input field-input--textarea"
                        value={settings.chatflow_token ?? ''}
                        onChange={(e) => setSettings({ ...settings, chatflow_token: e.target.value })}
                        placeholder="JWT token"
                        rows={3}
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">Instance ID</span>
                      <input
                        className="field-input"
                        type="text"
                        value={settings.chatflow_instance_id ?? ''}
                        onChange={(e) => setSettings({ ...settings, chatflow_instance_id: e.target.value })}
                        placeholder="ID инстанса (QR)"
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">Номер телефона</span>
                      <input
                        className="field-input"
                        type="text"
                        value={settings.chatflow_phone_number ?? ''}
                        onChange={(e) => setSettings({ ...settings, chatflow_phone_number: e.target.value })}
                        placeholder="+77001234567"
                      />
                    </label>
                    <div className="field toggle-row">
                      <span className="field-label">Активен</span>
                      <input
                        type="checkbox"
                        checked={settings.chatflow_active !== false}
                        onChange={(e) => setSettings({ ...settings, chatflow_active: e.target.checked })}
                      />
                    </div>
                  </>
                )}
                {actionError && <div className="error-text">{actionError}</div>}
                {savedMessage && <div className="info-text" style={{ color: 'var(--success)' }}>{savedMessage}</div>}
                <button className="primary-button" type="button" onClick={handleSaveWhatsApp} disabled={actionStatus === 'loading'} style={{ marginTop: 12 }}>
                  {actionStatus === 'loading' ? 'Сохраняю...' : 'Сохранить привязку'}
                </button>
              </div>
            )}

            {!settingsLoading && activeTab === 'amocrm' && (
              <div className="tenant-tab-content">
                {amoLoading ? (
                  <div className="info-text">Загрузка статуса...</div>
                ) : (
                  <>
                    <div className={`tenant-status ${amoStatus?.connected ? 'tenant-status--ok' : 'tenant-status--warn'}`}>
                      {amoStatus?.connected ? 'Подключено' : 'Не подключено'}
                    </div>
                    {amoStatus?.connected && (
                      <div className="info-text" style={{ marginBottom: 12 }}>
                        Домен: {amoStatus.domain || '—'}<br />
                        Истекает: {amoStatus.expires_at ? new Date(amoStatus.expires_at).toLocaleString() : '—'}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                      <button className="secondary-button" type="button" onClick={handleConnectAmo} disabled={actionStatus === 'loading'}>
                        {amoStatus?.connected ? 'Переподключить' : 'Подключить AmoCRM'}
                      </button>
                      <button className="ghost-button" type="button" onClick={handleRefreshAmoStatus} disabled={amoLoading}>
                        Обновить статус
                      </button>
                    </div>

                    {amoStatus?.connected && (
                      <>
                        <div className="field-label" style={{ marginBottom: 8 }}>Маппинг стадий</div>
                        <div className="settings-hint" style={{ marginBottom: 12 }}>
                          Укажите ID стадий из вашей воронки AmoCRM для каждого статуса лида.
                        </div>
                        <table className="mapping-table">
                          <thead>
                            <tr>
                              <th>Статус лида</th>
                              <th>Stage ID</th>
                            </tr>
                          </thead>
                          <tbody>
                            {amoMapping.map((m, i) => (
                              <tr key={m.stage_key}>
                                <td>{STAGE_KEY_LABELS[m.stage_key] || m.stage_key}</td>
                                <td>
                                  <input
                                    className="field-input"
                                    type="text"
                                    value={m.stage_id ?? ''}
                                    onChange={(e) => {
                                      const val = e.target.value.trim()
                                      setAmoMapping((prev) => prev.map((x, j) => j === i ? { ...x, stage_id: val || null } : x))
                                    }}
                                    placeholder="ID стадии"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <button className="primary-button" type="button" onClick={handleSaveAmoMapping} disabled={actionStatus === 'loading'} style={{ marginTop: 12 }}>
                          {actionStatus === 'loading' ? 'Сохраняю...' : 'Сохранить маппинг'}
                        </button>
                      </>
                    )}
                  </>
                )}
                {actionError && <div className="error-text" style={{ marginTop: 12 }}>{actionError}</div>}
                {savedMessage && <div className="info-text" style={{ color: 'var(--success)', marginTop: 8 }}>{savedMessage}</div>}
              </div>
            )}

            <div className="dialog-actions">
              <button className="ghost-button" type="button" onClick={closeEdit}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* Tenant users modal */}
      {usersOpen && activeTenant && (
        <div className="dialog-backdrop" onClick={closeUsers}>
          <div className="dialog admin-dialog-wide" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Пользователи — {activeTenant.name}</div>
            {tenantUsersError && <div className="error-text" style={{ marginBottom: 12 }}>{tenantUsersError}</div>}
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
                      <div className="toggle-subtitle">{u.role === 'admin' ? 'Админ' : 'Менеджер'}</div>
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
                  onChange={(e) => setAddUserForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="user@company.ru"
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Роль</span>
                <select
                  className="field-input"
                  value={addUserForm.role}
                  onChange={(e) => setAddUserForm((p) => ({ ...p, role: e.target.value as 'manager' | 'admin' }))}
                >
                  <option value="manager">Менеджер</option>
                  <option value="admin">Админ</option>
                </select>
              </label>
              {actionError && <div className="error-text">{actionError}</div>}
              <div className="dialog-actions">
                <button className="ghost-button" type="button" onClick={closeUsers}>Закрыть</button>
                <button className="primary-button" type="submit" disabled={actionStatus === 'loading'}>
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
