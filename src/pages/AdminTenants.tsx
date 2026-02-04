import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  addTenantUser,
  getAdminTenants,
  getAmoAuthUrl,
  getAmoPipelineMapping,
  getAmoStatus,
  getTenantSettings,
  getTenantUsers,
  postTenantWhatsappBinding,
  saveAmoPipelineMapping,
  selfCheckTenant,
  updateTenantSettings,
  type AdminTenant,
  type AmoPipelineMapping,
  type AmoStatus,
  type DetailedApiError,
  type SelfCheckResult,
  type TenantSettings,
  type TenantUser,
} from '../services/api'

type ModalTab = 'ai' | 'whatsapp' | 'amocrm'
type SettingsStatus = 'idle' | 'loading' | 'error' | 'ready'

const STAGE_KEY_LABELS: Record<string, string> = {
  new: 'Новый лид',
  in_progress: 'В работе',
  done: 'Успешно закрыт',
  cancelled: 'Отказ',
}

/** Check if error is DetailedApiError */
function isDetailedError(err: unknown): err is DetailedApiError {
  return typeof err === 'object' && err !== null && 'url' in err
}

/** Safely extract error message string, never return [object Object] */
const getErrorMessage = (err: unknown): string => {
  if (!err) return 'Неизвестная ошибка'
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  const e = err as Record<string, unknown>
  if (typeof e.message === 'string') return e.message
  if (typeof e.detail === 'string') return e.detail
  if (e.detail && typeof e.detail === 'object') {
    try {
      return JSON.stringify(e.detail)
    } catch {
      return 'Ошибка запроса'
    }
  }
  try {
    const s = JSON.stringify(err)
    return s.length > 200 ? s.slice(0, 200) + '...' : s
  } catch {
    return 'Ошибка запроса'
  }
}

/** Create safe default settings to avoid undefined crashes */
function safeSettings(raw: TenantSettings | null): TenantSettings {
  return {
    id: raw?.id ?? undefined,
    name: raw?.name ?? '',
    ai_enabled: raw?.ai_enabled !== false,
    ai_prompt: raw?.ai_prompt ?? '',
    ai_after_submit_behavior: raw?.ai_after_submit_behavior ?? 'polite_close',
    whatsapp_source: raw?.whatsapp_source ?? 'chatflow',
    chatflow_token: raw?.chatflow_token ?? '',
    chatflow_token_masked: raw?.chatflow_token_masked ?? null,
    chatflow_instance_id: raw?.chatflow_instance_id ?? '',
    chatflow_phone_number: raw?.chatflow_phone_number ?? '',
    chatflow_active: raw?.chatflow_active !== false,
    chatflow_binding_exists: raw?.chatflow_binding_exists ?? false,
    amocrm_connected: raw?.amocrm_connected ?? false,
    amocrm_domain: raw?.amocrm_domain ?? null,
    amocrm_base_domain: raw?.amocrm_base_domain ?? '',
    amocrm_expires_at: raw?.amocrm_expires_at ?? null,
  }
}

