import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLeads } from '../context/LeadsContext'

const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const { isAdmin } = useAuth()
  const { outboxCount } = useLeads()

  useEffect(() => {
    const handleOffline = () => setIsOffline(true)
    const handleOnline = () => setIsOffline(false)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (!isOffline) {
    return null
  }

  return (
    <div className="offline-banner" role="status">
      Офлайн режим: показаны сохранённые данные
      {isAdmin && outboxCount > 0 ? ` · В очереди: ${outboxCount}` : ''}
    </div>
  )
}

export default OfflineBanner
