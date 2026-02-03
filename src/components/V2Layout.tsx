import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const V2Layout = () => {
  const { userRole, isAdmin } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const showFullMenu = isAdmin || userRole === 'owner' || userRole === 'rop'

  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return
    root.classList.add('v2-route')
    return () => {
      root.classList.remove('v2-route')
    }
  }, [])

  return (
    <div className="v2-layout">
      <button
        type="button"
        className="v2-burger"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-label="Меню"
        aria-expanded={sidebarOpen}
      >
        <span className="v2-burger-bar" />
        <span className="v2-burger-bar" />
        <span className="v2-burger-bar" />
      </button>
      {sidebarOpen && (
        <div
          className="v2-sidebar-backdrop"
          role="presentation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`v2-sidebar ${sidebarOpen ? 'v2-sidebar--open' : ''}`}>
        <nav className="v2-sidebar-nav">
          <NavLink
            to="/v2/leads-table"
            className={({ isActive }) => `v2-sidebar-link ${isActive ? 'v2-sidebar-link--active' : ''}`}
            end
            onClick={() => setSidebarOpen(false)}
          >
            Лиды
          </NavLink>
          {showFullMenu && (
            <>
              <NavLink
                to="/admin/users"
                className={({ isActive }) => `v2-sidebar-link ${isActive ? 'v2-sidebar-link--active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                Пользователи
              </NavLink>
              <NavLink
                to="/admin/tenants"
                className={({ isActive }) => `v2-sidebar-link ${isActive ? 'v2-sidebar-link--active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                Клиенты
              </NavLink>
              <NavLink
                to="/profile"
                className={({ isActive }) => `v2-sidebar-link ${isActive ? 'v2-sidebar-link--active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                Настройки
              </NavLink>
            </>
          )}
          {!showFullMenu && (
            <NavLink
              to="/profile"
              className={({ isActive }) => `v2-sidebar-link ${isActive ? 'v2-sidebar-link--active' : ''}`}
              onClick={() => setSidebarOpen(false)}
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
