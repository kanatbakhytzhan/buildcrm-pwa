import { Navigate, Route, Routes } from 'react-router-dom'
import { Outlet } from 'react-router-dom'
import BottomTabs from './components/BottomTabs'
import OfflineBanner from './components/OfflineBanner'
import Toast from './components/Toast'
import { DesktopSidebar } from './components/DesktopSidebar'
import { useAuth } from './context/AuthContext'
import { useLeads } from './context/LeadsContext'
import { useBreakpoint } from './hooks/useBreakpoint'
import HotLeads from './pages/HotLeads'
import LeadDetails from './pages/LeadDetails'
import Leads from './pages/Leads'
import Login from './pages/Login'
import Profile from './pages/Profile'
import AdminLogin from './pages/AdminLogin'
import AdminUsers from './pages/AdminUsers'
import AdminTenants from './pages/AdminTenants'
import AdminCheck from './pages/AdminCheck'
import LeadsTableV2 from './pages/LeadsTableV2'
import PipelinePage from './pages/PipelinePage'
import TasksPage from './pages/TasksPage'
import ReportsPage from './pages/v3/ReportsPage'
import ImportPage from './pages/v3/ImportPage'
import AutoAssignPage from './pages/v3/AutoAssignPage'
import V2Layout from './components/V2Layout'
import AdminLayout from './components/AdminLayout'
import { CRM_V2_ENABLED } from './config/appConfig'

const AppLayout = () => {
  const { toastMessage, clearToast } = useLeads()
  const { isDesktop } = useBreakpoint()

  return (
    <div className="app-shell" style={{ flexDirection: isDesktop ? 'row' : 'column' }}>
      <OfflineBanner />
      {isDesktop && <DesktopSidebar />}
      <main className="app-content" style={{
        paddingBottom: isDesktop ? 'var(--space-6)' : 'calc(100px + env(safe-area-inset-bottom, 0))'
      }}>
        <Outlet />
      </main>
      {toastMessage && <Toast message={toastMessage} onClose={clearToast} />}
      {!isDesktop && <BottomTabs />}
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
      {/* Admin routes with desktop sidebar layout */}
      <Route element={<RequireAdminAuth />}>
        <Route path="/admin/tenants" element={<AdminTenants />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/check" element={<AdminCheck />} />
        {CRM_V2_ENABLED && (
          <>
            <Route path="/v2" element={<V2Layout />}>
              <Route path="leads-table" element={<LeadsTableV2 />} />
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="tasks" element={<TasksPage />} />
            </Route>
            <Route path="/v3" element={<V2Layout />}>
              <Route path="reports" element={<ReportsPage />} />
              <Route path="import" element={<ImportPage />} />
              <Route path="auto-assign" element={<AutoAssignPage />} />
            </Route>
          </>
        )}
      </Route>
    </Routes>
  )
}

export default App
