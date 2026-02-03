import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useV2RealtimeRefetch } from '../context/V2RealtimeContext'
import DistributeModal from '../components/DistributeModal'
import {
  assignLead,
  bulkAssignLeads,
  bulkUnassignLeads,
  getAdminUsers,
  getTenantUsers,
  getV2LeadsTable,
  postLeadsSelection,
  updateLeadFields,
  type TenantUser,
  type V2LeadTableRow,
} from '../services/api'

const BASE_COLS = ['#', 'Имя', 'Телефон', 'Город', 'Объект', 'Площадь', 'Статус'] as const

const STATUS_OPTIONS = [
  { value: 'new', label: 'Новый' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'done', label: 'Закрыт' },
  { value: 'cancelled', label: 'Отказ' },
] as const

type StatusValue = (typeof STATUS_OPTIONS)[number]['value']

const STATUS_LABELS: Record<StatusValue, string> = {
  new: 'Новый',
  in_progress: 'В работе',
  done: 'Закрыт',
  cancelled: 'Отказ',
}

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

/** "02 фев, 14:21" */
function cellDateShort(row: V2LeadTableRow): string {
  const raw = row.date ?? row.created_at
  if (raw == null || raw === '') return '—'
  try {
    const d = new Date(String(raw))
    if (Number.isNaN(d.getTime())) return '—'
    const day = d.getDate()
    const month = d.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '')
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    return `${String(day).padStart(2, '0')} ${month}, ${time}`
  } catch {
    return '—'
  }
}

