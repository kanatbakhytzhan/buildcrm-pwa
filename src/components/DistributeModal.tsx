import { useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  postLeadsAssignPlan,
  type TenantUser,
} from '../services/api'

export type DistributeMode = 'round_robin' | 'by_counts' | 'by_ranges'

type DistributeModalProps = {
  leadIds: (string | number)[]
  managers: TenantUser[]
  onClose: () => void
  onSuccess: (assigned: number) => void
}

type RangeRow = { manager_id: string | number; from: number; to: number }
type CountRow = { manager_id: string | number; count: number }

export default function DistributeModal({
  leadIds,
  managers,
  onClose,
  onSuccess,
}: DistributeModalProps) {
  const [mode, setMode] = useState<DistributeMode>('round_robin')
  const [selectedManagerIds, setSelectedManagerIds] = useState<Set<string | number>>(new Set())
  const [countRows, setCountRows] = useState<CountRow[]>(() =>
    managers.length ? [{ manager_id: managers[0].id, count: 0 }] : [],
  )
  const [rangeRows, setRangeRows] = useState<RangeRow[]>(() =>
    managers.length ? [{ manager_id: managers[0].id, from: 1, to: 1 }] : [],
  )
  const [sort, setSort] = useState<'date_desc' | 'date_asc' | 'status'>('date_desc')
  const [setStatusInProgress, setSetStatusInProgress] = useState(false)
  const [preview, setPreview] = useState<Array<{ lead_id: string | number; assigned_to_id: string | number }> | null>(null)
  const [loading, setLoading] = useState(false)
  const [applyLoading, setApplyLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [backendRequired, setBackendRequired] = useState(false)

  const N = leadIds.length

  const toggleManager = (id: string | number) => {
    setSelectedManagerIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handlePreview = async () => {
    setError(null)
    setBackendRequired(false)
    setLoading(true)
    setPreview(null)
    try {
      let payload: Parameters<typeof postLeadsAssignPlan>[0] = {
        lead_ids: leadIds,
        mode,
        sort,
        set_status_in_progress: setStatusInProgress,
      }
      if (mode === 'round_robin') {
        if (selectedManagerIds.size === 0) {
          setError('Выберите хотя бы одного менеджера')
          return
        }
        payload.manager_ids = Array.from(selectedManagerIds)
      } else if (mode === 'by_counts') {
        const counts: Record<string, number> = {}
        let sum = 0
        countRows.forEach((r) => {
          const id = String(r.manager_id)
          counts[id] = Math.max(0, r.count)
          sum += counts[id]
        })
        if (sum !== N) {
          setError(`Сумма (${sum}) должна равняться количеству лидов (${N})`)
          return
        }
        payload.counts = counts
      } else {
        const ranges = rangeRows
          .filter((r) => r.manager_id && r.from >= 1 && r.to >= r.from)
          .map((r) => ({ ...r, from: r.from, to: r.to }))
        const covered = new Set<number>()
        for (const r of ranges) {
          for (let i = r.from; i <= r.to; i++) {
            if (covered.has(i)) {
              setError(`Пересечение диапазонов: индекс ${i}`)
              return
            }
            covered.add(i)
          }
        }
        const maxIndex = Math.max(...ranges.map((r) => r.to), 0)
        if (maxIndex > N) {
          setError(`Максимальный индекс ${maxIndex} больше количества лидов (${N})`)
          return
        }
        payload.ranges = ranges
      }
      const result = await postLeadsAssignPlan(payload, true)
      setPreview(result.plan ?? null)
    } catch (err) {
      const e = err as { message?: string; status?: number }
      if (e?.status === 404 || e?.status === 501 || e?.message === 'Backend required') {
        setBackendRequired(true)
      } else {
        setError(e?.message ?? 'Ошибка предпросмотра')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    setError(null)
    setBackendRequired(false)
    setApplyLoading(true)
    try {
      let payload: Parameters<typeof postLeadsAssignPlan>[0] = {
        lead_ids: leadIds,
        mode,
        sort,
        set_status_in_progress: setStatusInProgress,
      }
      if (mode === 'round_robin') {
        payload.manager_ids = Array.from(selectedManagerIds)
      } else if (mode === 'by_counts') {
        payload.counts = countRows.reduce<Record<string, number>>((acc, r) => {
          acc[String(r.manager_id)] = Math.max(0, r.count)
          return acc
        }, {})
      } else {
        payload.ranges = rangeRows.filter((r) => r.manager_id && r.from >= 1 && r.to >= r.from)
      }
      const result = await postLeadsAssignPlan(payload, false)
      onSuccess(result.assigned ?? N)
      onClose()
    } catch (err) {
      const e = err as { message?: string; status?: number }
      if (e?.status === 404 || e?.status === 501 || e?.message === 'Backend required') {
        setBackendRequired(true)
      } else {
        setError(e?.message ?? 'Ошибка применения')
      }
    } finally {
      setApplyLoading(false)
    }
  }

  const addCountRow = () => {
    setCountRows((prev) => [...prev, { manager_id: managers[0]?.id ?? '', count: 0 }])
  }
  const addRangeRow = () => {
    setRangeRows((prev) => [...prev, { manager_id: managers[0]?.id ?? '', from: 1, to: 1 }])
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog v2-distribute-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">Распределить лиды ({N})</h2>
        {backendRequired && (
          <p className="dialog-text" style={{ color: 'var(--danger)' }}>
            Эндпоинт распределения недоступен. Требуется обновление бэкенда.
          </p>
        )}
        <label className="field">
          <span className="field-label">Режим</span>
          <select
            className="field-input"
            value={mode}
            onChange={(e) => setMode(e.target.value as DistributeMode)}
          >
            <option value="round_robin">Round-robin (по кругу)</option>
            <option value="by_counts">По количеству</option>
            <option value="by_ranges">По диапазону индексов</option>
          </select>
        </label>
        {mode === 'round_robin' && (
          <div className="field">
            <span className="field-label">Менеджеры</span>
            <div className="v2-distribute-managers">
              {managers.map((m) => (
                <label key={m.id} className="v2-leads-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedManagerIds.has(m.id)}
                    onChange={() => toggleManager(m.id)}
                  />
                  {m.email}
                </label>
              ))}
            </div>
          </div>
        )}
        {mode === 'by_counts' && (
          <div className="field">
            <span className="field-label">Количество на менеджера (сумма = {N})</span>
            {countRows.map((row, i) => (
              <div key={i} className="v2-distribute-row">
                <select
                  className="field-input"
                  value={row.manager_id}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setCountRows((prev) =>
                      prev.map((r, j) => (j === i ? { ...r, manager_id: e.target.value } : r)),
                    )
                  }
                >
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>{m.email}</option>
                  ))}
                </select>
                <input
                  type="number"
                  className="field-input"
                  min={0}
                  value={row.count}
                  onChange={(e) =>
                    setCountRows((prev) =>
                      prev.map((r, j) => (j === i ? { ...r, count: parseInt(e.target.value, 10) || 0 } : r)),
                    )
                  }
                />
              </div>
            ))}
            <button type="button" className="ghost-button" onClick={addCountRow}>+ Строка</button>
          </div>
        )}
        {mode === 'by_ranges' && (
          <div className="field">
            <span className="field-label">Диапазоны (1-based, индекс — позиция в текущей сортировке)</span>
            {rangeRows.map((row, i) => (
              <div key={i} className="v2-distribute-row">
                <select
                  className="field-input"
                  value={row.manager_id}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setRangeRows((prev) =>
                      prev.map((r, j) => (j === i ? { ...r, manager_id: e.target.value } : r)),
                    )
                  }
                >
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>{m.email}</option>
                  ))}
                </select>
                <input
                  type="number"
                  className="field-input"
                  min={1}
                  placeholder="от"
                  value={row.from || ''}
                  onChange={(e) =>
                    setRangeRows((prev) =>
                      prev.map((r, j) => (j === i ? { ...r, from: parseInt(e.target.value, 10) || 1 } : r)),
                    )
                  }
                />
                <input
                  type="number"
                  className="field-input"
                  min={1}
                  placeholder="до"
                  value={row.to || ''}
                  onChange={(e) =>
                    setRangeRows((prev) =>
                      prev.map((r, j) => (j === i ? { ...r, to: parseInt(e.target.value, 10) || 1 } : r)),
                    )
                  }
                />
              </div>
            ))}
            <button type="button" className="ghost-button" onClick={addRangeRow}>+ Диапазон</button>
          </div>
        )}
        <label className="field">
          <span className="field-label">Сортировка для индексов</span>
          <select className="field-input" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="date_desc">По дате (новые сверху)</option>
            <option value="date_asc">По дате (новые снизу)</option>
            <option value="status">По статусу</option>
          </select>
        </label>
        <label className="v2-leads-checkbox">
          <input
            type="checkbox"
            checked={setStatusInProgress}
            onChange={(e) => setSetStatusInProgress(e.target.checked)}
          />
          И статус «В работе»
        </label>
        {error && <p className="error-text">{error}</p>}
        {preview && preview.length > 0 && (
          <div className="v2-distribute-preview">
            <span className="field-label">Предпросмотр: лид → менеджер</span>
            <div className="v2-distribute-preview-list">
              {preview.slice(0, 15).map((p, i) => (
                <div key={i}>
                  #{p.lead_id} → {managers.find((m) => String(m.id) === String(p.assigned_to_id))?.email ?? p.assigned_to_id}
                </div>
              ))}
              {preview.length > 15 && <div>… и ещё {preview.length - 15}</div>}
            </div>
          </div>
        )}
        <div className="dialog-actions" style={{ marginTop: 16 }}>
          <button type="button" className="ghost-button" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handlePreview}
            disabled={loading || backendRequired}
            title={backendRequired ? 'Требуется бэкенд' : ''}
          >
            {loading ? '…' : 'Предпросмотр'}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleApply}
            disabled={applyLoading || backendRequired}
            title={backendRequired ? 'Требуется бэкенд' : ''}
          >
            {applyLoading ? '…' : 'Применить'}
          </button>
        </div>
      </div>
    </div>
  )
}
