import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Phone, MessageCircle, CheckCircle, XCircle } from 'lucide-react'
import type { NormalizedLead } from '../utils/normalizeLead'

type LeadActionSheetProps = {
  lead: NormalizedLead
  onClose: () => void
  onCall: () => void
  onWhatsApp: () => void
  onSuccess: () => void
  onFailed: () => void
  phoneAvailable: boolean
}

const LeadActionSheet = ({
  lead,
  onClose,
  onCall,
  onWhatsApp,
  onSuccess,
  onFailed,
  phoneAvailable,
}: LeadActionSheetProps) => {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const sheet = (
    <div
      className="action-sheet-backdrop"
      role="dialog"
      aria-label="Действия с заявкой"
      aria-modal="true"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Enter' && onClose()}
    >
      <div
        className="action-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="action-sheet-title">{lead.name || 'Без имени'}</div>
        <div className="action-sheet-actions">
          {phoneAvailable && (
            <>
              <button
                type="button"
                className="action-sheet-item"
                onClick={() => {
                  onCall()
                  onClose()
                }}
              >
                <Phone size={20} />
                <span>Позвонить</span>
              </button>
              <button
                type="button"
                className="action-sheet-item"
                onClick={() => {
                  onWhatsApp()
                  onClose()
                }}
              >
                <MessageCircle size={20} />
                <span>WhatsApp</span>
              </button>
            </>
          )}
          <button
            type="button"
            className="action-sheet-item action-sheet-item--success"
            onClick={() => {
              onSuccess()
              onClose()
            }}
          >
            <CheckCircle size={20} />
            <span>Взять в работу</span>
          </button>
          <button
            type="button"
            className="action-sheet-item action-sheet-item--danger"
            onClick={() => {
              onFailed()
              onClose()
            }}
          >
            <XCircle size={20} />
            <span>Отказать</span>
          </button>
        </div>
        <button
          type="button"
          className="action-sheet-cancel"
          onClick={onClose}
        >
          Отмена
        </button>
      </div>
    </div>
  )

  return createPortal(sheet, document.body)
}

export default LeadActionSheet
