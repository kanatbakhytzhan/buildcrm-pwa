import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  assignLead,
  bulkAssignLeads,
  getTenantUsers,
  getV2LeadsTable,
  updateLeadFields,
  updateLeadStatus,
  type TenantUser,
  type V2LeadTableRow,
} from '../services/api'

const BASE_COLS = ['#', 'Имя', 'Телефон', 'Город', 'Объект', 'Площадь', 'Статус'] as const

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

function formatDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${day}T${h}:${min}`
  } catch {
    return ''
  }
}

const LeadsTableV2 = () => {
  const navigate = useNavigate()
  const { userRole, tenantId, userId, isAdmin } = useAuth()
  const canAssign = isAdmin || userRole === 'owner' || userRole === 'rop'

  const [rows, setRows] = useState<V2LeadTableRow[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | number | null>(null)
  const [managers, setManagers] = useState<TenantUser[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())
  const [bulkManagerId, setBulkManagerId] = useState<string | number>('')
  const [bulkSetStatus, setBulkSetStatus] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterUnassignedOnly, setFilterUnassignedOnly] = useState(false)
  const [filterMineOnly, setFilterMineOnly] = useState(false)
  const [assignUpdatingId, setAssignUpdatingId] = useState<string | number | null>(null)
  const [nextCallUpdatingId, setNextCallUpdatingId] = useState<string | number | null>(null)

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

  useEffect(() => {
    if (!canAssign || tenantId == null) return
    getTenantUsers(tenantId)
      .then(setManagers)
      .catch(() => setManagers([]))
  }, [canAssign, tenantId])

  const filtered = useMemo(() => {
    let list = rows
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((r) => {
        const name = (r.name ?? '').toLowerCase()
        const phone = (r.phone ?? '').replace(/\s/g, '')
        const phoneNorm = q.replace(/\s/g, '')
        return name.includes(q) || phone.includes(phoneNorm)
      })
    }
    if (filterStatus) {
      list = list.filter((r) => (r.status ?? '') === filterStatus)
    }
    if (filterUnassignedOnly) {
      list = list.filter((r) => r.assigned_to_id == null || r.assigned_to_id === '')
    }
    if (filterMineOnly && userId != null) {
      list = list.filter((r) => r.assigned_to_id != null && String(r.assigned_to_id) === String(userId))
    }
    return list
  }, [rows, search, filterStatus, filterUnassignedOnly, filterMineOnly, userId])

  const toggleSelect = (id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size >= filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map((r) => r.id)))
  }

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
    } catch (err) {
      const e = err as { status?: number }
      setToast(e?.status === 401 || e?.status === 403 ? 'Недостаточно прав' : 'Пока недоступно')
    } finally {
      setStatusUpdatingId(null)
    }
  }

  const handleAssignChange = async (row: V2LeadTableRow, assignedToId: string | number | null) => {
    const id = row.id != null ? String(row.id) : ''
    if (!id) return
    setAssignUpdatingId(row.id)
    try {
      await assignLead(id, { assigned_to_id: assignedToId })
      const name = managers.find((m) => String(m.id) === String(assignedToId))?.email ?? null
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, assigned_to_id: assignedToId, assigned_to_name: name } : r))
      )
    } catch (err) {
      const e = err as { status?: number; message?: string }
      setToast(e?.status === 401 || e?.status === 403 ? 'Недостаточно прав' : (e?.message ?? 'Функция обновляется'))
    } finally {
      setAssignUpdatingId(null)
    }
  }

  const handleBulkAssign = async () => {
    if (!bulkManagerId || selectedIds.size === 0) return
    setBulkLoading(true)
    try {
      const result = await bulkAssignLeads({
        lead_ids: Array.from(selectedIds),
        assigned_to_id: bulkManagerId,
        set_status_in_progress: bulkSetStatus,
      })
      setToast(`Назначено: ${result.assigned}, пропущено: ${result.skipped}`)
      setSelectedIds(new Set())
      load()
    } catch (err) {
      const e = err as { status?: number; message?: string }
      setToast(e?.status === 401 || e?.status === 403 ? 'Недостаточно прав' : (e?.message ?? 'Функция обновляется'))
    } finally {
      setBulkLoading(false)
    }
  }

  const handleNextCallChange = async (row: V2LeadTableRow, value: string) => {
    const id = row.id != null ? String(row.id) : ''
    if (!id) return
    setNextCallUpdatingId(row.id)
    try {
      await updateLeadFields(id, { next_call_at: value || null })
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, next_call_at: value || null } : r))
      )
    } catch {
      setToast('Пока недоступно')
    } finally {
      setNextCallUpdatingId(null)
    }
  }

  const handleCopyPhone = (e: React.MouseEvent, phone: string | null | undefined) => {
    e.stopPropagation()
    const p = (phone ?? '').trim()
    if (p) navigator.clipboard.writeText(p).then(() => setToast('Телефон скопирован'))
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
        <div className="v2-leads-filters">
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label" style={{ marginBottom: 6 }}>Поиск</span>
            <input
              className="field-input"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Имя или телефон..."
            />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label" style={{ marginBottom: 6 }}>Статус</span>
            <select
              className="field-input"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Все</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          {canAssign && (
            <label className="v2-leads-checkbox">
              <input
                type="checkbox"
                checked={filterUnassignedOnly}
                onChange={(e) => setFilterUnassignedOnly(e.target.checked)}
              />
              Только без назначения
            </label>
          )}
          <label className="v2-leads-checkbox">
            <input
              type="checkbox"
              checked={filterMineOnly}
              onChange={(e) => setFilterMineOnly(e.target.checked)}
            />
            Только мои
          </label>
        </div>
        {canAssign && selectedIds.size > 0 && (
          <div className="v2-leads-bulk">
            <select
              className="field-input"
              value={bulkManagerId}
              onChange={(e) => setBulkManagerId(e.target.value)}
            >
              <option value="">Выберите менеджера</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.email}</option>
              ))}
            </select>
            <label className="v2-leads-checkbox">
              <input
                type="checkbox"
                checked={bulkSetStatus}
                onChange={(e) => setBulkSetStatus(e.target.checked)}
              />
              и статус in_progress
            </label>
            <button
              type="button"
              className="primary-button"
              disabled={!bulkManagerId || bulkLoading}
              onClick={handleBulkAssign}
            >
              {bulkLoading ? '…' : `Назначить выбранные (${selectedIds.size})`}
            </button>
          </div>
        )}
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
                  {canAssign && <th><input type="checkbox" checked={selectedIds.size > 0 && selectedIds.size === filtered.length} onChange={toggleSelectAll} aria-label="Выбрать все" /></th>}
                  {BASE_COLS.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                  {canAssign && <th>Назначен</th>}
                  <th>Next call</th>
                  <th>Создан</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={BASE_COLS.length + (canAssign ? 5 : 3)} className="v2-leads-empty">
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
                      {canAssign && (
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.id)}
                            onChange={() => toggleSelect(row.id)}
                          />
                        </td>
                      )}
                      <td>{cellNum(row)}</td>
                      <td>{cellText(row.name)}</td>
                      <td>
                        <button
                          type="button"
                          className="v2-leads-phone-link"
                          onClick={(e) => handleCopyPhone(e, row.phone)}
                        >
                          {cellText(row.phone)}
                        </button>
                      </td>
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
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </td>
                      {canAssign && (
                        <td onClick={(e) => e.stopPropagation()}>
                          <select
                            className="v2-leads-status-select"
                            value={row.assigned_to_id != null ? String(row.assigned_to_id) : ''}
                            disabled={assignUpdatingId === row.id}
                            onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                              const v = e.target.value
                              handleAssignChange(row, v ? (Number.isNaN(Number(v)) ? v : Number(v)) : null)
                            }}
                          >
                            <option value="">—</option>
                            {managers.map((m) => (
                              <option key={m.id} value={m.id}>{m.email}</option>
                            ))}
                          </select>
                        </td>
                      )}
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="datetime-local"
                          className="v2-leads-datetime"
                          value={formatDateTimeLocal(row.next_call_at)}
                          disabled={nextCallUpdatingId === row.id}
                          onChange={(e) => handleNextCallChange(row, e.target.value)}
                        />
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
