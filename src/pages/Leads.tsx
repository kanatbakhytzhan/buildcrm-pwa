import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Loader2, X } from 'lucide-react'
import { useLeads } from '../context/LeadsContext'
import { useBreakpoint } from '../hooks/useBreakpoint'
// import SegmentTabs from '../components/SegmentTabs'
import LeadListItem from '../components/LeadListItem'
import LeadDetails from './LeadDetails'
import './Leads.css'
import LeadCategoryFilter from '../components/categories/LeadCategoryFilter'
import type { LeadCategory } from '../types/leadCategory'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { getCategoryConfig } from '../utils/categoryColorMap'
import type { LeadScoreLevel } from '../types/leadScore'

const PULL_THRESHOLD = 50
const PULL_MAX = 80

const Leads = () => {
  const navigate = useNavigate()
  const { id: urlLeadId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
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

  const categoryParam = searchParams.get('category')
  const [activeCategory, setActiveCategory] = useState<LeadCategory | 'all'>(
    (categoryParam as LeadCategory) || 'all'
  )
  const [scoreFilter, setScoreFilter] = useState<LeadScoreLevel | 'all'>('all')
  const [reactionMinutes, setReactionMinutes] = useState<number | null>(null)

  const [pullY, setPullY] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(urlLeadId || null)

  useEffect(() => {
    loadLeads()
  }, [loadLeads])

  // Sync state with URL param
  useEffect(() => {
    const cat = searchParams.get('category')
    if (cat) {
      setActiveCategory(cat as LeadCategory)
    } else {
      setActiveCategory('all')
    }
  }, [searchParams])

  // Update selected lead when URL changes
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

  const filteredLeads = leads.filter((lead) => {
    // Category filter
    if (activeCategory !== 'all' && lead.category !== activeCategory) {
      return false
    }

    // Score filter
    if (scoreFilter !== 'all') {
      if (!lead.score) return false
      const level = lead.score >= 70 ? 'hot' : lead.score >= 40 ? 'warm' : 'cold'
      if (level !== scoreFilter) return false
    }

    // Reaction time filter ("без ответа > X минут")
    if (reactionMinutes !== null && lead.lastClientMessageAt) {
      const minutesSince = (Date.now() - new Date(lead.lastClientMessageAt).getTime()) / 60000
      if (minutesSince < reactionMinutes) return false
    }

    return true
  })

  // Sort: no_reply first, then wants_call, then by update time
  const sortedLeads = [...filteredLeads].sort((a, b) => {
    const aConfig = getCategoryConfig(a.category)
    const bConfig = getCategoryConfig(b.category)

    // Priority categories first (no_reply=1, wants_call=2)
    if (aConfig.order !== bConfig.order) {
      return aConfig.order - bConfig.order
    }

    // Within same category, sort by most recent
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const handleCategoryChange = (category: LeadCategory | 'all') => {
    setActiveCategory(category)
    setSearchParams(prev => {
      if (category === 'all') {
        prev.delete('category')
      } else {
        prev.set('category', category)
      }
      return prev
    })
  }

  const handleLeadClick = (leadId: string) => {
    if (isDesktop) {
      setSelectedLeadId(leadId)
      window.history.pushState({}, '', `/leads/${leadId}`)
    } else {
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
                <p className="subtitle">Обращения клиентов</p>
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
            <div className="category-filter-container">
              <LeadCategoryFilter
                activeCategory={activeCategory}
                onChange={handleCategoryChange}
              />

              {/* Score and Reaction Time Filters */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px', paddingLeft: '16px', paddingRight: '16px' }}>
                {/* Score filter */}
                <select
                  value={scoreFilter}
                  onChange={(e) => setScoreFilter(e.target.value as LeadScoreLevel | 'all')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--surface)',
                    fontSize: '14px',
                  }}
                >
                  <option value="all">Все score</option>
                  <option value="hot">🔥 Горячий</option>
                  <option value="warm">🟡 Теплый</option>
                  <option value="cold">❄️ Холодный</option>
                </select>

                {/* Reaction time chips */}
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginRight: '4px' }}>Без ответа:</span>
                  {[5, 15, 30].map(minutes => (
                    <button
                      key={minutes}
                      onClick={() => setReactionMinutes(reactionMinutes === minutes ? null : minutes)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        border: reactionMinutes === minutes ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        background: reactionMinutes === minutes ? 'var(--primary-bg)' : 'transparent',
                        color: reactionMinutes === minutes ? 'var(--primary)' : 'var(--text-secondary)',
                        fontSize: '13px',
                        cursor: 'pointer',
                        fontWeight: reactionMinutes === minutes ? '500' : '400',
                      }}
                    >
                      &gt;{minutes}м
                    </button>
                  ))}
                  {reactionMinutes !== null && (
                    <button
                      onClick={() => setReactionMinutes(null)}
                      style={{
                        padding: '2px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                      }}
                      aria-label="Сбросить фильтр"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="leads-scroll">
            {isLoading && !isRefreshing && (
              <div className="lead-list">
                {[...Array(5)].map((_, i) => (
                  <div key={i} style={{ padding: '12px', background: 'var(--surface)', borderRadius: 'var(--radius-md)', marginBottom: '8px' }}>
                    <Skeleton variant="title" width="60%" />
                    <div style={{ marginTop: '8px' }}><Skeleton variant="text" width="40%" /></div>
                    <div style={{ marginTop: '8px' }}><Skeleton variant="text" width="80%" /></div>
                  </div>
                ))}
              </div>
            )}
            {error && <div className="error-text">{error}</div>}
            {!isLoading && !error && sortedLeads.length === 0 && (
              <EmptyState
                title="Нет заявок"
                description={activeCategory === 'all' ? 'Заявки появятся здесь автоматически' : `Нет заявок в категории "${getCategoryConfig(activeCategory).label}"`}
              />
            )}
            {!isLoading && !error && sortedLeads.length > 0 && (
              <div className="lead-list">
                {sortedLeads.map((lead) => (
                  <LeadListItem
                    key={lead.id}
                    lead={lead}
                    pendingSync={pendingLeadIds.includes(lead.id)}
                    onClick={() => handleLeadClick(lead.id)}
                    isActive={lead.id === selectedLeadId}
                  />
                ))}
              </div>
            )}
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

  // Mobile: List View
  return (
    <div className="leads-page">
      <div className="leads-page__header">
        <div className="page-header">
          <div className="page-header__text">
            <h1 className="title">Заявки</h1>
            <p className="subtitle">Обращения клиентов</p>
          </div>
          <button className="ghost-button" type="button" onClick={handleRefresh}>
            Обновить
          </button>
        </div>
        <div className="category-filter-container">
          <LeadCategoryFilter
            activeCategory={activeCategory}
            onChange={handleCategoryChange}
          />
        </div>
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
        {!isLoading && !error && sortedLeads.length === 0 && (
          <div className="info-text">Нет заявок в этой категории</div>
        )}
        <div className="lead-list">
          {sortedLeads.map((lead) => (
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