function commentPreview(value: string | null | undefined, maxLen = 50): string {
  if (value == null || value === '') return '—'
  const s = String(value).trim()
  if (s.length <= maxLen) return s
  return `${s.slice(0, maxLen)}…`
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
  const [managers, setManagers] = useState<TenantUser[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())
  const [bulkManagerId, setBulkManagerId] = useState<string | number>('')
  const [bulkSetStatus, setBulkSetStatus] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterUnassignedOnly, setFilterUnassignedOnly] = useState(false)
  const [filterMineOnly, setFilterMineOnly] = useState(false)
  const [filterAssignedOnly, setFilterAssignedOnly] = useState(false)
  const [assignUpdatingId, setAssignUpdatingId] = useState<string | number | null>(null)
  const [nextCallUpdatingId, setNextCallUpdatingId] = useState<string | number | null>(null)
  const [sortBy, setSortBy] = useState<'date' | 'status'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20
  const [selectionLoading, setSelectionLoading] = useState(false)
  const [distributeOpen, setDistributeOpen] = useState(false)
  const [selectionByFiltersHint, setSelectionByFiltersHint] = useState<string | null>(null)

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

  useV2RealtimeRefetch(load)

  useEffect(() => {
    if (!canAssign) return
    if (tenantId != null) {
      getTenantUsers(tenantId)
        .then(setManagers)
        .catch(() => {
          if (isAdmin) {
            getAdminUsers()
              .then((users) => setManagers(users.map((u) => ({ id: u.id, email: u.email, role: undefined }))))
              .catch(() => setManagers([]))
          } else setManagers([])
        })
    } else if (isAdmin) {
      getAdminUsers()
        .then((users) => setManagers(users.map((u) => ({ id: u.id, email: u.email, role: undefined }))))
        .catch(() => setManagers([]))
    } else {
      setManagers([])
    }
  }, [canAssign, tenantId, isAdmin])

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
    if (filterAssignedOnly) {
      list = list.filter((r) => r.assigned_to_id != null && r.assigned_to_id !== '')
    }
    const statusOrder: Record<string, number> = { new: 0, in_progress: 1, done: 2, cancelled: 3 }
    const sorted = [...list].sort((a, b) => {
      if (sortBy === 'date') {
        const da = new Date(a.date ?? a.created_at ?? 0).getTime()
        const db = new Date(b.date ?? b.created_at ?? 0).getTime()
        return sortDir === 'asc' ? da - db : db - da
      }
      const sa = statusOrder[statusForSelect(a.status)] ?? 0
      const sb = statusOrder[statusForSelect(b.status)] ?? 0
      return sortDir === 'asc' ? sa - sb : sb - sa
    })
    return sorted
  }, [rows, search, filterStatus, filterUnassignedOnly, filterMineOnly, filterAssignedOnly, userId, sortBy, sortDir])

  const totalFiltered = filtered.length
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE))

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
      setToast(result.skipped > 0 ? `Назначено: ${result.assigned}, пропущено: ${result.skipped}` : 'Назначено')
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

  const handleCall = (e: React.MouseEvent, phone: string | null | undefined) => {
    e.stopPropagation()
    const p = (phone ?? '').trim().replace(/\D/g, '')
    if (p) window.open(`tel:${p}`, '_self')
  }

  const handleWhatsApp = (e: React.MouseEvent, phone: string | null | undefined) => {
    e.stopPropagation()
    const p = (phone ?? '').trim().replace(/\D/g, '')
    if (p) {
      const num = p.startsWith('7') ? p : `7${p}`
      window.open(`https://wa.me/${num}`, '_blank')
    }
  }

  const handleOpenComments = (e: React.MouseEvent, row: V2LeadTableRow) => {
    e.stopPropagation()
    const id = row.id != null ? String(row.id) : ''
    if (id) navigate(`/leads/${id}#comments`)
  }

  const toggleSort = (field: 'date' | 'status') => {
    setSortBy(field)
    setSortDir((d) => (sortBy === field ? (d === 'asc' ? 'desc' : 'asc') : 'desc'))
  }
  useEffect(() => {
    setPage(1)
  }, [search, filterStatus, filterUnassignedOnly, filterMineOnly, filterAssignedOnly])

  const handleBulkUnassign = async () => {
    if (selectedIds.size === 0) return
    setBulkLoading(true)
    try {
      const result = await bulkUnassignLeads(Array.from(selectedIds))
      setToast(`Снято назначение: ${result.unassigned}`)
      setSelectedIds(new Set())
      load()
    } catch (err) {
      const e = err as { status?: number; message?: string }
      setToast(e?.status === 401 || e?.status === 403 ? 'Недостаточно прав' : (e?.message ?? 'Ошибка'))
    } finally {
      setBulkLoading(false)
    }
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    setSelectionByFiltersHint(null)
  }

  const fetchSelectionByFilters = async () => {
    if (!canAssign) return
    setSelectionLoading(true)
    setSelectionByFiltersHint(null)
    try {
      const { lead_ids } = await postLeadsSelection({
        search: search.trim() || undefined,
        status: filterStatus || undefined,
        unassigned_only: filterUnassignedOnly,
        mine_only: filterMineOnly,
        assigned_only: filterAssignedOnly,
      })
      setSelectedIds(new Set(lead_ids))
      setSelectionByFiltersHint(lead_ids.length > 0 ? `Выбрано по фильтрам: ${lead_ids.length}` : null)
      if (lead_ids.length > 0) setToast(`Выбрано: ${lead_ids.length}`)
    } catch (err) {
      const e = err as { message?: string; status?: number }
      if (e?.status === 404 || e?.message === 'Backend required') {
        setToast('Эндпоинт отбора по фильтрам недоступен')
      } else {
        setToast(e?.message ?? 'Ошибка')
      }
    } finally {
      setSelectionLoading(false)
    }
  }

  return (
    <div className="page-stack v2-leads-page page-desktop-fullwidth">
      <div className="page-header v2-leads-header">
        <div className="page-header__text">
          <h1 className="title">Таблица лидов</h1>
          <p className="subtitle">CRM v2</p>
        </div>
        <div className="action-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="v2-leads-counter">Всего лидов: {totalFiltered}</span>
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
          <label className="v2-leads-checkbox">
            <input
              type="checkbox"
              checked={filterAssignedOnly}
              onChange={(e) => setFilterAssignedOnly(e.target.checked)}
            />
            Назначенные
          </label>
          {canAssign && (
            <button
              type="button"
              className="ghost-button"
              disabled={selectionLoading}
              onClick={fetchSelectionByFilters}
              title="Выбрать лидов по текущим фильтрам (требуется бэкенд)"
            >
              {selectionLoading ? '…' : 'Собрать по фильтрам'}
            </button>
          )}
        </div>
        {selectionByFiltersHint && (
          <div className="v2-leads-bulk-label" style={{ marginBottom: 4 }}>{selectionByFiltersHint}</div>
        )}
        {canAssign && selectedIds.size > 0 && (
          <div className="v2-leads-bulk">
            <span className="v2-leads-bulk-label">Выбрано: {selectedIds.size}</span>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="field-label" style={{ marginBottom: 4 }}>Назначить менеджеру</span>
              <select
                className="field-input"
                value={bulkManagerId}
                onChange={(e) => setBulkManagerId(e.target.value)}
              >
                <option value="">— Выберите —</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.email} {m.role ? `(${m.role})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="primary-button"
              disabled={!bulkManagerId || bulkLoading}
              onClick={handleBulkAssign}
            >
              {bulkLoading ? '…' : 'Назначить'}
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={bulkLoading}
              onClick={handleBulkUnassign}
            >
              Снять назначение
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setDistributeOpen(true)}
            >
              Распределить
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={clearSelection}
            >
              Очистить выделение
            </button>
            <label className="v2-leads-checkbox">
              <input
                type="checkbox"
                checked={bulkSetStatus}
                onChange={(e) => setBulkSetStatus(e.target.checked)}
              />
              и статус «В работе»
            </label>
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
          <div className="v2-leads-table-wrap">
            <table className="v2-leads-table v2-leads-skeleton">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Имя</th>
                  <th>Телефон</th>
                  <th>Город</th>
                  <th>Статус</th>
                  <th>Дата</th>
                  <th>Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td><span className="v2-skeleton-line" style={{ width: 32 }} /></td>
                    <td><span className="v2-skeleton-line" style={{ width: '80%' }} /></td>
                    <td><span className="v2-skeleton-line" style={{ width: 100 }} /></td>
                    <td><span className="v2-skeleton-line" style={{ width: 60 }} /></td>
                    <td><span className="v2-skeleton-line" style={{ width: 70 }} /></td>
                    <td><span className="v2-skeleton-line" style={{ width: 90 }} /></td>
                    <td><span className="v2-skeleton-line" style={{ width: '60%' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div className="v2-leads-table-wrap">
              <table className="v2-leads-table">
                <thead>
                  <tr>
                    {canAssign && <th><input type="checkbox" checked={selectedIds.size > 0 && selectedIds.size === filtered.length} onChange={toggleSelectAll} aria-label="Выбрать все" /></th>}
                    <th>#</th>
                    <th>Имя</th>
                    <th>Телефон</th>
                    <th>Город</th>
                    <th>Объект</th>
                    <th>Площадь</th>
                    <th>
                      <button type="button" className="v2-sort-th" onClick={() => toggleSort('status')}>
                        Статус {sortBy === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    {canAssign && <th>Менеджер</th>}
                    <th>Next call</th>
                    <th>
                      <button type="button" className="v2-sort-th" onClick={() => toggleSort('date')}>
                        Дата {sortBy === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th>Комментарий</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={BASE_COLS.length + (canAssign ? 6 : 4)} className="v2-leads-empty">
                        {rows.length === 0 ? 'Лидов нет' : 'Ничего не найдено'}
                      </td>
                    </tr>
                  ) : (
                    paginated.map((row) => {
                      const st = statusForSelect(row.status)
                      return (
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
                            <span className={`v2-status-badge v2-status-badge--${st}`}>
                              {STATUS_LABELS[st]}
                            </span>
                          </td>
                          {canAssign && (
                            <td onClick={(e) => e.stopPropagation()}>
                              <span className="v2-leads-manager-name">
                                {(row.assigned_to_id != null && row.assigned_to_id !== '')
                                  ? (row.assigned_to_name ?? String(row.assigned_to_id))
                                  : '—'}
                              </span>
                              <select
                                className="v2-leads-status-select v2-leads-manager-select"
                                value={row.assigned_to_id != null ? String(row.assigned_to_id) : ''}
                                disabled={assignUpdatingId === row.id}
                                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                                  const v = e.target.value
                                  handleAssignChange(row, v ? (Number.isNaN(Number(v)) ? v : Number(v)) : null)
                                }}
                                aria-label="Изменить менеджера"
                              >
                                <option value="">—</option>
                                {managers.map((m) => (
                                  <option key={m.id} value={m.id}>{m.email} {m.role ? `(${m.role})` : ''}</option>
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
                          <td>{cellDateShort(row)}</td>
                          <td title={row.last_comment ?? ''}>{commentPreview(row.last_comment)}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="v2-leads-actions-cell">
                              <button
                                type="button"
                                className="v2-leads-action-btn"
                                title="Позвонить"
                                onClick={(e) => handleCall(e, row.phone)}
                              >
                                📞
                              </button>
                              <button
                                type="button"
                                className="v2-leads-action-btn v2-leads-action-btn--success"
                                title="WhatsApp"
                                onClick={(e) => handleWhatsApp(e, row.phone)}
                              >
                                🟦
                              </button>
                              <button
                                type="button"
                                className="v2-leads-action-btn"
                                title="Комментарий"
                                onClick={(e) => handleOpenComments(e, row)}
                              >
                                🗒️
                              </button>
                              <button
                                type="button"
                                className="secondary-button v2-leads-open-btn"
                                onClick={(e) => handleOpen(e, row)}
                              >
                                Открыть
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            {totalFiltered > 0 && (
              <div className="v2-leads-pagination">
                <span className="v2-leads-counter">
                  Показано {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalFiltered)} из {totalFiltered}
                </span>
                <div className="v2-leads-pagination-buttons">
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Назад
                  </button>
                  <span className="v2-leads-counter">Стр. {page} из {totalPages}</span>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Вперёд
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {distributeOpen && (
        <DistributeModal
          leadIds={Array.from(selectedIds)}
          managers={managers}
          onClose={() => setDistributeOpen(false)}
          onSuccess={(assigned) => {
            setToast(`Распределено: ${assigned}`)
            setSelectedIds(new Set())
            setDistributeOpen(false)
            load()
          }}
        />
      )}
    </div>
  )
}

export default LeadsTableV2
