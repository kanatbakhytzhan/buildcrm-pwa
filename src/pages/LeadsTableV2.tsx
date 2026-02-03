import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getV2LeadsTable, type V2LeadTableRow } from '../services/api'

const COLS = ['#', 'Имя', 'Телефон', 'Город', 'Объект', 'Площадь', 'Статус', 'Дата'] as const

function cellLeadNumber(row: V2LeadTableRow): string {
  const n = row.lead_number
  if (n == null) return '—'
  return String(n)
}

function cellText(value: string | null | undefined): string {
  if (value == null || value === '') return '—'
  return String(value).trim()
}

function cellDate(row: V2LeadTableRow): string {
  const raw = row.date ?? row.created_at
  if (raw == null || raw === '') return '—'
  const s = String(raw).trim()
  if (!s) return '—'
  try {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return s
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return s
  }
}

const LeadsTableV2 = () => {
  const navigate = useNavigate()
  const [rows, setRows] = useState<V2LeadTableRow[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const data = await getV2LeadsTable()
      const list = Array.isArray(data) ? data : []
      setRows(list)
      setStatus('idle')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось загрузить таблицу'
      setError(msg)
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const name = (r.name ?? '').toLowerCase()
      const phone = (r.phone ?? '').replace(/\s/g, '')
      const phoneNorm = q.replace(/\s/g, '')
      return name.includes(q) || phone.includes(phoneNorm)
    })
  }, [rows, search])

  const handleRowClick = (row: V2LeadTableRow) => {
    const id = row.id != null ? String(row.id) : ''
    if (id) navigate(`/leads/${id}`)
  }

  return (
    <div className="page-stack v2-leads-page">
      <div className="page-header v2-leads-header">
        <div className="page-header__text">
          <h1 className="title">Таблица лидов</h1>
          <p className="subtitle">CRM v2</p>
        </div>
        <div className="action-card">
          <button
            className="ghost-button"
            type="button"
            onClick={load}
            disabled={status === 'loading'}
          >
            Обновить
          </button>
        </div>
      </div>

      <div className="card v2-leads-toolbar">
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label" style={{ marginBottom: 6 }}>Поиск по имени или телефону</span>
          <input
            className="field-input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Имя или телефон..."
          />
        </label>
      </div>

      {error && (
        <div className="card">
          <div className="error-text">{error}</div>
        </div>
      )}

      <div className="card v2-leads-card">
        {status === 'loading' ? (
          <div className="info-text">Загрузка…</div>
        ) : (
          <div className="v2-leads-table-wrap">
            <table className="v2-leads-table">
              <thead>
                <tr>
                  {COLS.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={COLS.length} className="v2-leads-empty">
                      {rows.length === 0 ? 'Нет данных' : 'Ничего не найдено'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => handleRowClick(row)}
                      className="v2-leads-row"
                    >
                      <td>{cellLeadNumber(row)}</td>
                      <td>{cellText(row.name)}</td>
                      <td>{cellText(row.phone)}</td>
                      <td>{cellText(row.city)}</td>
                      <td>{cellText(row.object)}</td>
                      <td>{cellText(row.area)}</td>
                      <td>{cellText(row.status)}</td>
                      <td>{cellDate(row)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default LeadsTableV2
