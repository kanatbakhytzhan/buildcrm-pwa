import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const V2Layout = () => {
  const { userRole, isAdmin } = useAuth()
  const showFullMenu = isAdmin || userRole === 'owner' || userRole === 'rop'

  return (
    <div className="v2-layout">
      <aside className="v2-sidebar">
        <nav className="v2-sidebar-nav">
          <NavLink
            to="/v2/leads-table"
            className={({ isActive }) => `v2-sidebar-link ${isActive ? 'v2-sidebar-link--active' : ''}`}
            end
          >
            Лиды
          </NavLink>
          {showFullMenu && (
            <>
              <NavLink
                to="/admin/users"
                className={({ isActive }) => `v2-sidebar-link ${isActive ? 'v2-sidebar-link--active' : ''}`}
              >
                Пользователи
              </NavLink>
              <NavLink
                to="/admin/tenants"
                className={({ isActive }) => `v2-sidebar-link ${isActive ? 'v2-sidebar-link--active' : ''}`}
              >
                Клиенты
              </NavLink>
              <NavLink
                to="/profile"
                className={({ isActive }) => `v2-sidebar-link ${isActive ? 'v2-sidebar-link--active' : ''}`}
              >
                Настройки
              </NavLink>
            </>
          )}
          {!showFullMenu && (
            <NavLink
              to="/profile"
              className={({ isActive }) => `v2-sidebar-link ${isActive ? 'v2-sidebar-link--active' : ''}`}
            >
              Профиль
            </NavLink>
          )}
        </nav>
      </aside>
      <main className="v2-main">
        <Outlet />
      </main>
    </div>
  )
}

export default V2Layout
