import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useV2RealtimeRefetch } from '../context/V2RealtimeContext'
import {
  getLeadsForPipeline,
  getPipelines,
  patchLeadStage,
  updatePipelineStages,
  type Pipeline,
  type PipelineLead,
  type PipelineStage,
} from '../services/api'

function formatDate(s: string | null | undefined): string {
  if (!s) return '—'
  try {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}

function truncate(str: string | null | undefined, max: number): string {
  if (!str) return '—'
  const s = String(str).trim()
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

const PipelinePage = () => {
  const navigate = useNavigate()
  const { userRole, userId, isAdmin } = useAuth()
  const canMoveAny = isAdmin || userRole === 'owner' || userRole === 'rop'
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [leads, setLeads] = useState<PipelineLead[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [stagesModalOpen, setStagesModalOpen] = useState(false)
  const [stagesSaving, setStagesSaving] = useState(false)
  const [dragLeadId, setDragLeadId] = useState<string | number | null>(null)
  const [dragStageId, setDragStageId] = useState<string | number | null>(null)

  const pipeline = useMemo(
    () => pipelines.find((p) => p.is_default) ?? pipelines[0],
    [pipelines],
  )
  const stages = useMemo(() => {
    const list = (pipeline?.stages ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const hasUnassigned = leads.some((l) => l.stage_id == null || l.stage_id === '')
    if (hasUnassigned && list.length > 0) {
      return [{ id: 'none', name: 'Без стадии', order: -1 }, ...list]
    }
    if (hasUnassigned) return [{ id: 'none', name: 'Без стадии', order: 0 }]
    return list
  }, [pipeline, leads])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pipeData, leadsData] = await Promise.all([
        getPipelines(),
        getLeadsForPipeline(),
      ])
      setPipelines(Array.isArray(pipeData) ? pipeData : [])
      setLeads(Array.isArray(leadsData) ? leadsData : [])
    } catch {
      setPipelines([])
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useV2RealtimeRefetch(load)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const leadsByStage = useMemo(() => {
    const map = new Map<string | number, PipelineLead[]>()
    stages.forEach((s) => map.set(s.id, []))
    leads.forEach((lead) => {
      if (!canMoveAny && lead.assigned_to_id != null && String(lead.assigned_to_id) !== String(userId)) return
      const stageId = lead.stage_id ?? 'none'
      if (!map.has(stageId)) map.set(stageId, [])
      map.get(stageId)!.push(lead)
    })
    return map
  }, [leads, stages, canMoveAny, userId])

  const canMoveLead = useCallback(
    (lead: PipelineLead) => {
      if (canMoveAny) return true
      return lead.assigned_to_id != null && String(lead.assigned_to_id) === String(userId)
    },
    [canMoveAny, userId],
  )

  const handleDragStart = (e: React.DragEvent, lead: PipelineLead, stageId: string | number) => {
    if (!canMoveLead(lead)) {
      e.preventDefault()
      return
    }
    setDragLeadId(lead.id)
    setDragStageId(stageId)
    e.dataTransfer.setData('text/plain', String(lead.id))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, targetStageId: string | number) => {
    e.preventDefault()
    const leadId = e.dataTransfer.getData('text/plain')
    if (!leadId || String(targetStageId) === String(dragStageId)) {
      setDragLeadId(null)
      setDragStageId(null)
      return
    }
    const lead = leads.find((l) => String(l.id) === leadId)
    if (!lead || !canMoveLead(lead)) {
      setDragLeadId(null)
      setDragStageId(null)
      return
    }
    setDragLeadId(null)
    setDragStageId(null)
    const prevLeads = [...leads]
    setLeads((prev) =>
      prev.map((l) => (String(l.id) === leadId ? { ...l, stage_id: targetStageId } : l)),
    )
    try {
      await patchLeadStage(leadId, targetStageId)
    } catch {
      setLeads(prevLeads)
      setToast('Не удалось переместить')
    }
  }

  const handleOpenLead = (lead: PipelineLead) => {
    navigate(`/leads/${lead.id}`)
  }

  const handleSaveStages = async (newStages: PipelineStage[]) => {
    if (!pipeline?.id) return
    setStagesSaving(true)
    try {
      await updatePipelineStages(pipeline.id, newStages)
      setPipelines((prev) =>
        prev.map((p) =>
          p.id === pipeline.id ? { ...p, stages: newStages } : p,
        ),
      )
      setStagesModalOpen(false)
      setToast('Стадии сохранены')
    } catch {
      setToast('Ошибка сохранения')
    } finally {
      setStagesSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page-stack v2-pipeline-page">
        <h1 className="title">Воронка</h1>
        <div className="info-text">Загрузка…</div>
      </div>
    )
  }

  return (
    <div className="page-stack v2-pipeline-page">
      <div className="page-header v2-leads-header">
        <h1 className="title">Воронка</h1>
        <div className="action-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="ghost-button" onClick={load}>
            Обновить
          </button>
          {canMoveAny && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setStagesModalOpen(true)}
            >
              Настроить стадии
            </button>
          )}
        </div>
      </div>
      {toast && <div className="v2-toast" role="status">{toast}</div>}
      {stages.length === 0 ? (
        <div className="card">
          <div className="info-text">
            Нет стадий. {canMoveAny ? 'Нажмите «Настроить стадии» и добавьте стадии.' : 'Обратитесь к администратору.'}
          </div>
        </div>
      ) : (
        <div className="v2-kanban">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className="v2-kanban-column"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              <div className="v2-kanban-column-header">
                <span className="v2-kanban-column-title">{stage.name}</span>
                <span className="v2-kanban-column-count">
                  {(leadsByStage.get(stage.id) ?? []).length}
                </span>
              </div>
              <div className="v2-kanban-column-cards">
                {(leadsByStage.get(stage.id) ?? []).map((lead) => (
                  <div
                    key={lead.id}
                    className={`v2-kanban-card ${dragLeadId === lead.id ? 'v2-kanban-card--dragging' : ''} ${!canMoveLead(lead) ? 'v2-kanban-card--readonly' : ''}`}
                    draggable={canMoveLead(lead)}
                    onDragStart={(e) => handleDragStart(e, lead, stage.id)}
                    onClick={() => handleOpenLead(lead)}
                  >
                    <div className="v2-kanban-card-name">{lead.name || 'Без имени'}</div>
                    <div className="v2-kanban-card-phone">{truncate(lead.phone, 20)}</div>
                    <div className="v2-kanban-card-meta">{lead.city || '—'}</div>
                    {(lead.object || lead.area) && (
                      <div className="v2-kanban-card-meta">
                        {[lead.object, lead.area].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {lead.assigned_to_name && (
                      <div className="v2-kanban-card-assigned">{lead.assigned_to_name}</div>
                    )}
                    {lead.last_comment && (
                      <div className="v2-kanban-card-comment">{truncate(lead.last_comment, 50)}</div>
                    )}
                    <div className="v2-kanban-card-date">{formatDate(lead.created_at ?? lead.date)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {stagesModalOpen && pipeline && (
        <PipelineStagesModal
          stages={stages}
          onSave={handleSaveStages}
          onClose={() => setStagesModalOpen(false)}
          saving={stagesSaving}
        />
      )}
    </div>
  )
}

type PipelineStagesModalProps = {
  stages: PipelineStage[]
  onSave: (stages: PipelineStage[]) => void
  onClose: () => void
  saving: boolean
}

function PipelineStagesModal({ stages: initial, onSave, onClose, saving }: PipelineStagesModalProps) {
  const [stages, setStages] = useState<PipelineStage[]>(() =>
    initial.length ? [...initial] : [{ id: 'new-1', name: 'Новая', order: 0 }],
  )
  const [editingId, setEditingId] = useState<string | number | null>(null)
  const [editName, setEditName] = useState('')

  const updateName = (id: string | number, name: string) => {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
  }

  const addStage = () => {
    const nextOrder = stages.length
    setStages((prev) => [...prev, { id: `new-${Date.now()}`, name: 'Новая стадия', order: nextOrder }])
  }

  const removeStage = (id: string | number) => {
    setStages((prev) => prev.filter((s) => s.id !== id))
    if (editingId === id) setEditingId(null)
  }

  const moveStage = (index: number, dir: -1 | 1) => {
    const next = [...stages]
    const j = index + dir
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j], next[index]]
    setStages(next.map((s, i) => ({ ...s, order: i })))
  }

  const handleSave = () => {
    onSave(stages.map((s, i) => ({ ...s, order: i })))
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog v2-stages-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">Настроить стадии</h2>
        <ul className="v2-stages-list">
          {stages.map((s, index) => (
            <li key={s.id} className="v2-stages-list-item">
              <span className="v2-stages-drag">
                <button type="button" className="ghost-button" onClick={() => moveStage(index, -1)} disabled={index === 0}>↑</button>
                <button type="button" className="ghost-button" onClick={() => moveStage(index, 1)} disabled={index === stages.length - 1}>↓</button>
              </span>
              {editingId === s.id ? (
                <input
                  className="field-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => {
                    updateName(s.id, editName || s.name)
                    setEditingId(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      updateName(s.id, editName || s.name)
                      setEditingId(null)
                    }
                  }}
                  autoFocus
                />
              ) : (
                <span
                  className="v2-stages-name"
                  onClick={() => {
                    setEditingId(s.id)
                    setEditName(s.name)
                  }}
                >
                  {s.name}
                </span>
              )}
              <button
                type="button"
                className="ghost-button v2-stages-remove"
                onClick={() => removeStage(s.id)}
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="secondary-button" onClick={addStage}>
          Добавить стадию
        </button>
        <div className="dialog-actions" style={{ marginTop: 16 }}>
          <button type="button" className="ghost-button" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="primary-button" onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PipelinePage
