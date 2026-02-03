import { Navigate, Route, Routes } from 'react-router-dom'
import { Outlet } from 'react-router-dom'
import BottomTabs from './components/BottomTabs'
import OfflineBanner from './components/OfflineBanner'
import Toast from './components/Toast'
import { useAuth } from './context/AuthContext'
import { useLeads } from './context/LeadsContext'
import HotLeads from './pages/HotLeads'
import LeadDetails from './pages/LeadDetails'
import Leads from './pages/Leads'
import Login from './pages/Login'
import Profile from './pages/Profile'
import AdminLogin from './pages/AdminLogin'
import AdminUsers from './pages/AdminUsers'
import AdminTenants from './pages/AdminTenants'
import LeadsTableV2 from './pages/LeadsTableV2'
import { CRM_V2_ENABLED } from './config/appConfig'

const AppLayout = () => {
  const { toastMessage, clearToast } = useLeads()
  return (
    <div className="app-shell">
      <OfflineBanner />
      <main className="app-content">
        <Outlet />
      </main>
      {toastMessage && <Toast message={toastMessage} onClose={clearToast} />}
      <BottomTabs />
    </div>
  )
}

const RequireAuth = () => {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <AppLayout />
}

const AdminLayout = () => {
  return (
    <div className="app-shell">
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  )
}

const RequireAdminAuth = () => {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />
  }
  return <AdminLayout />
}

const App = () => {
  const { isAuthenticated } = useAuth()
  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={isAuthenticated ? '/leads' : '/login'} replace />}
      />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/leads" replace /> : <Login />}
      />
      <Route
        path="/admin/login"
        element={
          isAuthenticated ? <Navigate to="/admin/users" replace /> : <AdminLogin />
        }
      />
      <Route element={<RequireAuth />}>
        <Route path="/leads" element={<Leads />} />
        <Route path="/leads/:id" element={<LeadDetails />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/hot" element={<HotLeads />} />
      </Route>
      <Route element={<RequireAdminAuth />}>
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/tenants" element={<AdminTenants />} />
        {CRM_V2_ENABLED && (
          <Route path="/v2/leads-table" element={<LeadsTableV2 />} />
        )}
      </Route>
    </Routes>
  )
}

export default App
