import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getV2LeadsTable, updateLeadStatus, type V2LeadTableRow } from '../services/api'

const COLS = ['#', 'Имя', 'Телефон', 'Город', 'Объект', 'Площадь', 'Статус', 'Дата', 'Действия'] as const

const STATUS_OPTIONS = [
  { value: 'new', label: 'new' },
  { value: 'in_progress', label: 'in_progress' },
  { value: 'done', label: 'done' },
  { value: 'cancelled', label: 'cancelled' },
] as const

type StatusValue = (typeof STATUS_OPTIONS)[number]['value']

function cellNum(row: V2LeadTableRow): string {
  const num = row.lead_number ?? row.id
  if (num == null || num === '') return '—'
  return String(num)
}

function statusForSelect(s: string | null | undefined): StatusValue {
  if (s === 'success') return 'done'
  if (s === 'failed') return 'cancelled'
  if (s === 'new' || s === 'in_progress' || s === 'done' || s === 'cancelled') return s
  return 'new'
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
  const [toast, setToast] = useState<string | null>(null)
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | number | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2500)
    return () => window.clearTimeout(t)
  }, [toast])

  const load = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const { list } = await getV2LeadsTable()
      setRows(Array.isArray(list) ? list : [])
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

  const mapStatusToApi = (v: StatusValue): 'new' | 'success' | 'failed' => {
    if (v === 'done') return 'success'
    if (v === 'cancelled') return 'failed'
    return 'new'
  }

  const handleStatusChange = async (row: V2LeadTableRow, newValue: StatusValue) => {
    const id = row.id != null ? String(row.id) : ''
    if (!id) return
    setStatusUpdatingId(row.id)
    try {
      await updateLeadStatus(id, mapStatusToApi(newValue))
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, status: newValue } : r))
      )
    } catch {
      setToast('Пока недоступно')
    } finally {
      setStatusUpdatingId(null)
    }
  }

  const handleOpen = (e: React.MouseEvent, row: V2LeadTableRow) => {
    e.stopPropagation()
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

      {toast && (
        <div className="v2-toast" role="status">
          {toast}
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
                      <td>{cellNum(row)}</td>
                      <td>{cellText(row.name)}</td>
                      <td>{cellText(row.phone)}</td>
                      <td>{cellText(row.city)}</td>
                      <td>{cellText(row.object)}</td>
                      <td>{cellText(row.area)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <select
                          className="v2-leads-status-select"
                          value={statusForSelect(row.status)}
                          disabled={statusUpdatingId === row.id}
                          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                            handleStatusChange(row, e.target.value as StatusValue)
                          }
                        >
                          {STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>{cellDate(row)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="secondary-button v2-leads-open-btn"
                          onClick={(e) => handleOpen(e, row)}
                        >
                          Открыть
                        </button>
                      </td>
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
