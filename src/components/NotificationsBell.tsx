import { useCallback, useEffect, useRef, useState } from 'react'
import { getNotifications, markNotificationsRead, type AppNotification } from '../services/api'

export default function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [readLoading, setReadLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getNotifications(true)
      setList(Array.isArray(data) ? data : [])
    } catch {
      setList([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const handleMarkRead = async () => {
    setReadLoading(true)
    try {
      await markNotificationsRead()
      setList([])
    } catch {
      // ignore
    } finally {
      setReadLoading(false)
    }
  }

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('click', onOutside)
    return () => document.removeEventListener('click', onOutside)
  }, [open])

  const count = list.length

  return (
    <div className="v2-notifications" ref={ref}>
      <button
        type="button"
        className="v2-notifications-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-label="Уведомления"
        title="Уведомления"
      >
        🔔
        {count > 0 && (
          <span className="v2-notifications-badge">{count > 99 ? '99+' : count}</span>
        )}
      </button>
      {open && (
        <div className="v2-notifications-dropdown">
          <div className="v2-notifications-dropdown-header">
            <span>Уведомления</span>
            {count > 0 && (
              <button
                type="button"
                className="ghost-button"
                disabled={readLoading}
                onClick={handleMarkRead}
              >
                {readLoading ? '…' : 'Отметить всё прочитанным'}
              </button>
            )}
          </div>
          {loading ? (
            <div className="info-text" style={{ padding: 12 }}>Загрузка…</div>
          ) : list.length === 0 ? (
            <div className="info-text" style={{ padding: 12 }}>Нет непрочитанных</div>
          ) : (
            <ul className="v2-notifications-list">
              {list.slice(0, 20).map((n) => (
                <li key={n.id} className="v2-notifications-item">
                  <div className="v2-notifications-item-title">{n.title || 'Уведомление'}</div>
                  {n.body && <div className="v2-notifications-item-body">{n.body}</div>}
                </li>
              ))}
              {list.length > 20 && (
                <li className="info-text" style={{ padding: 8 }}>… ещё {list.length - 20}</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
