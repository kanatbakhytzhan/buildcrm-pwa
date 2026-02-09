import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useLeads } from '../context/LeadsContext'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { useStages } from '../hooks/useStages'
import { KanbanBoard } from '../components/kanban'
import LeadDetails from './LeadDetails'
import './Leads.css'
import { categoryToStageKey } from '../types/stage'

export function Leads() {
  const navigate = useNavigate()
  const { isDesktop } = useBreakpoint()
  const [searchParams] = useSearchParams()
  const selectedLeadId = searchParams.get('id')

  const {
    leads,
    error,
    loadLeads,
    showToast,
    updateLeadInState,
  } = useLeads()

  const { stages } = useStages()
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    loadLeads()
  }, [loadLeads])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await loadLeads()
    } finally {
      setIsRefreshing(false)
    }
  }, [loadLeads])

  // Handle lead drag & drop between kanban columns
  const handleLeadMove = useCallback(
    async (leadId: string, toStageKey: string) => {
      const lead = leads.find(l => l.id === leadId)
      if (!lead) return

      // Get current stage_key (prefer stage_key, fallback to category mapping)
      const currentStageKey = lead.stage_key || categoryToStageKey(lead.category)
      if (currentStageKey === toStageKey) return // No change

      const toStage = stages.find(s => s.key === toStageKey)
      const stageName = toStage?.title || toStageKey

      // Optimistic update
      const previousLead = { ...lead }
      await updateLeadInState(leadId, { stage_key: toStageKey })

      try {
        // Call API to update stage (prefer stage_id when available)
        const api = await import('../services/api')
        if (toStage?.id != null) {
          try {
            await api.patchLeadStage(leadId, toStage.id)
          } catch (err) {
            const status = (err as { status?: number })?.status
            if (status === 422) {
              // Fallback to stage_key for older backends
              await api.updateLeadStage(leadId, toStageKey)
            } else {
              throw err
            }
          }
        } else {
          await api.updateLeadStage(leadId, toStageKey)
        }
        showToast(`Лид перемещен в "${stageName}"`)
      } catch (err) {
        // Rollback on error
        await updateLeadInState(leadId, { stage_key: previousLead.stage_key, category: previousLead.category })
        showToast('Не удалось переместить лид')
        console.error('[Leads] Move failed:', err)
      }
    },
    [leads, stages, updateLeadInState, showToast]
  )

  // Handle lead click
  const handleLeadClick = useCallback(
    (leadId: string) => {
      if (isDesktop) {
        window.history.pushState({}, '', `/leads/${leadId}`)
      } else {
        navigate(`/leads/${leadId}`)
      }
    },
    [isDesktop, navigate]
  )

  const selectedLead = leads.find(l => l.id === selectedLeadId)

  // Desktop: Kanban Board + Details Panel
  if (isDesktop) {
    return (
      <div className="leads-split-view">
        <div className="leads-split-view__kanban">
          <div className="leads-page__header">
            <div className="page-header">
              <div className="page-header__text">
                <h1 className="title">Заявки</h1>
                <p className="subtitle">Kanban доска</p>
              </div>
              <button
                className="ghost-button"
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? <Loader2 size={16} className="spin" /> : 'Обновить'}
              </button>
            </div>
          </div>

          {/* Kanban Board */}
          <div className="kanban-container">
            {error && <div className="error-text">{error}</div>}
            {!error && (
              <KanbanBoard
                stages={stages}
                leads={leads}
                onLeadMove={handleLeadMove}
                onLeadClick={handleLeadClick}
                selectedLeadId={selectedLeadId}
              />
            )}
          </div>
        </div>

        {/* Details Panel */}
        <div className="leads-split-view__details">
          {selectedLead ? (
            <LeadDetails />
          ) : (
            <div className="empty-selection">
              <p>Выберите заявку для просмотра деталей</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Mobile: Tabs + List (TODO: later - for now just show kanban)
  return (
    <div className="leads-page">
      <div className="leads-page__header">
        <div className="page-header">
          <h1 className="title">Заявки</h1>
          <button
            className="ghost-button"
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? <Loader2 size={16} className="spin" /> : 'Обновить'}
          </button>
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}
      {!error && (
        <KanbanBoard
          stages={stages}
          leads={leads}
          onLeadMove={handleLeadMove}
          onLeadClick={handleLeadClick}
          selectedLeadId={selectedLeadId}
        />
      )}
    </div>
  )
}

export default Leads

