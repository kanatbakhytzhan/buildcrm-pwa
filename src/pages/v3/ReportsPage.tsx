import { useCallback, useEffect, useState } from 'react'
import {
  getReportsSummary,
  getReportsSla,
  getReportsWorkload,
} from '../../services/api'

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const defaultFrom = () => {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return toDateStr(d)
}
const defaultTo = () => toDateStr(new Date())

const ReportsPage = () => {
  const [dateFrom, setDateFrom] = useState(defaultFrom())
  const [dateTo, setDateTo] = useState(defaultTo())
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null)
  const [sla, setSla] = useState<unknown>(null)
  const [workload, setWorkload] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, sl, w] = await Promise.all([
        getReportsSummary({ date_from: dateFrom, date_to: dateTo }),
        getReportsSla({ date_from: dateFrom, date_to: dateTo }).catch(() => null),
        getReportsWorkload({ date_from: dateFrom, date_to: dateTo }),
      ])
      setSummary((s ?? {}) as Record<string, unknown>)
      setSla(sl)
      setWorkload(w)
    } catch (err) {
      const e = err as { message?: string; status?: number }
      if (e?.status === 401 || e?.status === 403) setError('Нет доступа')
      else setError(e?.message ?? 'Ошибка загрузки отчётов')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    load()
  }, [load])

  const cards = summary
    ? [
        { label: 'Всего', value: summary.total ?? summary.all ?? '—' },
        { label: 'New', value: summary.new ?? '—' },
        { label: 'In progress', value: summary.in_progress ?? summary.inProgress ?? '—' },
        { label: 'Done', value: summary.done ?? '—' },
        { label: 'Cancelled', value: summary.cancelled ?? '—' },
        { label: 'Conversion %', value: summary.conversion != null ? `${summary.conversion}%` : '—' },
        { label: 'Avg time to assign', value: summary.avg_time_to_assign ?? summary.avgTimeToAssign ?? '—' },
        { label: 'Avg first response', value: summary.avg_first_response ?? summary.avgFirstResponse ?? '—' },
      ]
    : []

  const rawWorkload = Array.isArray(workload) ? workload : (workload as Record<string, unknown>)?.items ?? (workload as Record<string, unknown>)?.data
  const rawSla = Array.isArray(sla) ? sla : (sla as Record<string, unknown>)?.items ?? (sla as Record<string, unknown>)?.data
  const workloadList: unknown[] = Array.isArray(rawWorkload) ? rawWorkload : []
  const slaList: unknown[] = Array.isArray(rawSla) ? rawSla : []

  return (
    <div className="page-stack page-desktop-fullwidth">
      <div className="page-header">
        <div className="page-header__text">
          <h1 className="title">Отчёты</h1>
          <p className="subtitle">Дашборд</p>
        </div>
        <button type="button" className="ghost-button" onClick={load} disabled={loading}>
          {loading ? 'Загрузка…' : 'Обновить'}
        </button>
      </div>

      <div className="card">
        <div className="card-title">Период</div>
        <div className="v3-reports-filters">
          <label className="field">
            <span className="field-label">С</span>
            <input
              type="date"
              className="field-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">По</span>
            <input
              type="date"
              className="field-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="card">
          <div className="error-text">{error}</div>
        </div>
      )}

      {summary && (
        <div className="card">
          <div className="card-title">Summary</div>
          <div className="v3-cards">
            {cards.map((c) => (
              <div key={c.label} className="v3-card">
                <span className="v3-card-label">{c.label}</span>
                <span className="v3-card-value">{String(c.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(workloadList) && workloadList.length > 0 && (
        <div className="card">
          <div className="card-title">Нагрузка по менеджерам</div>
          <div className="v2-leads-table-wrap">
            <table className="v2-leads-table">
              <thead>
                <tr>
                  <th>Менеджер</th>
                  <th>Назначено</th>
                  <th>Активные</th>
                  <th>Done</th>
                  <th>Avg response</th>
                </tr>
              </thead>
              <tbody>
                {workloadList.map((row, i) => {
                  const r = row as Record<string, unknown>
                  return (
                  <tr key={i}>
                    <td>{String(r.manager ?? r.email ?? r.name ?? '—')}</td>
                    <td>{String(r.assigned ?? r.total ?? '—')}</td>
                    <td>{String(r.active ?? r.in_progress ?? '—')}</td>
                    <td>{String(r.done ?? '—')}</td>
                    <td>{String(r.avg_response ?? r.avgResponse ?? '—')}</td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {Array.isArray(slaList) && slaList.length > 0 && (
        <div className="card">
          <div className="card-title">SLA распределение</div>
          <ul className="v3-sla-list">
            {slaList.map((item: unknown, i: number) => (
              <li key={i} className="v3-sla-item">
                {typeof item === 'object' && item !== null
                  ? JSON.stringify(item)
                  : String(item)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && !error && !summary && (
        <div className="card">
          <div className="info-text">Нет данных или эндпоинт отчётов недоступен.</div>
        </div>
      )}
    </div>
  )
}

export default ReportsPage
