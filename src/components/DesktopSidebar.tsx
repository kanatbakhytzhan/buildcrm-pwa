import { NavLink } from 'react-router-dom'
import { ClipboardList, User, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './DesktopSidebar.css'

export const DesktopSidebar = () => {
    const { logout, userRole } = useAuth()

    const handleLogout = () => {
        logout()
    }

    return (
        <aside className="desktop-sidebar">
            <div className="desktop-sidebar__header">
                <h2 className="desktop-sidebar__title">BuildCRM</h2>
                <span className="desktop-sidebar__subtitle">Управление заявками</span>
            </div>

            <nav className="desktop-sidebar__nav">
                <NavLink
                    to="/leads"
                    className={({ isActive }) =>
                        `desktop-sidebar__link ${isActive ? 'desktop-sidebar__link--active' : ''}`
                    }
                >
                    <ClipboardList size={20} />
                    <span>Заявки</span>
                </NavLink>

                <NavLink
                    to="/profile"
                    className={({ isActive }) =>
                        `desktop-sidebar__link ${isActive ? 'desktop-sidebar__link--active' : ''}`
                    }
                >
                    <User size={20} />
                    <span>Профиль</span>
                </NavLink>
            </nav>

            <div className="desktop-sidebar__footer">
                <div className="desktop-sidebar__user">
                    <span className="desktop-sidebar__user-role">{userRole || 'Пользователь'}</span>
                </div>
                <button onClick={handleLogout} className="desktop-sidebar__logout">
                    <LogOut size={18} />
                    <span>Выйти</span>
                </button>
            </div>
        </aside>
    )
}
