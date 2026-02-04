import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { CRM_V2_ENABLED } from '../config/appConfig'
import '../admin.css' // Import desktop admin styles

const AdminLayout = () => {
  const navigate = useNavigate()
  const { logout, userRole, isAdmin } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/admin/login')
  }

  // Apply admin-body class to body
  useEffect(() => {
    document.body.classList.add('admin-body')
    return () => document.body.classList.remove('admin-body')
  }, [])

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: 0 }}>BuildCRM</h2>
          <span style={{ fontSize: 12, opacity: 0.5 }}>Admin Console</span>
        </div>

        <nav className="admin-sidebar-menu">
          <NavLink
            to="/admin/tenants"
            className={({ isActive }) => `admin-menu-item ${isActive ? 'active' : ''}`}
          >
            <span>🏢</span>
            <span>Клиенты</span>
          </NavLink>
          <NavLink
            to="/admin/users"
            className={({ isActive }) => `admin-menu-item ${isActive ? 'active' : ''}`}
          >
            <span>👥</span>
            <span>Пользователи</span>
          </NavLink>
          <NavLink
            to="/admin/check"
            className={({ isActive }) => `admin-menu-item ${isActive ? 'active' : ''}`}
          >
            <span>🔧</span>
            <span>Диагностика</span>
          </NavLink>
          {CRM_V2_ENABLED && (
            <NavLink
              to="/v2/leads-table"
              className={({ isActive }) => `admin-menu-item ${isActive ? 'active' : ''}`}
            >
              <span>📋</span>
              <span>CRM Лиды</span>
            </NavLink>
          )}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 14, color: 'white', marginBottom: 8 }}>
            {isAdmin ? 'Administrator' : userRole}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0, fontSize: 13 }}
          >
            Выйти
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}

export default AdminLayout
