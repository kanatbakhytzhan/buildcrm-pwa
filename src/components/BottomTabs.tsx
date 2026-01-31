import { NavLink } from 'react-router-dom'
import { LayoutList, User } from 'lucide-react'
import { useLeads } from '../context/LeadsContext'

const NOTIFICATIONS_KEY = 'buildcrm_notifications_enabled'

const BottomTabs = () => {
  const { leads } = useLeads()
  const newCount = leads.filter((l) => l.status === 'new').length
  const notificationsEnabled =
    typeof window !== 'undefined' && localStorage.getItem(NOTIFICATIONS_KEY) !== 'false'

  const showNewBadge = notificationsEnabled && newCount > 0

  return (
    <nav className="bottom-tabs">
      <NavLink
        to="/leads"
        className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
      >
        <span className="tab-pill">
          <span className="tab-icon tab-icon--with-badge" aria-hidden="true">
            <LayoutList size={22} />
            {showNewBadge && (
              <span className="tab-badge" aria-label={`Новых заявок: ${newCount}`}>
                {newCount > 99 ? '99+' : newCount}
              </span>
            )}
          </span>
          <span className="tab-label">Заявки</span>
        </span>
      </NavLink>
      <NavLink
        to="/profile"
        className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
      >
        <span className="tab-pill">
          <span className="tab-icon" aria-hidden="true">
            <User size={22} />
          </span>
          <span className="tab-label">Профиль</span>
        </span>
      </NavLink>
    </nav>
  )
}

export default BottomTabs
