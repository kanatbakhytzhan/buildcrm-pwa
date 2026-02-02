import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Flame, MessageCircle, RefreshCw, LogOut, ChevronRight, Lock, Inbox } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLeads } from '../context/LeadsContext'
import { changePassword, getMyAiSettings, updateMyAiSettings } from '../services/api'
import type { OutboxEntry } from '../services/offlineDb'

const NOTIFICATIONS_KEY = 'buildcrm_notifications_enabled'
const PROFILE_EMAIL_KEY = 'buildcrm_profile_email'
const PROFILE_COMPANY_KEY = 'buildcrm_profile_company'

function outboxLabel(entry: OutboxEntry): string {
  if (entry.type === 'PATCH_STATUS') {
    return `Обновление статуса лида #${entry.leadId}`
  }
  return `Удаление лида #${entry.leadId}`
}

function outboxMethodUrl(entry: OutboxEntry): string {
  if (entry.type === 'PATCH_STATUS') return `PATCH /api/leads/${entry.leadId}`
  return `DELETE /api/leads/${entry.leadId}`
}

const Profile = () => {
  const navigate = useNavigate()
  const { logout, isAdmin } = useAuth()
  const {
    outboxCount,
    syncOutbox,
    showToast,
    getOutboxItems,
    clearOutbox,
  } = useLeads()
  const [changePwdOpen, setChangePwdOpen] = useState(false)
  const [outboxOpen, setOutboxOpen] = useState(false)
  const [outboxItems, setOutboxItems] = useState<OutboxEntry[]>([])
  const [outboxLoading, setOutboxLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<{ stoppedByAuth?: boolean } | null>(null)
  const [changePwdForm, setChangePwdForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [changePwdLoading, setChangePwdLoading] = useState(false)
  const [changePwdError, setChangePwdError] = useState<string | null>(null)
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY)
    return stored === null ? true : stored === 'true'
  })
  const [aiEnabled, setAiEnabled] = useState(true)
  const [aiSettingsLoading, setAiSettingsLoading] = useState(false)
  const [aiToggleLoading, setAiToggleLoading] = useState(false)

  const handleNotificationsChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.checked
    localStorage.setItem(NOTIFICATIONS_KEY, String(nextValue))
    setNotificationsEnabled(nextValue)
  }

  const subtitle = useMemo(() => {
    const company = localStorage.getItem(PROFILE_COMPANY_KEY)
    if (company) {
      return company
    }
    const email = localStorage.getItem(PROFILE_EMAIL_KEY)
    return email || 'Менеджер'
  }, [])
  const displayName = subtitle.includes('@')
    ? subtitle.split('@')[0]
    : subtitle
  const initials = displayName
    ? displayName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('')
    : 'П'

  const handleSupport = () => {
    window.location.href = 'https://wa.me/77768776637'
  }

  const closeChangePwd = () => {
    setChangePwdOpen(false)
    setChangePwdForm({ current_password: '', new_password: '', confirm_password: '' })
    setChangePwdError(null)
  }

  const loadOutboxItems = useCallback(async () => {
    const items = await getOutboxItems()
    setOutboxItems(items)
  }, [getOutboxItems])

  useEffect(() => {
    if (outboxOpen) {
      loadOutboxItems()
    }
  }, [outboxOpen, loadOutboxItems])

  useEffect(() => {
    let active = true
    setAiSettingsLoading(true)
    getMyAiSettings()
      .then((res) => {
        if (active) setAiEnabled(res.ai_enabled)
      })
      .catch(() => {
        if (active) setAiEnabled(true)
      })
      .finally(() => {
        if (active) setAiSettingsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const handleAiToggle = async (nextEnabled: boolean) => {
    const prev = aiEnabled
    setAiToggleLoading(true)
    setAiEnabled(nextEnabled)
    try {
      await updateMyAiSettings(nextEnabled)
      showToast('Сохранено')
    } catch (err) {
      setAiEnabled(prev)
      const msg = err instanceof Error ? err.message : 'Ошибка сохранения'
      showToast(msg)
    } finally {
      setAiToggleLoading(false)
    }
  }

  const handleRetrySync = async () => {
    setOutboxLoading(true)
    setSyncResult(null)
    try {
      const result = await syncOutbox()
      setSyncResult({ stoppedByAuth: result.stoppedByAuth })
      if (result.stoppedByAuth) {
        showToast('Нужно перезайти')
      } else if (result.processed > 0 && result.failed === 0) {
        showToast('Отправка выполнена')
      }
      await loadOutboxItems()
    } finally {
      setOutboxLoading(false)
    }
  }

  const handleClearOutbox = () => {
    if (!window.confirm('Очистить всю очередь? Неотправленные действия будут удалены.')) return
    setOutboxLoading(true)
    clearOutbox()
      .then(() => {
        showToast('Очередь очищена')
        setOutboxOpen(false)
        loadOutboxItems()
      })
      .finally(() => setOutboxLoading(false))
  }

  const handleChangePwdSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setChangePwdError(null)
    if (changePwdForm.new_password !== changePwdForm.confirm_password) {
      setChangePwdError('Новый пароль и подтверждение не совпадают')
      return
    }
    if (changePwdForm.new_password.length < 6) {
      setChangePwdError('Новый пароль не менее 6 символов')
      return
    }
    setChangePwdLoading(true)
    try {
      await changePassword({
        current_password: changePwdForm.current_password,
        new_password: changePwdForm.new_password,
      })
      showToast('Пароль изменён')
      closeChangePwd()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось сменить пароль'
      setChangePwdError(msg)
    } finally {
      setChangePwdLoading(false)
    }
  }

  return (
    <div className="page-stack profile-page">
      <div className="profile-header-block">
        <h1 className="title profile-title">Профиль</h1>
        <div className="profile-card profile-card--center">
          <div className="profile-avatar">{initials}</div>
          <div className="profile-info">
            <div className="profile-name-row">
              <div className="profile-name">{displayName || 'Менеджер'}</div>
              <div className="profile-pro">PRO</div>
            </div>
            <div className="profile-subtitle">{subtitle}</div>
          </div>
        </div>
      </div>
      <div className="card settings-card">
        <div className="settings-row settings-row--static">
          <div className="settings-left">
            <div className="settings-icon settings-icon--primary" aria-hidden="true">
              <Bell size={20} />
            </div>
            <div className="settings-text">
              <div className="settings-title">Уведомления</div>
              <div className="settings-hint">
                Новые заявки будут приходить мгновенно
              </div>
            </div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              aria-label="Уведомления о заявках"
              checked={notificationsEnabled}
              onChange={handleNotificationsChange}
            />
            <span className="switch-track">
              <span className="switch-thumb" />
            </span>
          </label>
        </div>
        <button
          className="settings-row settings-row--tap"
          type="button"
          onClick={() => navigate('/hot')}
        >
          <div className="settings-left">
            <div className="settings-icon settings-icon--primary" aria-hidden="true">
              <Flame size={20} />
            </div>
            <div className="settings-text">
              <div className="settings-title">Горячие лиды</div>
              <div className="settings-hint">Лиды старше 24 часов</div>
            </div>
          </div>
          <ChevronRight size={20} className="settings-chevron" />
        </button>
        <button
          className="settings-row settings-row--tap"
          type="button"
          onClick={handleSupport}
        >
          <div className="settings-left">
            <div className="settings-icon settings-icon--primary" aria-hidden="true">
              <MessageCircle size={20} />
            </div>
            <div className="settings-text">
              <div className="settings-title">Техподдержка</div>
              <div className="settings-hint">Ответим в WhatsApp</div>
            </div>
          </div>
          <ChevronRight size={20} className="settings-chevron" />
        </button>
        <button
          className="settings-row settings-row--tap"
          type="button"
          onClick={() => setChangePwdOpen(true)}
        >
          <div className="settings-left">
            <div className="settings-icon settings-icon--primary" aria-hidden="true">
              <Lock size={20} />
            </div>
            <div className="settings-text">
              <div className="settings-title">Сменить пароль</div>
              <div className="settings-hint">Текущий и новый пароль</div>
            </div>
          </div>
          <ChevronRight size={20} className="settings-chevron" />
        </button>
      </div>
      <div className="card settings-card">
        <div className="card-title" style={{ marginBottom: 8 }}>AI-менеджер</div>
        <div className="settings-row settings-row--static">
          <div className="settings-left">
            <div className="settings-text">
              <div className="settings-title">
                {aiEnabled ? 'Включён' : 'Выключен'}
              </div>
              <div className="settings-hint">
                Когда выключено — бот не отвечает автоматически, но лиды продолжают сохраняться.
              </div>
            </div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              aria-label="AI-менеджер"
              checked={aiEnabled}
              disabled={aiSettingsLoading || aiToggleLoading}
              onChange={(e) => handleAiToggle(e.target.checked)}
            />
            <span className="switch-track">
              <span className="switch-thumb" />
            </span>
          </label>
        </div>
        <div className="ai-manager-hint info-text" style={{ marginTop: 10, fontSize: 12 }}>
          Чтобы выключить AI только для одного чата — отправьте в WhatsApp команду: /stop
          <br />
          Чтобы включить обратно: /start
        </div>
      </div>
      {isAdmin && (
        <>
          <button
            className="settings-row settings-row--tap"
            type="button"
            onClick={() => setOutboxOpen(true)}
          >
            <div className="settings-left">
              <div className="settings-icon settings-icon--primary" aria-hidden="true">
                <Inbox size={20} />
              </div>
              <div className="settings-text">
                <div className="settings-title">Очередь изменений</div>
                <div className="settings-hint">
                  {outboxCount > 0 ? `В очереди: ${outboxCount} действий` : 'Просмотр и отправка'}
                </div>
              </div>
            </div>
            <ChevronRight size={20} className="settings-chevron" />
          </button>
          {outboxCount > 0 && (
            <button
              className="sync-outbox-block"
              type="button"
              onClick={syncOutbox}
            >
              <RefreshCw size={20} className="sync-outbox-icon" aria-hidden="true" />
              <div className="sync-outbox-text">
                <span className="sync-outbox-title">Отправить изменения</span>
                <span className="sync-outbox-hint">В очереди: {outboxCount} действий</span>
              </div>
            </button>
          )}
        </>
      )}
      <button className="logout-card" type="button" onClick={() => logout()}>
        <LogOut size={20} className="logout-icon" aria-hidden="true" />
        Выйти из аккаунта
      </button>

      {isAdmin && outboxOpen && (
        <div className="dialog-backdrop" onClick={() => setOutboxOpen(false)}>
          <div className="dialog admin-dialog-wide" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Очередь изменений</div>
            {syncResult?.stoppedByAuth && (
              <div className="error-text" style={{ marginBottom: 8 }}>
                Нужно перезайти. Выйдите и войдите снова.
              </div>
            )}
            {outboxItems.length === 0 ? (
              <div className="info-text">Очередь пуста</div>
            ) : (
              <ul className="outbox-list">
                {outboxItems.map((entry) => (
                  <li key={entry.id ?? entry.leadId + String(entry.createdAt)} className="outbox-item">
                    <div className="outbox-item-label">{outboxLabel(entry)}</div>
                    <div className="outbox-item-meta">{outboxMethodUrl(entry)}</div>
                    <div className="outbox-item-meta">
                      {new Date(entry.createdAt).toLocaleString('ru')}
                      {entry.attempts > 0 && ` · попыток: ${entry.attempts}`}
                    </div>
                    {entry.lastError && (
                      <div className="error-text outbox-item-error">{entry.lastError}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="dialog-actions" style={{ marginTop: 16 }}>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setOutboxOpen(false)}
              >
                Закрыть
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={handleRetrySync}
                disabled={outboxLoading || outboxItems.length === 0}
              >
                {outboxLoading ? 'Отправка…' : 'Повторить отправку сейчас'}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={handleClearOutbox}
                disabled={outboxLoading || outboxItems.length === 0}
              >
                Очистить очередь
              </button>
            </div>
          </div>
        </div>
      )}

      {changePwdOpen && (
        <div className="dialog-backdrop" onClick={closeChangePwd}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Сменить пароль</div>
            <form className="form-grid" onSubmit={handleChangePwdSubmit}>
              <label className="field">
                <span className="field-label">Текущий пароль</span>
                <input
                  className="field-input"
                  type="password"
                  value={changePwdForm.current_password}
                  onChange={(e) =>
                    setChangePwdForm((p) => ({ ...p, current_password: e.target.value }))
                  }
                  placeholder="Введите текущий пароль"
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Новый пароль</span>
                <input
                  className="field-input"
                  type="password"
                  value={changePwdForm.new_password}
                  onChange={(e) =>
                    setChangePwdForm((p) => ({ ...p, new_password: e.target.value }))
                  }
                  placeholder="Введите новый пароль"
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Подтверждение пароля</span>
                <input
                  className="field-input"
                  type="password"
                  value={changePwdForm.confirm_password}
                  onChange={(e) =>
                    setChangePwdForm((p) => ({ ...p, confirm_password: e.target.value }))
                  }
                  placeholder="Повторите новый пароль"
                  required
                />
              </label>
              {changePwdError && <div className="error-text">{changePwdError}</div>}
              <div className="dialog-actions">
                <button className="ghost-button" type="button" onClick={closeChangePwd}>
                  Отмена
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={changePwdLoading}
                >
                  {changePwdLoading ? 'Сохраняю…' : 'Сменить пароль'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Profile
