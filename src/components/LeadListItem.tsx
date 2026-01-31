import { useRef, useState, useCallback } from 'react'
import { MapPin, ChevronRight, Clock } from 'lucide-react'
import type { NormalizedLead } from '../utils/normalizeLead'
import { formatBadgeAlmatyFix } from '../utils/dateFormat'
import { sanitizePhoneForTel, sanitizePhoneForWa } from '../utils/phone'
import { useLeads } from '../context/LeadsContext'
import LeadActionSheet from './LeadActionSheet'

const LONG_PRESS_MS = 400

type LeadListItemProps = {
  lead: NormalizedLead
  onClick: () => void
  pendingSync?: boolean
}

const LeadListItem = ({ lead, onClick, pendingSync }: LeadListItemProps) => {
  const { updateLeadStatus } = useLeads()
  const [menuOpen, setMenuOpen] = useState(false)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressHandledRef = useRef(false)

  const formattedDateTime = formatBadgeAlmatyFix(lead.createdAt)
  const cityLabel = lead.city || 'Город не указан'
  const phoneValue = lead.phone?.trim() || ''
  const phoneTel = phoneValue ? sanitizePhoneForTel(phoneValue) : ''
  const phoneWa = phoneValue ? sanitizePhoneForWa(phoneValue) : ''
  const phoneAvailable = Boolean(phoneTel && phoneWa)

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const handlePointerDown = useCallback(() => {
    longPressHandledRef.current = false
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null
      longPressHandledRef.current = true
      setMenuOpen(true)
    }, LONG_PRESS_MS)
  }, [])

  const handlePointerUp = useCallback(() => {
    clearLongPressTimer()
  }, [clearLongPressTimer])

  const handlePointerLeave = useCallback(() => {
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
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
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
