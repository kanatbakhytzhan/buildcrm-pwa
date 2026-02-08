import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useLeads } from '../context/LeadsContext'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { useStages } from '../hooks/useStages'
import { KanbanBoard } from '../components/kanban'
import LeadDetails from './LeadDetails'
import './Leads.css'
import { categoryToStageKey } from '../types/stage'
import type { LeadCategory } from '../types/leadCategory'

const Leads = () => {
  const navigate = useNavigate()
  const { id: urlLeadId } = useParams()
  const { isDesktop } = useBreakpoint()
  const {
    leads,
    error,
    loadLeads,
    updateLeadCategory,
    showToast,
  } = useLeads()

  const { stages } = useStages()
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(urlLeadId || null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    loadLeads()
  }, [loadLeads])

  // Update selected lead when URL changes
  useEffect(() => {
    if (isDesktop && urlLeadId) {
      setSelectedLeadId(urlLeadId)
    }
  }, [urlLeadId, isDesktop])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await loadLeads()
    } finally {
      setIsRefreshing(false)
    }
  }, [loadLeads])

  // Handle lead drag to new stage
  const handleLeadMove = useCallback(
    async (leadId: string, toStageKey: string) => {
      const lead = leads.find(l => l.id === leadId)
      if (!lead) return

      const currentStageKey = categoryToStageKey(lead.category)
      if (currentStageKey === toStageKey) return

      try {
        // Optimistic update happens in context
        await updateLeadCategory(leadId, toStageKey as LeadCategory)
        showToast(`Лид перемещен в "${stages.find(s => s.key === toStageKey)?.title}"`)
      } catch (err) {
        showToast('Ошибка при перемещении лида')
        // Rollback handled by context
      }
    },
    [leads, stages, updateLeadCategory, showToast]
  )

  // Handle lead click
  const handleLeadClick = useCallback(
    (leadId: string) => {
      if (isDesktop) {
        setSelectedLeadId(leadId)
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
