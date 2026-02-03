import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  assignLeadsByRange,
  createAutoAssignRule,
  deleteAutoAssignRule,
  getAutoAssignRules,
  getTenantUsers,
  updateAutoAssignRule,
  type AutoAssignRule,
  type TenantUser,
} from '../../services/api'

const STRATEGIES = [
  { value: 'fixed', label: 'Фиксированный' },
  { value: 'round_robin', label: 'По кругу' },
  { value: 'least_loaded', label: 'Наименее загружен' },
] as const

const AutoAssignPage = () => {
  const { tenantId } = useAuth()
  const [tab, setTab] = useState<'rules' | 'range'>('rules')
  const [rules, setRules] = useState<AutoAssignRule[]>([])
  const [managers, setManagers] = useState<TenantUser[]>([])
  const [loading, setLoading] = useState(false)
  const [ruleModal, setRuleModal] = useState<AutoAssignRule | null>(null)
  const [ruleForm, setRuleForm] = useState<Partial<AutoAssignRule>>({})
  const [rangeResult, setRangeResult] = useState<{ assigned?: number; skipped?: number; plan?: Array<{ lead_id: string | number; name?: string; phone?: string; assigned_to?: string | number }> } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [rangeStatus, setRangeStatus] = useState('')
  const [rangeUnassignedOnly, setRangeUnassignedOnly] = useState(false)
  const [rangeFrom, setRangeFrom] = useState(1)
  const [rangeTo, setRangeTo] = useState(10)
  const [rangeStrategy, setRangeStrategy] = useState<'round_robin' | 'fixed' | 'custom_map'>('round_robin')
  const [rangeFixedUserId, setRangeFixedUserId] = useState<string | number>('')
  const [rangeCustomMap, setRangeCustomMap] = useState<Array<{ manager_id: string | number; count: number }>>([])
  const [rangeLoading, setRangeLoading] = useState(false)

  const loadRules = useCallback(async () => {
    if (tenantId == null) return
    setLoading(true)
    try {
      const list = await getAutoAssignRules(tenantId)
      setRules(Array.isArray(list) ? list : [])
    } catch {
      setRules([])
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    loadRules()
  }, [loadRules])

  useEffect(() => {
    if (tenantId != null) {
      getTenantUsers(tenantId).then(setManagers).catch(() => setManagers([]))
    }
  }, [tenantId])

  const openAddRule = () => {
    setRuleForm({ name: '', is_active: true, priority: 0, strategy: 'round_robin' })
    setRuleModal({ id: 'new', name: '', is_active: true, priority: 0 } as AutoAssignRule)
    setError(null)
  }

  const openEditRule = (r: AutoAssignRule) => {
    setRuleForm({ ...r })
    setRuleModal(r)
    setError(null)
  }

  const saveRule = async () => {
    if (tenantId == null || !ruleModal) return
    setError(null)
    try {
      if (ruleModal.id && ruleModal.id !== 'new') {
        await updateAutoAssignRule(ruleModal.id, ruleForm)
      } else {
        await createAutoAssignRule(tenantId, ruleForm)
      }
      setRuleModal(null)
      loadRules()
    } catch (err) {
      const e = err as { message?: string; status?: number }
      if (e?.status === 422) setError((e as { detail?: string })?.detail ?? e?.message ?? 'Ошибка')
      else setError(e?.message ?? 'Ошибка сохранения')
    }
  }

  const removeRule = async () => {
    if (!ruleModal?.id || ruleModal.id === 'new') return
    try {
      await deleteAutoAssignRule(ruleModal.id)
      setRuleModal(null)
      loadRules()
    } catch {
      setError('Не удалось удалить')
    }
  }

  const addCustomMapRow = () => {
    setRangeCustomMap((prev) => [...prev, { manager_id: managers[0]?.id ?? '', count: 0 }])
  }

  const runRange = async (dryRun: boolean) => {
    if (tenantId == null) return
    setRangeLoading(true)
    setError(null)
    setRangeResult(null)
    try {
      const body: Parameters<typeof assignLeadsByRange>[0] = {
        tenant_id: tenantId,
        status: rangeStatus || undefined,
        unassigned_only: rangeUnassignedOnly,
        from_index: rangeFrom,
        to_index: rangeTo,
        strategy: rangeStrategy,
        dry_run: dryRun,
      }
      if (rangeStrategy === 'fixed' && rangeFixedUserId) {
        body.fixed_user_id = rangeFixedUserId
      }
      if (rangeStrategy === 'round_robin' && managers.length) {
        body.manager_ids = managers.map((m) => m.id)
      }
      if (rangeStrategy === 'custom_map') {
        body.custom_map = rangeCustomMap.filter((r) => r.manager_id && r.count > 0)
      }
      const res = await assignLeadsByRange(body)
      setRangeResult(res)
    } catch (err) {
      const e = err as { message?: string; status?: number }
      if (e?.status === 401 || e?.status === 403) setError('Нет доступа')
      else if (e?.status === 422) setError((err as { detail?: string })?.detail ?? (e?.message ?? 'Ошибка'))
      else setError(e?.message ?? 'Ошибка')
    } finally {
      setRangeLoading(false)
    }
  }

  if (tenantId == null) {
    return (
      <div className="page-stack">
        <h1 className="title">Автоназначение</h1>
        <div className="card">
          <div className="info-text">Нет доступа к tenant. Войдите под пользователем с привязкой к клиенту.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-stack page-desktop-fullwidth">
      <div className="page-header">
        <div className="page-header__text">
          <h1 className="title">Автоназначение</h1>
          <p className="subtitle">Правила и раздача по диапазону</p>
        </div>
      </div>

      <div className="v2-tasks-tabs">
        <button
          type="button"
          className={`v2-tasks-tab ${tab === 'rules' ? 'v2-tasks-tab--active' : ''}`}
          onClick={() => setTab('rules')}
        >
          Правила
        </button>
        <button
          type="button"
          className={`v2-tasks-tab ${tab === 'range' ? 'v2-tasks-tab--active' : ''}`}
          onClick={() => setTab('range')}
        >
          Раздать лиды по диапазону
        </button>
      </div>

      {error && (
        <div className="card">
          <div className="error-text">{error}</div>
        </div>
      )}

      {tab === 'rules' && (
        <>
          <div className="card">
            <button type="button" className="primary-button" onClick={openAddRule}>
              Добавить правило
            </button>
          </div>
          <div className="card">
            {loading ? (
              <div className="info-text">Загрузка…</div>
            ) : rules.length === 0 ? (
              <div className="info-text">Правил пока нет</div>
            ) : (
              <div className="v2-leads-table-wrap">
                <table className="v2-leads-table">
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Активно</th>
                      <th>Приоритет</th>
                      <th>Стратегия</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((r) => (
                      <tr key={r.id}>
                        <td>{r.name ?? '—'}</td>
                        <td>{r.is_active ? 'Да' : 'Нет'}</td>
                        <td>{r.priority ?? 0}</td>
                        <td>{r.strategy ?? '—'}</td>
                        <td>
                          <button type="button" className="ghost-button" onClick={() => openEditRule(r)}>
                            Изменить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'range' && (
        <div className="card">
          <div className="card-title">Параметры</div>
          <div className="form-grid">
            <label className="v2-leads-checkbox">
              <input
                type="checkbox"
                checked={rangeUnassignedOnly}
                onChange={(e) => setRangeUnassignedOnly(e.target.checked)}
              />
              Только без назначения
            </label>
            <label className="field">
              <span className="field-label">Статус</span>
              <select className="field-input" value={rangeStatus} onChange={(e) => setRangeStatus(e.target.value)}>
                <option value="">Любой</option>
                <option value="new">New</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">От индекса (1-based)</span>
              <input
                type="number"
                className="field-input"
                min={1}
                value={rangeFrom}
                onChange={(e) => setRangeFrom(parseInt(e.target.value, 10) || 1)}
              />
            </label>
            <label className="field">
              <span className="field-label">До индекса</span>
              <input
                type="number"
                className="field-input"
                min={1}
                value={rangeTo}
                onChange={(e) => setRangeTo(parseInt(e.target.value, 10) || 1)}
              />
            </label>
          </div>
          <p className="info-text" style={{ marginBottom: 12 }}>Индекс — позиция в текущей сортировке.</p>
          <label className="field">
            <span className="field-label">Режим назначения</span>
            <select
              className="field-input"
              value={rangeStrategy}
              onChange={(e) => setRangeStrategy(e.target.value as 'round_robin' | 'fixed' | 'custom_map')}
            >
              <option value="round_robin">Round-robin</option>
              <option value="fixed">Фиксированный менеджер</option>
              <option value="custom_map">Своя разбивка (менеджер + кол-во)</option>
            </select>
          </label>
          {rangeStrategy === 'fixed' && (
            <label className="field">
              <span className="field-label">Менеджер</span>
              <select
                className="field-input"
                value={String(rangeFixedUserId)}
                onChange={(e) => setRangeFixedUserId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">—</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.email}</option>
                ))}
              </select>
            </label>
          )}
          {rangeStrategy === 'custom_map' && (
            <div className="field">
              <span className="field-label">Менеджер и количество</span>
              {rangeCustomMap.map((row, i) => (
                <div key={i} className="v2-distribute-row">
                  <select
                    className="field-input"
                    value={String(row.manager_id)}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      setRangeCustomMap((prev) =>
                        prev.map((r, j) => (j === i ? { ...r, manager_id: e.target.value ? Number(e.target.value) : '' } : r)))
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
                      setRangeCustomMap((prev) =>
                        prev.map((r, j) => (j === i ? { ...r, count: parseInt(e.target.value, 10) || 0 } : r)))
                    }
                  />
                </div>
              ))}
              <button type="button" className="ghost-button" onClick={addCustomMapRow}>+ Добавить строку</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              type="button"
              className="secondary-button"
              disabled={rangeLoading}
              onClick={() => runRange(true)}
            >
              {rangeLoading ? '…' : 'Предпросмотр'}
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={rangeLoading}
              onClick={() => runRange(false)}
            >
              {rangeLoading ? '…' : 'Назначить'}
            </button>
          </div>
          {rangeResult && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-title">Результат</div>
              <div className="v3-stats">
                {rangeResult.assigned != null && <span>Назначено: {rangeResult.assigned}</span>}
                {rangeResult.skipped != null && <span>Пропущено: {rangeResult.skipped}</span>}
              </div>
              {rangeResult.plan && rangeResult.plan.length > 0 && (
                <div className="v2-leads-table-wrap" style={{ marginTop: 12 }}>
                  <table className="v2-leads-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Имя</th>
                        <th>Телефон</th>
                        <th>Назначен</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rangeResult.plan.slice(0, 20).map((p, i) => (
                        <tr key={i}>
                          <td>{p.lead_id}</td>
                          <td>{p.name ?? '—'}</td>
                          <td>{p.phone ?? '—'}</td>
                          <td>{p.assigned_to ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rangeResult.plan.length > 20 && (
                    <p className="info-text">… и ещё {rangeResult.plan.length - 20}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {ruleModal !== null && (
        <div className="dialog-backdrop" onClick={() => setRuleModal(null)}>
          <div className="dialog admin-dialog-wide" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">{ruleModal.id ? 'Редактировать правило' : 'Новое правило'}</div>
            <div className="form-grid">
              <label className="field">
                <span className="field-label">Название</span>
                <input
                  className="field-input"
                  value={ruleForm.name ?? ''}
                  onChange={(e) => setRuleForm((p) => ({ ...p, name: e.target.value }))}
                />
              </label>
              <label className="v2-leads-checkbox">
                <input
                  type="checkbox"
                  checked={ruleForm.is_active !== false}
                  onChange={(e) => setRuleForm((p) => ({ ...p, is_active: e.target.checked }))}
                />
                Активно
              </label>
              <label className="field">
                <span className="field-label">Приоритет</span>
                <input
                  type="number"
                  className="field-input"
                  value={ruleForm.priority ?? 0}
                  onChange={(e) => setRuleForm((p) => ({ ...p, priority: parseInt(e.target.value, 10) || 0 }))}
                />
              </label>
              <label className="field">
                <span className="field-label">Стратегия</span>
                <select
                  className="field-input"
                  value={ruleForm.strategy ?? 'round_robin'}
                  onChange={(e) => setRuleForm((p) => ({ ...p, strategy: e.target.value as AutoAssignRule['strategy'] }))}
                >
                  {STRATEGIES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>
              {ruleForm.strategy === 'fixed' && (
                <label className="field">
                  <span className="field-label">Менеджер</span>
                  <select
                    className="field-input"
                    value={String(ruleForm.fixed_user_id ?? '')}
                    onChange={(e) => setRuleForm((p) => ({ ...p, fixed_user_id: e.target.value ? Number(e.target.value) : undefined }))}
                  >
                    <option value="">—</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>{m.email}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="field">
                <span className="field-label">match_city</span>
                <input
                  className="field-input"
                  value={ruleForm.match_city ?? ''}
                  onChange={(e) => setRuleForm((p) => ({ ...p, match_city: e.target.value }))}
                />
              </label>
              <label className="field">
                <span className="field-label">match_language</span>
                <select
                  className="field-input"
                  value={ruleForm.match_language ?? ''}
                  onChange={(e) => setRuleForm((p) => ({ ...p, match_language: e.target.value }))}
                >
                  <option value="">—</option>
                  <option value="ru">ru</option>
                  <option value="kk">kk</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">match_contains</span>
                <input
                  className="field-input"
                  value={ruleForm.match_contains ?? ''}
                  onChange={(e) => setRuleForm((p) => ({ ...p, match_contains: e.target.value }))}
                />
              </label>
            </div>
            {error && <div className="error-text">{error}</div>}
            <div className="dialog-actions" style={{ marginTop: 16 }}>
              {ruleModal.id && ruleModal.id !== 'new' && (
                <button type="button" className="danger-button" onClick={removeRule}>
                  Удалить
                </button>
              )}
              <button type="button" className="ghost-button" onClick={() => setRuleModal(null)}>Отмена</button>
              <button type="button" className="primary-button" onClick={saveRule}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AutoAssignPage
