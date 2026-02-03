import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { completeTask, getTasks, type LeadTask } from '../services/api'

type Tab = 'today' | 'overdue' | 'week'

function formatDue(s: string): string {
  try {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return s
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return s
  }
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'today', label: 'Сегодня' },
  { key: 'overdue', label: 'Просрочено' },
  { key: 'week', label: 'Неделя' },
]

const TasksPage = () => {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('today')
  const [tasks, setTasks] = useState<LeadTask[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [completingId, setCompletingId] = useState<string | number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getTasks(tab)
      setTasks(Array.isArray(list) ? list : [])
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const handleComplete = async (task: LeadTask) => {
    setCompletingId(task.id)
    try {
      await completeTask(task.id)
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
      setToast('Готово')
    } catch {
      setToast('Не удалось отметить')
    } finally {
      setCompletingId(null)
    }
  }

  const handleOpenLead = (task: LeadTask) => {
    navigate(`/leads/${task.lead_id}`)
  }

  return (
    <div className="page-stack v2-tasks-page">
      <div className="page-header v2-leads-header">
        <h1 className="title">Задачи</h1>
        <button type="button" className="ghost-button" onClick={load} disabled={loading}>
          Обновить
        </button>
      </div>
      <div className="v2-tasks-tabs">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`v2-tasks-tab ${tab === key ? 'v2-tasks-tab--active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {toast && <div className="v2-toast" role="status">{toast}</div>}
      <div className="card">
        {loading ? (
          <div className="info-text">Загрузка…</div>
        ) : tasks.length === 0 ? (
          <div className="info-text">Нет задач</div>
        ) : (
          <ul className="v2-tasks-list">
            {tasks.map((task) => (
              <li key={task.id} className="v2-tasks-item">
                <div className="v2-tasks-item-main">
                  <span className="v2-tasks-item-type">Звонок</span>
                  <span className="v2-tasks-item-name">{task.lead_name || `Лид #${task.lead_id}`}</span>
                  <span className="v2-tasks-item-due">{formatDue(task.due_at)}</span>
                </div>
                <div className="v2-tasks-item-actions">
                  <button
                    type="button"
                    className="primary-button v2-tasks-btn"
                    disabled={completingId === task.id}
                    onClick={() => handleComplete(task)}
                  >
                    {completingId === task.id ? '…' : 'Готово'}
                  </button>
                  <button
                    type="button"
                    className="secondary-button v2-tasks-btn"
                    onClick={() => handleOpenLead(task)}
                  >
                    Открыть лид
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default TasksPage
