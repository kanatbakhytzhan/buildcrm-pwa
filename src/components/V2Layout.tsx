import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { V2RealtimeProvider } from '../context/V2RealtimeContext'
import NotificationsBell from './NotificationsBell'

const V2Layout = () => {
  const { userRole, isAdmin } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [realtimeToast, setRealtimeToast] = useState<string | null>(null)
  const isRop = userRole === 'rop'
  const showFullMenu = isAdmin || userRole === 'owner'
  const showUsersMenu = showFullMenu || isRop
  const showV3 = showFullMenu || isRop

  const onNewLeadToast = useCallback((message: string) => {
    setRealtimeToast(message)
  }, [])

  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return
    root.classList.add('v2-route')
    return () => {
      root.classList.remove('v2-route')
    }
  }, [])

  useEffect(() => {
    if (!realtimeToast) return
    const t = setTimeout(() => setRealtimeToast(null), 4000)
    return () => clearTimeout(t)
  }, [realtimeToast])

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
            onClick={() => setSidebarOpen(false)}
          >
            Таблица
          </NavLink>
          <NavLink
            to="/v2/pipeline"
            className={({ isActive }) => `v2-sidebar-link ${isActive ? 'v2-sidebar-link--active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            Воронка
          </NavLink>
          <NavLink
            to="/v2/tasks"
            className={({ isActive }) => `v2-sidebar-link ${isActive ? 'v2-sidebar-link--active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            Задачи
          </NavLink>
          {showUsersMenu && (
            <NavLink
              to="/admin/users"
              className={({ isActive }) => `v2-sidebar-link ${isActive ? 'v2-sidebar-link--active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              Пользователи
            </NavLink>
          )}
          {showV3 && (
            <>
              <NavLink
                to="/v3/reports"
                className={({ isActive }) => `v2-sidebar-link ${isActive ? 'v2-sidebar-link--active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                Отчёты
              </NavLink>
              <NavLink
                to="/v3/import"
                className={({ isActive }) => `v2-sidebar-link ${isActive ? 'v2-sidebar-link--active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                Импорт
              </NavLink>
              <NavLink
                to="/v3/auto-assign"
                className={({ isActive }) => `v2-sidebar-link ${isActive ? 'v2-sidebar-link--active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                Автоназначение
              </NavLink>
            </>
          )}
          {showFullMenu && (
            <>
              <NavLink
                to="/admin/diagnostics"
                className={({ isActive }) => `v2-sidebar-link ${isActive ? 'v2-sidebar-link--active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                Диагностика
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
        <div className="v2-main-header">
          <NotificationsBell />
        </div>
        <div className="v2-main-content">
          <V2RealtimeProvider onNewLeadToast={onNewLeadToast}>
            <Outlet />
          </V2RealtimeProvider>
        </div>
      </main>
      {realtimeToast && (
        <div className="v2-toast" role="status" style={{ position: 'fixed' }}>
          {realtimeToast}
        </div>
      )}
    </div>
  )
}

export default V2Layout
