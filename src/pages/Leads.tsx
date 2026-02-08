import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useLeads } from '../context/LeadsContext'
import { useBreakpoint } from '../hooks/useBreakpoint'
import SegmentTabs from '../components/SegmentTabs'
import LeadListItem from '../components/LeadListItem'
import LeadDetails from './LeadDetails'
import './Leads.css'

type LeadStatusTab = 'new' | 'success' | 'failed'

const PULL_THRESHOLD = 50
const PULL_MAX = 80

const Leads = () => {
  const navigate = useNavigate()
  const { id: urlLeadId } = useParams()
  const { isDesktop } = useBreakpoint()
  const scrollRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const {
    leads,
    isLoading,
    error,
    loadLeads,
    pendingLeadIds,
  } = useLeads()
  const [activeTab, setActiveTab] = useState<LeadStatusTab>('new')
  const [pullY, setPullY] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(urlLeadId || null)

  useEffect(() => {
    loadLeads()
  }, [loadLeads])

  // Update selected lead when URL changes (for desktop split view)
  useEffect(() => {
    if (isDesktop && urlLeadId) {
      setSelectedLeadId(urlLeadId)
    }
  }, [urlLeadId, isDesktop])

  const handleRefresh = useCallback(async () => {
    await loadLeads()
  }, [loadLeads])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const el = scrollRef.current
    if (!el || isRefreshing) return
    if (el.scrollTop > 0) {
      setPullY(0)
      return
    }
    const currentY = e.touches[0].clientY
    const delta = currentY - startYRef.current
    if (delta > 0) {
      setPullY(Math.min(delta, PULL_MAX))
    }
  }, [isRefreshing])

  const handleTouchEnd = useCallback(() => {
    if (pullY >= PULL_THRESHOLD) {
      setIsRefreshing(true)
      handleRefresh().finally(() => {
        setIsRefreshing(false)
        setPullY(0)
      })
    } else {
      setPullY(0)
    }
  }, [pullY, handleRefresh])

  const tabs = useMemo<{ id: LeadStatusTab; label: string }[]>(
    () => [
      { id: 'new', label: 'Новые' },
      { id: 'success', label: 'Успешные' },
      { id: 'failed', label: 'Отказные' },
    ],
    [],
  )

  const filteredLeads = leads.filter((lead) => lead.status === activeTab)

  const handleLeadClick = (leadId: string) => {
    if (isDesktop) {
      // Desktop: update selected lead for split view
      setSelectedLeadId(leadId)
      // Update URL without navigation
      window.history.pushState({}, '', `/leads/${leadId}`)
    } else {
      // Mobile: navigate to details page
      navigate(`/leads/${leadId}`)
    }
  }

  const selectedLead = leads.find((l) => l.id === selectedLeadId)

  // Desktop: Split View
  if (isDesktop) {
    return (
      <div className="leads-split-view">
        <div className="leads-split-view__list">
          <div className="leads-page__header">
            <div className="page-header">
              <div className="page-header__text">
                <h1 className="title">Заявки</h1>
                <p className="subtitle">Новые обращения клиентов</p>
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
            <SegmentTabs<LeadStatusTab>
              tabs={tabs}
              activeId={activeTab}
              onChange={(id) => setActiveTab(id)}
            />
          </div>
          <div className="leads-scroll">
            {isLoading && !isRefreshing && <div className="info-text">Загрузка заявок…</div>}
            {error && <div className="error-text">{error}</div>}
            {!isLoading && !error && filteredLeads.length === 0 && (
              <div className="info-text">Пока нет заявок</div>
            )}
            <div className="lead-list">
              {filteredLeads.map((lead) => (
                <LeadListItem
                  key={lead.id}
                  lead={lead}
                  pendingSync={pendingLeadIds.includes(lead.id)}
                  onClick={() => handleLeadClick(lead.id)}
                  isActive={lead.id === selectedLeadId}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="leads-split-view__details">
          {selectedLead ? (
            <LeadDetails embedded leadId={selectedLeadId!} />
          ) : (
            <div className="leads-split-view__empty">
              <p>Выберите заявку для просмотра деталей</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Mobile: List View (original behavior)
  return (
    <div className="leads-page">
      <div className="leads-page__header">
        <div className="page-header">
          <div className="page-header__text">
            <h1 className="title">Заявки</h1>
            <p className="subtitle">Новые обращения клиентов</p>
          </div>
          <button className="ghost-button" type="button" onClick={handleRefresh}>
            Обновить
          </button>
        </div>
        <SegmentTabs<LeadStatusTab>
          tabs={tabs}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id)}
        />
      </div>
      <div
        ref={scrollRef}
        className="leads-scroll"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="pull-indicator"
          style={{ height: pullY > 0 || isRefreshing ? Math.max(pullY, 56) : 0 }}
        >
          {isRefreshing ? (
            <Loader2 size={24} className="pull-indicator__spinner" />
          ) : pullY > 0 ? (
            <span className="pull-indicator__text">
              {pullY >= PULL_THRESHOLD ? 'Отпустите для обновления' : 'Потяните для обновления'}
            </span>
          ) : null}
        </div>
        {isLoading && !isRefreshing && <div className="info-text">Загрузка заявок…</div>}
        {error && <div className="error-text">{error}</div>}
        {!isLoading && !error && filteredLeads.length === 0 && (
          <div className="info-text">Пока нет заявок</div>
        )}
        <div className="lead-list">
          {filteredLeads.map((lead) => (
            <LeadListItem
              key={lead.id}
              lead={lead}
              pendingSync={pendingLeadIds.includes(lead.id)}
              onClick={() => handleLeadClick(lead.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Leads