const AdminTenants = () => {
  const [tenants, setTenants] = useState<AdminTenant[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Settings modal - state machine
  const [editOpen, setEditOpen] = useState(false)
  const [activeTenant, setActiveTenant] = useState<AdminTenant | null>(null)
  const [activeTab, setActiveTab] = useState<ModalTab>('ai')
  const [settingsStatus, setSettingsStatus] = useState<SettingsStatus>('idle')
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [settingsErrorDetail, setSettingsErrorDetail] = useState<DetailedApiError | null>(null)
  const [settings, setSettings] = useState<TenantSettings>(safeSettings(null))
  const [actionStatus, setActionStatus] = useState<'idle' | 'loading'>('idle')
  const [actionError, setActionError] = useState<string | null>(null)

  // AmoCRM
  const [amoStatus, setAmoStatus] = useState<AmoStatus>({ connected: false })
  const [amoMapping, setAmoMapping] = useState<AmoPipelineMapping[]>([])
  const [amoLoading, setAmoLoading] = useState(false)
  const [amoBaseDomain, setAmoBaseDomain] = useState('')

  // Users modal
  const [usersOpen, setUsersOpen] = useState(false)
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([])
  const [tenantUsersStatus, setTenantUsersStatus] = useState<'idle' | 'loading'>('idle')
  const [tenantUsersError, setTenantUsersError] = useState<string | null>(null)
  const [addUserForm, setAddUserForm] = useState({ email: '', role: 'manager' as 'manager' | 'admin' })

  // Self-check modal
  const [checkOpen, setCheckOpen] = useState(false)
  const [checkResult, setCheckResult] = useState<SelfCheckResult | null>(null)
  const [checkLoading, setCheckLoading] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const loadTenants = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const data = await getAdminTenants()
      setTenants(Array.isArray(data) ? data : [])
      setStatus('idle')
    } catch (err) {
      setError(getErrorMessage(err))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    loadTenants()
  }, [loadTenants])

  // --- Settings Modal ---
  const loadSettings = useCallback(async (tenantId: string | number) => {
    setSettingsStatus('loading')
    setSettingsError(null)
    setSettingsErrorDetail(null)
    setActionError(null)

    // First try to get tenant settings - this is the main call
    let rawSettings: TenantSettings | null = null
    let settingsErr: unknown = null

    try {
      rawSettings = await getTenantSettings(tenantId)
    } catch (e) {
      console.error('getTenantSettings failed:', e)
      settingsErr = e
    }

    // If settings failed, show detailed error immediately
    if (!rawSettings) {
      if (isDetailedError(settingsErr)) {
        setSettingsErrorDetail(settingsErr)
        setSettingsError(settingsErr.message || 'Ошибка загрузки настроек')
      } else {
        setSettingsError(getErrorMessage(settingsErr) || 'Не удалось загрузить настройки tenant')
        // Create a basic detailed error for non-detailed errors
        setSettingsErrorDetail({
          message: getErrorMessage(settingsErr),
          tenantId,
          detail: settingsErr instanceof Error ? settingsErr.stack : undefined,
        })
      }
      setSettingsStatus('error')
      return
    }

    // Settings loaded, now get additional data
    try {
      const [rawAmoStatus, rawMapping] = await Promise.all([
        getAmoStatus(tenantId).catch(() => ({ connected: false })),
        getAmoPipelineMapping(tenantId).catch(() => []),
      ])

      const safe = safeSettings(rawSettings)
      setSettings(safe)
      setAmoStatus(rawAmoStatus as AmoStatus)
      setAmoBaseDomain(safe.amocrm_base_domain || (rawAmoStatus as AmoStatus).domain || '')
      setAmoMapping(
        Array.isArray(rawMapping) && rawMapping.length > 0
          ? rawMapping
          : [
              { stage_key: 'new', stage_id: null },
              { stage_key: 'in_progress', stage_id: null },
              { stage_key: 'done', stage_id: null },
              { stage_key: 'cancelled', stage_id: null },
            ]
      )
      setSettingsStatus('ready')
    } catch (err) {
      setSettingsError(getErrorMessage(err))
      setSettingsStatus('error')
    }
  }, [])

  const openEdit = (tenant: AdminTenant, tab: ModalTab = 'ai') => {
    setActiveTenant(tenant)
    setActiveTab(tab)
    setEditOpen(true)
    setSettingsStatus('idle')
    setSettingsError(null)
    setSettingsErrorDetail(null)
    setActionError(null)
    setAmoBaseDomain('')
    setSettings(safeSettings(null))
    loadSettings(tenant.id)
  }

  const closeEdit = () => {
    setEditOpen(false)
    setActiveTenant(null)
    setSettings(safeSettings(null))
    setSettingsErrorDetail(null)
    setAmoStatus({ connected: false })
    setAmoMapping([])
    setSettingsStatus('idle')
    setSettingsError(null)
    setActionError(null)
  }

  const handleRetrySettings = () => {
    if (activeTenant) {
      loadSettings(activeTenant.id)
    }
  }

  const handleSaveAi = async () => {
    if (!activeTenant) return
    setActionStatus('loading')
    setActionError(null)
    try {
      await updateTenantSettings(activeTenant.id, {
        ai_enabled: settings.ai_enabled,
        ai_prompt: settings.ai_prompt,
        ai_after_submit_behavior: settings.ai_after_submit_behavior,
      })
      await loadSettings(activeTenant.id)
      await loadTenants()
      showToast('Сохранено ✅')
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setActionStatus('idle')
    }
  }

  const handleSaveWhatsApp = async () => {
    if (!activeTenant) return
    setActionStatus('loading')
    setActionError(null)
    try {
      // If chatflow source, save binding
      if (settings.whatsapp_source === 'chatflow') {
        await postTenantWhatsappBinding(activeTenant.id, {
          token: settings.chatflow_token || null,
          instance_id: settings.chatflow_instance_id || null,
          phone_number: settings.chatflow_phone_number || null,
          active: settings.chatflow_active,
        })
      }

      // Also try to save via settings endpoint
      await updateTenantSettings(activeTenant.id, {
        whatsapp_source: settings.whatsapp_source,
        chatflow_token: settings.chatflow_token || null,
        chatflow_instance_id: settings.chatflow_instance_id || null,
        chatflow_phone_number: settings.chatflow_phone_number || null,
        chatflow_active: settings.chatflow_active,
      }).catch(() => {})

      // Refetch to confirm saved
      await loadSettings(activeTenant.id)
      await loadTenants()
      showToast('Сохранено ✅')
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setActionStatus('idle')
    }
  }

  const handleSaveAmoDomain = async () => {
    if (!activeTenant) return
    const domain = amoBaseDomain.trim()
    if (!domain) {
      setActionError('Укажите домен AmoCRM')
      return
    }
    setActionStatus('loading')
    setActionError(null)
    try {
      await updateTenantSettings(activeTenant.id, {
        amocrm_base_domain: domain,
      })
      showToast('Домен сохранён ✅')
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setActionStatus('idle')
    }
  }

  const handleConnectAmo = async () => {
    if (!activeTenant) return
    const domain = amoBaseDomain.trim()
    if (!domain) {
      setActionError('Сначала укажите и сохраните домен AmoCRM (например: mycompany.amocrm.ru)')
      return
    }
    setActionStatus('loading')
    setActionError(null)
    try {
      const result = await getAmoAuthUrl(activeTenant.id, domain)
      const url = result?.url
      if (url) {
        window.open(url, '_blank')
        showToast('Открыто окно авторизации AmoCRM')
      } else {
        setActionError('URL авторизации не получен. Проверьте домен.')
      }
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setActionStatus('idle')
    }
  }

  const handleRefreshAmoStatus = async () => {
    if (!activeTenant) return
    setAmoLoading(true)
    setActionError(null)
    try {
      const st = await getAmoStatus(activeTenant.id)
      setAmoStatus(st)
      if (st.domain) setAmoBaseDomain(st.domain)
    } catch (err) {
      setAmoStatus({ connected: false })
      setActionError(getErrorMessage(err))
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
      showToast('Маппинг сохранён ✅')
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setActionStatus('idle')
    }
  }

  // --- Users Modal ---
  const loadTenantUsers = useCallback(async (tenantId: string | number) => {
    setTenantUsersStatus('loading')
    setTenantUsersError(null)
    try {
      const list = await getTenantUsers(tenantId)
      setTenantUsers(Array.isArray(list) ? list : [])
    } catch (err) {
      setTenantUsers([])
      setTenantUsersError(getErrorMessage(err))
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
      await addTenantUser(activeTenant.id, { email: addUserForm.email.trim(), role: addUserForm.role })
      setAddUserForm({ email: '', role: 'manager' })
      await loadTenantUsers(activeTenant.id)
      showToast('Пользователь добавлен ✅')
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setActionStatus('idle')
    }
  }

  // --- Self-Check ---
  const openCheck = async (tenant: AdminTenant) => {
    setActiveTenant(tenant)
    setCheckOpen(true)
    setCheckLoading(true)
    setCheckResult(null)
    try {
      const result = await selfCheckTenant(tenant.id)
      setCheckResult(result)
    } catch (err) {
      setCheckResult({
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        checks: [
          {
            key: 'error',
            label: 'Ошибка проверки',
            ok: false,
            message: getErrorMessage(err),
          },
        ],
        all_ok: false,
      })
    } finally {
      setCheckLoading(false)
    }
  }

  const closeCheck = () => {
    setCheckOpen(false)
    setActiveTenant(null)
    setCheckResult(null)
  }

  const handleCheckAction = (action: string) => {
    if (!activeTenant) return
    closeCheck()
    if (action === 'open_ai') openEdit(activeTenant, 'ai')
    else if (action === 'open_whatsapp') openEdit(activeTenant, 'whatsapp')
    else if (action === 'open_amocrm' || action === 'reconnect_amo') openEdit(activeTenant, 'amocrm')
  }

  const isBound = settings.chatflow_binding_exists || (settings.chatflow_token && settings.chatflow_instance_id)

  // Escape key handling
  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (checkOpen) closeCheck()
        else if (usersOpen) closeUsers()
        else if (editOpen) closeEdit()
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [editOpen, usersOpen, checkOpen])

  // --- Render ---
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Клиенты</h1>
          <p className="admin-page-subtitle">Управление tenants</p>
        </div>
        <button
          className="admin-btn admin-btn--primary"
          type="button"
          onClick={loadTenants}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Загрузка...' : 'Обновить'}
        </button>
      </div>

      {error && <div className="admin-alert admin-alert--error">{error}</div>}

      {status === 'loading' && <div className="admin-loading">Загрузка клиентов...</div>}

      {!error && status !== 'loading' && tenants.length === 0 && (
        <div className="admin-empty">Клиентов пока нет</div>
      )}

      {!error && tenants.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Active</th>
                <th>AI</th>
                <th>WhatsApp</th>
                <th>WA Linked</th>
                <th>AmoCRM</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id}>
                  <td className="admin-table-name">{t.name}</td>
                  <td>
                    <span className={`admin-badge ${t.is_active ? 'admin-badge--ok' : 'admin-badge--off'}`}>
                      {t.is_active ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-badge ${t.ai_enabled !== false ? 'admin-badge--ok' : 'admin-badge--off'}`}>
                      {t.ai_enabled !== false ? 'ON' : 'OFF'}
                    </span>
                  </td>
                  <td>
                    <span className="admin-badge admin-badge--neutral">
                      {(t as Record<string, unknown>).whatsapp_source === 'amomarket' ? 'AmoCRM' : 'ChatFlow'}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-badge ${t.token || t.instance_id ? 'admin-badge--ok' : 'admin-badge--warn'}`}>
                      {t.token || t.instance_id ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`admin-badge ${(t as Record<string, unknown>).amocrm_connected ? 'admin-badge--ok' : 'admin-badge--neutral'}`}
                    >
                      {(t as Record<string, unknown>).amocrm_connected ? 'Yes' : '—'}
                    </span>
                  </td>
                  <td className="admin-table-actions">
                    <button className="admin-btn admin-btn--sm" type="button" onClick={() => openEdit(t)}>
                      Настроить
                    </button>
                    <button
                      className="admin-btn admin-btn--sm admin-btn--ghost"
                      type="button"
                      onClick={() => openUsers(t)}
                    >
                      Юзеры
                    </button>
                    <button
                      className="admin-btn admin-btn--sm admin-btn--accent"
                      type="button"
                      onClick={() => openCheck(t)}
                    >
                      Проверить
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

      {/* Settings Modal */}
      {editOpen && activeTenant && (
        <div className="admin-modal-backdrop" onClick={closeEdit}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">{activeTenant.name}</h2>
              <button className="admin-modal-close" type="button" onClick={closeEdit}>
                ×
              </button>
            </div>
            <div className="admin-tabs">
              <button
                type="button"
                className={`admin-tab ${activeTab === 'ai' ? 'admin-tab--active' : ''}`}
                onClick={() => setActiveTab('ai')}
              >
                AI Настройки
              </button>
              <button
                type="button"
                className={`admin-tab ${activeTab === 'whatsapp' ? 'admin-tab--active' : ''}`}
                onClick={() => setActiveTab('whatsapp')}
              >
                WhatsApp
              </button>
              <button
                type="button"
                className={`admin-tab ${activeTab === 'amocrm' ? 'admin-tab--active' : ''}`}
                onClick={() => setActiveTab('amocrm')}
              >
                AmoCRM
              </button>
            </div>

            <div className="admin-modal-body">
              {/* LOADING STATE */}
              {settingsStatus === 'loading' && (
                <div className="admin-loading-panel">
                  <div className="admin-spinner" />
                  <p>Загрузка настроек...</p>
                </div>
              )}

              {/* ERROR STATE */}
              {settingsStatus === 'error' && (
                <div className="admin-error-panel admin-error-panel--detailed">
                  <div className="admin-error-icon">⚠️</div>
                  <h3>Ошибка загрузки настроек</h3>
                  
                  {/* Main error message */}
                  <p className="admin-error-message">{settingsError || 'Не удалось загрузить настройки'}</p>
                  
                  {/* Detailed diagnostics */}
                  {settingsErrorDetail && (
                    <div className="admin-error-diagnostics">
                      <div className="admin-error-diagnostics-title">🔧 Диагностика:</div>
                      <div className="admin-error-diagnostics-grid">
                        {settingsErrorDetail.status && (
                          <div className="admin-diag-row">
                            <span className="admin-diag-label">HTTP Status:</span>
                            <span className="admin-diag-value admin-diag-value--code">{settingsErrorDetail.status}</span>
                          </div>
                        )}
                        {settingsErrorDetail.url && (
                          <div className="admin-diag-row">
                            <span className="admin-diag-label">URL:</span>
                            <span className="admin-diag-value admin-diag-value--mono">{settingsErrorDetail.url}</span>
                          </div>
                        )}
                        {settingsErrorDetail.detail && (
                          <div className="admin-diag-row">
                            <span className="admin-diag-label">Backend Detail:</span>
                            <span className="admin-diag-value">{settingsErrorDetail.detail}</span>
                          </div>
                        )}
                        <div className="admin-diag-row">
                          <span className="admin-diag-label">Auth Header:</span>
                          <span className={`admin-diag-value ${settingsErrorDetail.hasAuthHeader ? 'admin-diag-value--ok' : 'admin-diag-value--warn'}`}>
                            {settingsErrorDetail.hasAuthHeader ? '✅ Присутствует' : '❌ Отсутствует'}
                          </span>
                        </div>
                        {settingsErrorDetail.tenantId && (
                          <div className="admin-diag-row">
                            <span className="admin-diag-label">Tenant ID:</span>
                            <span className="admin-diag-value">{settingsErrorDetail.tenantId}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Response body preview */}
                      {settingsErrorDetail.responseBody && (
                        <div className="admin-error-response">
                          <div className="admin-diag-label">Response (первые 500 символов):</div>
                          <pre className="admin-error-response-body">{settingsErrorDetail.responseBody}</pre>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="admin-error-actions">
                    <button className="admin-btn admin-btn--primary" type="button" onClick={handleRetrySettings}>
                      Повторить
                    </button>
                    {settingsErrorDetail && (
                      <button
                        className="admin-btn admin-btn--secondary"
                        type="button"
                        onClick={() => {
                          const diag = {
                            url: settingsErrorDetail.url,
                            status: settingsErrorDetail.status,
                            detail: settingsErrorDetail.detail,
                            responseBody: settingsErrorDetail.responseBody,
                            hasAuthHeader: settingsErrorDetail.hasAuthHeader,
                            tenantId: settingsErrorDetail.tenantId,
                            timestamp: new Date().toISOString(),
                          }
                          navigator.clipboard.writeText(JSON.stringify(diag, null, 2))
                          showToast('Диагностика скопирована')
                        }}
                      >
                        📋 Скопировать диагностику
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* READY STATE - AI Tab */}
              {settingsStatus === 'ready' && activeTab === 'ai' && (
                <div className="admin-settings-section">
                  <div className="admin-settings-block">
                    <div className="admin-settings-row">
                      <div className="admin-settings-info">
                        <div className="admin-settings-label">AI-менеджер (глобально)</div>
                        <div className="admin-settings-hint">
                          Когда выключено — бот не отвечает, но лиды сохраняются.
                        </div>
                      </div>
                      <label className="admin-switch">
                        <input
                          type="checkbox"
                          checked={settings.ai_enabled !== false}
                          onChange={(e) => setSettings({ ...settings, ai_enabled: e.target.checked })}
                        />
                        <span className="admin-switch-track">
                          <span className="admin-switch-thumb" />
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="admin-settings-block">
                    <label className="admin-label">AI инструкция (prompt)</label>
                    <div className="admin-settings-hint" style={{ marginBottom: 8 }}>
                      Укажите контекст: что продаёте, как общаться, какую информацию собирать.
                    </div>
                    <textarea
                      className="admin-input admin-input--textarea"
                      value={settings.ai_prompt ?? ''}
                      onChange={(e) => setSettings({ ...settings, ai_prompt: e.target.value })}
                      placeholder="Вы — AI-ассистент компании..."
                      rows={6}
                    />
                  </div>

                  <div className="admin-settings-block">
                    <label className="admin-label">Поведение после заявки</label>
                    <select
                      className="admin-input"
                      value={settings.ai_after_submit_behavior ?? 'polite_close'}
                      onChange={(e) => setSettings({ ...settings, ai_after_submit_behavior: e.target.value })}
                    >
                      <option value="polite_close">Вежливо завершить</option>
                    </select>
                  </div>

                  {actionError && <div className="admin-alert admin-alert--error">{actionError}</div>}

                  <button
                    className="admin-btn admin-btn--primary"
                    type="button"
                    onClick={handleSaveAi}
                    disabled={actionStatus === 'loading'}
                  >
                    {actionStatus === 'loading' ? 'Сохраняю...' : 'Сохранить'}
                  </button>
                </div>
              )}

              {/* READY STATE - WhatsApp Tab */}
              {settingsStatus === 'ready' && activeTab === 'whatsapp' && (
                <div className="admin-settings-section">
                  <div className="admin-settings-block">
                    <label className="admin-label">Источник WhatsApp</label>
                    <select
                      className="admin-input"
                      value={settings.whatsapp_source ?? 'chatflow'}
                      onChange={(e) =>
                        setSettings({ ...settings, whatsapp_source: e.target.value as TenantSettings['whatsapp_source'] })
                      }
                    >
                      <option value="chatflow">ChatFlow</option>
                      <option value="amomarket">AmoCRM Marketplace</option>
                    </select>
                    <div className="admin-settings-hint" style={{ marginTop: 8, color: '#f59e0b' }}>
                      Выберите только один источник. Нельзя использовать оба.
                    </div>
                  </div>

                  {settings.whatsapp_source === 'amomarket' ? (
                    <div className="admin-info-box">
                      <strong>AmoCRM Marketplace</strong>
                      <br />
                      WhatsApp подключается внутри AmoCRM. Вебхук настраивать не нужно.
                    </div>
                  ) : (
                    <>
                      <div className={`admin-status-box ${isBound ? 'admin-status-box--ok' : 'admin-status-box--warn'}`}>
                        {isBound ? '✅ Привязано — бот готов отвечать' : '⚠️ Не привязано — бот не сможет отвечать'}
                      </div>

                      {settings.chatflow_token_masked && (
                        <div className="admin-info-box">
                          <strong>Текущий токен:</strong> {settings.chatflow_token_masked}
                          <br />
                          <small>Вставьте новый токен ниже, чтобы обновить.</small>
                        </div>
                      )}

                      <div className="admin-form-grid">
                        <div className="admin-settings-block">
                          <label className="admin-label">ChatFlow Token (JWT)</label>
                          <textarea
                            className="admin-input admin-input--textarea"
                            value={settings.chatflow_token ?? ''}
                            onChange={(e) => setSettings({ ...settings, chatflow_token: e.target.value })}
                            placeholder="eyJhbGciOiJIUzI1NiIs..."
                            rows={3}
                          />
                        </div>

                        <div className="admin-settings-block">
                          <label className="admin-label">Instance ID</label>
                          <input
                            className="admin-input"
                            type="text"
                            value={settings.chatflow_instance_id ?? ''}
                            onChange={(e) => setSettings({ ...settings, chatflow_instance_id: e.target.value })}
                            placeholder="ID инстанса (QR в ChatFlow)"
                          />
                        </div>

                        <div className="admin-settings-block">
                          <label className="admin-label">Номер телефона</label>
                          <input
                            className="admin-input"
                            type="text"
                            value={settings.chatflow_phone_number ?? ''}
                            onChange={(e) => setSettings({ ...settings, chatflow_phone_number: e.target.value })}
                            placeholder="+77001234567"
                          />
                        </div>

                        <div className="admin-settings-block">
                          <div className="admin-settings-row">
                            <span className="admin-label" style={{ marginBottom: 0 }}>
                              Активен
                            </span>
                            <label className="admin-switch">
                              <input
                                type="checkbox"
                                checked={settings.chatflow_active !== false}
                                onChange={(e) => setSettings({ ...settings, chatflow_active: e.target.checked })}
                              />
                              <span className="admin-switch-track">
                                <span className="admin-switch-thumb" />
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {actionError && <div className="admin-alert admin-alert--error">{actionError}</div>}

                  <button
                    className="admin-btn admin-btn--primary"
                    type="button"
                    onClick={handleSaveWhatsApp}
                    disabled={actionStatus === 'loading'}
                  >
                    {actionStatus === 'loading' ? 'Сохраняю...' : 'Сохранить привязку'}
                  </button>
                </div>
              )}

              {/* READY STATE - AmoCRM Tab */}
              {settingsStatus === 'ready' && activeTab === 'amocrm' && (
                <div className="admin-settings-section">
                  {amoLoading ? (
                    <div className="admin-loading-panel">
                      <div className="admin-spinner" />
                      <p>Загрузка статуса...</p>
                    </div>
                  ) : (
                    <>
                      <div
                        className={`admin-status-box ${amoStatus?.connected ? 'admin-status-box--ok' : 'admin-status-box--warn'}`}
                      >
                        {amoStatus?.connected ? '✅ AmoCRM подключён' : '⚠️ AmoCRM не подключён'}
                      </div>

                      {amoStatus?.connected && (
                        <div className="admin-info-box">
                          <strong>Домен:</strong> {amoStatus.domain || '—'}
                          <br />
                          <strong>Истекает:</strong>{' '}
                          {amoStatus.expires_at ? new Date(amoStatus.expires_at).toLocaleString() : '—'}
                        </div>
                      )}

                      <div className="admin-settings-block">
                        <label className="admin-label">Домен AmoCRM</label>
                        <div className="admin-form-row-inline">
                          <input
                            className="admin-input"
                            type="text"
                            value={amoBaseDomain}
                            onChange={(e) => setAmoBaseDomain(e.target.value)}
                            placeholder="mycompany.amocrm.ru"
                          />
                          <button
                            className="admin-btn admin-btn--secondary"
                            type="button"
                            onClick={handleSaveAmoDomain}
                            disabled={actionStatus === 'loading'}
                          >
                            Сохранить
                          </button>
                        </div>
                        <div className="admin-settings-hint" style={{ marginTop: 4 }}>
                          Укажите домен вашего AmoCRM (без https://)
                        </div>
                      </div>

                      <div className="admin-btn-group">
                        <button
                          className="admin-btn admin-btn--primary"
                          type="button"
                          onClick={handleConnectAmo}
                          disabled={actionStatus === 'loading'}
                        >
                          {amoStatus?.connected ? 'Переподключить' : 'Подключить AmoCRM'}
                        </button>
                        <button
                          className="admin-btn admin-btn--ghost"
                          type="button"
                          onClick={handleRefreshAmoStatus}
                          disabled={amoLoading}
                        >
                          Обновить статус
                        </button>
                      </div>

                      {amoStatus?.connected && (
                        <div className="admin-settings-block" style={{ marginTop: 24 }}>
                          <label className="admin-label">Маппинг стадий</label>
                          <div className="admin-settings-hint" style={{ marginBottom: 12 }}>
                            Укажите ID стадий из вашей воронки AmoCRM для каждого статуса лида.
                          </div>
                          <table className="admin-mapping-table">
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
                                      className="admin-input"
                                      type="text"
                                      value={m.stage_id ?? ''}
                                      onChange={(e) => {
                                        const val = e.target.value.trim()
                                        setAmoMapping((prev) =>
                                          prev.map((x, j) => (j === i ? { ...x, stage_id: val || null } : x))
                                        )
                                      }}
                                      placeholder="ID стадии"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <button
                            className="admin-btn admin-btn--primary"
                            type="button"
                            onClick={handleSaveAmoMapping}
                            disabled={actionStatus === 'loading'}
                            style={{ marginTop: 12 }}
                          >
                            {actionStatus === 'loading' ? 'Сохраняю...' : 'Сохранить маппинг'}
                          </button>
                        </div>
                      )}

                      {actionError && (
                        <div className="admin-alert admin-alert--error" style={{ marginTop: 16 }}>
                          {actionError}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Users Modal */}
      {usersOpen && activeTenant && (
        <div className="admin-modal-backdrop" onClick={closeUsers}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Пользователи — {activeTenant.name}</h2>
              <button className="admin-modal-close" type="button" onClick={closeUsers}>
                ×
              </button>
            </div>
            <div className="admin-modal-body">
              {tenantUsersError && <div className="admin-alert admin-alert--error">{tenantUsersError}</div>}
              {tenantUsersStatus === 'loading' ? (
                <div className="admin-loading">Загрузка...</div>
              ) : tenantUsers.length === 0 && !tenantUsersError ? (
                <div className="admin-empty">Пользователей пока нет</div>
              ) : (
                <div className="admin-users-list">
                  {tenantUsers.map((u) => (
                    <div className="admin-user-item" key={u.id}>
                      <div className="admin-user-email">{u.email}</div>
                      <span className={`admin-badge ${u.role === 'admin' ? 'admin-badge--ok' : 'admin-badge--neutral'}`}>
                        {u.role === 'admin' ? 'Админ' : 'Менеджер'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="admin-divider" />

              <h3 className="admin-subtitle">Добавить пользователя</h3>
              <form onSubmit={handleAddUserSubmit}>
                <div className="admin-form-row">
                  <input
                    className="admin-input"
                    type="email"
                    value={addUserForm.email}
                    onChange={(e) => setAddUserForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="user@company.ru"
                    required
                  />
                  <select
                    className="admin-input"
                    value={addUserForm.role}
                    onChange={(e) => setAddUserForm((p) => ({ ...p, role: e.target.value as 'manager' | 'admin' }))}
                  >
                    <option value="manager">Менеджер</option>
                    <option value="admin">Админ</option>
                  </select>
                  <button className="admin-btn admin-btn--primary" type="submit" disabled={actionStatus === 'loading'}>
                    {actionStatus === 'loading' ? '...' : 'Добавить'}
                  </button>
                </div>
                {actionError && (
                  <div className="admin-alert admin-alert--error" style={{ marginTop: 12 }}>
                    {actionError}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Self-Check Modal */}
      {checkOpen && activeTenant && (
        <div className="admin-modal-backdrop" onClick={closeCheck}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Проверка — {activeTenant.name}</h2>
              <button className="admin-modal-close" type="button" onClick={closeCheck}>
                ×
              </button>
            </div>
            <div className="admin-modal-body">
              {checkLoading && (
                <div className="admin-loading-panel">
                  <div className="admin-spinner" />
                  <p>Проверяем настройки...</p>
                </div>
              )}

              {!checkLoading && checkResult && (
                <>
                  <div
                    className={`admin-status-box ${checkResult.all_ok ? 'admin-status-box--ok' : 'admin-status-box--warn'}`}
                    style={{ marginBottom: 16 }}
                  >
                    {checkResult.all_ok ? '✅ Все проверки пройдены!' : '⚠️ Есть проблемы — см. ниже'}
                  </div>

                  <div className="admin-check-list">
                    {checkResult.checks.map((c) => (
                      <div
                        key={c.key}
                        className={`admin-check-item ${c.ok ? 'admin-check-item--ok' : 'admin-check-item--error'}`}
                      >
                        <div className="admin-check-icon">{c.ok ? '✅' : '❌'}</div>
                        <div className="admin-check-content">
                          <div className="admin-check-label">{c.label || c.key}</div>
                          {c.message && <div className="admin-check-message">{c.message}</div>}
                          {!c.message && !c.ok && <div className="admin-check-message">Требуется настройка</div>}
                        </div>
                        {c.action && !c.ok && (
                          <button
                            className="admin-btn admin-btn--sm admin-btn--secondary"
                            type="button"
                            onClick={() => handleCheckAction(c.action!)}
                          >
                            Исправить
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminTenants
