import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { CRM_V2_ENABLED } from '../config/appConfig'

const AdminLayout = () => {
  const navigate = useNavigate()
  const { logout, userRole, isAdmin } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/admin/login')
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <span className="admin-logo-text">BuildCRM</span>
          <span className="admin-logo-badge">Admin</span>
        </div>
        <nav className="admin-sidebar-nav">
          <NavLink
            to="/admin/tenants"
            className={({ isActive }) => `admin-nav-link ${isActive ? 'admin-nav-link--active' : ''}`}
          >
            <span className="admin-nav-icon">🏢</span>
            Клиенты
          </NavLink>
          <NavLink
            to="/admin/users"
            className={({ isActive }) => `admin-nav-link ${isActive ? 'admin-nav-link--active' : ''}`}
          >
            <span className="admin-nav-icon">👥</span>
            Пользователи
          </NavLink>
          <NavLink
            to="/admin/check"
            className={({ isActive }) => `admin-nav-link ${isActive ? 'admin-nav-link--active' : ''}`}
          >
            <span className="admin-nav-icon">🔧</span>
            Диагностика
          </NavLink>
          {CRM_V2_ENABLED && (
            <NavLink
              to="/v2/leads-table"
              className={({ isActive }) => `admin-nav-link ${isActive ? 'admin-nav-link--active' : ''}`}
            >
              <span className="admin-nav-icon">📋</span>
              CRM Лиды
            </NavLink>
          )}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-user-info">
            <span className="admin-user-role">{isAdmin ? 'Admin' : userRole}</span>
          </div>
          <button className="admin-logout-btn" type="button" onClick={handleLogout}>
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
