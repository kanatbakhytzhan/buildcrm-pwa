import { useRef, useState, useCallback } from 'react'
import { MapPin, ChevronRight, Clock } from 'lucide-react'
import type { NormalizedLead } from '../utils/normalizeLead'
import { formatBadgeAlmatyFix } from '../utils/dateFormat'
import { sanitizePhoneForTel, sanitizePhoneForWa } from '../utils/phone'
import { useLeads } from '../context/LeadsContext'
import LeadActionSheet from './LeadActionSheet'
import { getCategoryColor } from '../utils/categoryColorMap'
import LeadCategoryBadge from './categories/LeadCategoryBadge'
import LeadCategoryBottomSheet from './categories/LeadCategoryBottomSheet'

const LONG_PRESS_MS = 400
const MOVE_THRESHOLD_PX = 10

type LeadListItemProps = {
  lead: NormalizedLead
  onClick: () => void
  pendingSync?: boolean
  isActive?: boolean
}

const LeadListItem = ({ lead, onClick, pendingSync, isActive = false }: LeadListItemProps) => {
  const { updateLeadCategory } = useLeads()
  const [menuOpen, setMenuOpen] = useState(false)
  const [categorySheetOpen, setCategorySheetOpen] = useState(false)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressHandledRef = useRef(false)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)

  const formattedDateTime = formatBadgeAlmatyFix(lead.createdAt)
  const cityLabel = lead.city || 'Город не указан'
  const phoneValue = lead.phone?.trim() || ''
  const phoneTel = phoneValue ? sanitizePhoneForTel(phoneValue) : ''
  const phoneWa = phoneValue ? sanitizePhoneForWa(phoneValue) : ''
  const phoneAvailable = Boolean(phoneTel && phoneWa)
  const categoryColor = getCategoryColor(lead.category)

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    pointerStartRef.current = null
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      pointerStartRef.current = { x: e.clientX, y: e.clientY }
      longPressHandledRef.current = false
      const target = e.currentTarget
      target.setPointerCapture?.(e.pointerId)
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null
        pointerStartRef.current = null
        longPressHandledRef.current = true
        setMenuOpen(true)
      }, LONG_PRESS_MS)
    },
    [],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const start = pointerStartRef.current
      if (!start) return
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (Math.abs(dx) > MOVE_THRESHOLD_PX || Math.abs(dy) > MOVE_THRESHOLD_PX) {
        clearLongPressTimer()
      }
    },
    [clearLongPressTimer],
  )

  const handlePointerUp = useCallback(() => {
    clearLongPressTimer()
  }, [clearLongPressTimer])

  const handlePointerCancel = useCallback(() => {
    clearLongPressTimer()
  }, [clearLongPressTimer])

  const handleClick = useCallback(() => {
    if (longPressHandledRef.current) {
      longPressHandledRef.current = false
      return
    }
    onClick()
  }, [onClick])

  const handleCall = useCallback(() => {
    if (phoneTel) window.location.href = `tel:${phoneTel}`
  }, [phoneTel])

  const handleWhatsApp = useCallback(() => {
    if (phoneWa) window.location.href = `https://wa.me/${phoneWa}`
  }, [phoneWa])

  const handleChangeCategory = useCallback(() => {
    setMenuOpen(false)
    setCategorySheetOpen(true)
  }, [])

  return (
    <>
      <button
        type="button"
        className={`lead-item ${isActive ? 'lead-item--active' : ''}`}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ '--lead-color': categoryColor } as React.CSSProperties}
      >
        <span className="lead-item__stripe" aria-hidden="true" style={{ backgroundColor: categoryColor }} />
        <div className="lead-item__content">
          <div className="lead-item__header-row">
            <div className="lead-item__name">{lead.name || 'Без имени'}</div>
            <LeadCategoryBadge category={lead.category} />
          </div>
          <div className="lead-item__meta">
            <span className="lead-item__icon" aria-hidden="true">
              <MapPin size={16} />
            </span>
            <span>{cityLabel}</span>
          </div>
          <div className="lead-item__request">
            {lead.request || 'Без описания'}
          </div>
          {(lead.last_comment != null || (lead.comments_count != null && lead.comments_count > 0)) && (
            <div className="lead-item__comments-hint">
              {lead.last_comment
                ? (lead.last_comment.length > 40 ? `${lead.last_comment.slice(0, 40)}…` : lead.last_comment)
                : `Комментариев: ${lead.comments_count}`}
            </div>
          )}
        </div>
        <div className="lead-item__side">
          <div className="lead-item__badge">{formattedDateTime}</div>
          {pendingSync && (
            <div className="pending-indicator">
              <Clock size={12} />
              Ожидает синхронизации
            </div>
          )}
          <span className="lead-item__chevron" aria-hidden="true">
            <ChevronRight size={18} />
          </span>
        </div>
      </button>

      {menuOpen && (
        <LeadActionSheet
          lead={lead}
          onClose={() => setMenuOpen(false)}
          onCall={handleCall}
          onWhatsApp={handleWhatsApp}
          onChangeCategory={handleChangeCategory}
          phoneAvailable={phoneAvailable}
        />
      )}

      {categorySheetOpen && (
        <LeadCategoryBottomSheet
          currentCategory={lead.category}
          onSelect={(cat) => {
            updateLeadCategory(lead.id, cat)
            setCategorySheetOpen(false)
          }}
          onClose={() => setCategorySheetOpen(false)}
        />
      )}
    </>
  )
}

export default LeadListItem
