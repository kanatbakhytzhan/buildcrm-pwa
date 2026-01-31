import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Flame, MessageCircle, RefreshCw, LogOut, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLeads } from '../context/LeadsContext'

const NOTIFICATIONS_KEY = 'buildcrm_notifications_enabled'
const PROFILE_EMAIL_KEY = 'buildcrm_profile_email'
const PROFILE_COMPANY_KEY = 'buildcrm_profile_company'

const Profile = () => {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { outboxCount, syncOutbox } = useLeads()
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY)
    return stored === null ? true : stored === 'true'
  })

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
      </div>
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
      <button className="logout-card" type="button" onClick={() => logout()}>
        <LogOut size={20} className="logout-icon" aria-hidden="true" />
        Выйти из аккаунта
      </button>
    </div>
  )
}

export default Profile
