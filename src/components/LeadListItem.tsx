import { useRef, useState, useCallback } from 'react'
import { MapPin, ChevronRight, Clock } from 'lucide-react'
import type { NormalizedLead } from '../utils/normalizeLead'
import { formatBadgeAlmatyFix } from '../utils/dateFormat'
import { sanitizePhoneForTel, sanitizePhoneForWa } from '../utils/phone'
import { useLeads } from '../context/LeadsContext'
import LeadActionSheet from './LeadActionSheet'

const LONG_PRESS_MS = 400
const MOVE_THRESHOLD_PX = 10

type LeadListItemProps = {
  lead: NormalizedLead
  onClick: () => void
  pendingSync?: boolean
}

const LeadListItem = ({ lead, onClick, pendingSync }: LeadListItemProps) => {
  const { updateLeadStatus } = useLeads()
  const [menuOpen, setMenuOpen] = useState(false)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressHandledRef = useRef(false)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)

  const formattedDateTime = formatBadgeAlmatyFix(lead.createdAt)
  const cityLabel = lead.city || 'Город не указан'
  const phoneValue = lead.phone?.trim() || ''
  const phoneTel = phoneValue ? sanitizePhoneForTel(phoneValue) : ''
  const phoneWa = phoneValue ? sanitizePhoneForWa(phoneValue) : ''
  const phoneAvailable = Boolean(phoneTel && phoneWa)

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

  const handleSuccess = useCallback(() => {
    updateLeadStatus(lead.id, 'success')
  }, [lead.id, updateLeadStatus])

  const handleFailed = useCallback(() => {
    updateLeadStatus(lead.id, 'failed')
  }, [lead.id, updateLeadStatus])

  return (
    <>
      <button
        type="button"
        className={`lead-item lead-item--${lead.status}`}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="lead-item__stripe" aria-hidden="true" />
        <div className="lead-item__content">
          <div className="lead-item__name">{lead.name || 'Без имени'}</div>
          <div className="lead-item__meta">
            <span className="lead-item__icon" aria-hidden="true">
              <MapPin size={16} />
            </span>
            <span>{cityLabel}</span>
          </div>
          <div className="lead-item__request">
            {lead.request || 'Без описания'}
          </div>
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
          onSuccess={handleSuccess}
          onFailed={handleFailed}
          phoneAvailable={phoneAvailable}
        />
      )}
    </>
  )
}

export default LeadListItem
