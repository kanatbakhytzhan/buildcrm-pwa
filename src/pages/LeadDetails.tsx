import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Phone, MessageCircle, MapPin, FileText } from 'lucide-react'
import { useLeads } from '../context/LeadsContext'
import { sanitizePhoneForTel, sanitizePhoneForWa } from '../utils/phone'
import ThreeDotsMenu from '../components/ThreeDotsMenu'
import ConfirmDialog from '../components/ConfirmDialog'
import { getCachedLeadById } from '../services/offlineDb'
import type { NormalizedLead } from '../utils/normalizeLead'

const LeadDetails = () => {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { getLeadById, updateLeadStatus, deleteLead } = useLeads()
  const leadFromContext = id ? getLeadById(id) : undefined
  const [cachedLead, setCachedLead] = useState<NormalizedLead | null>(null)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const lead = leadFromContext ?? cachedLead ?? undefined
  const [statusLoading, setStatusLoading] = useState<
    'success' | 'failed' | null
  >(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const handleOffline = () => setIsOffline(true)
    const handleOnline = () => setIsOffline(false)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  useEffect(() => {
    if (!id || leadFromContext) {
      setCachedLead(null)
      return
    }
    let active = true
    getCachedLeadById(id).then((cached) => {
      if (active) {
        setCachedLead(cached ?? null)
      }
    })
    return () => {
      active = false
    }
  }, [id, leadFromContext])

  const phoneValue = lead?.phone?.trim() || ''
  const phoneTel = phoneValue ? sanitizePhoneForTel(phoneValue) : ''
  const phoneWa = phoneValue ? sanitizePhoneForWa(phoneValue) : ''
  const phoneMissing = !phoneTel || !phoneWa
  const initials = lead?.name
    ? lead.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('')
    : 'Л'

  const handleCall = () => {
    if (!phoneTel) {
      return
    }
    window.location.href = `tel:${phoneTel}`
  }

  const handleWhatsApp = () => {
    if (!phoneWa) {
      return
    }
    window.location.href = `https://wa.me/${phoneWa}`
  }

  const handleStatusChange = async (status: 'success' | 'failed') => {
    if (!lead) {
      return
    }
    setActionError(null)
    setStatusLoading(status)
    try {
      await updateLeadStatus(lead.id, status)
      navigate('/leads', { replace: true })
    } catch {
      setActionError('Не удалось обновить статус. Попробуйте снова.')
    } finally {
      setStatusLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!lead) {
      return
    }
    setActionError(null)
    setDeleteLoading(true)
    try {
      await deleteLead(lead.id)
      navigate('/leads', { replace: true })
    } catch {
      setActionError('Не удалось удалить лид. Попробуйте снова.')
    } finally {
      setDeleteLoading(false)
      setConfirmOpen(false)
    }
  }

  const handleBack = () => {
    navigate('/leads')
  }

  return (
    <div className="page-stack">
      <div className="lead-details-header">
        <button className="back-button" type="button" onClick={handleBack} aria-label="Назад">
          <ArrowLeft size={20} />
        </button>
        <h1 className="lead-details-title">Заявка #{lead?.id || '—'}</h1>
        {lead ? (
          <ThreeDotsMenu
            items={[
              {
                label: 'Удалить лид',
                onClick: () => setConfirmOpen(true),
                tone: 'danger',
              },
            ]}
          />
        ) : (
          <span className="lead-details-spacer" />
        )}
      </div>
      {lead ? (
        <>
          <div className="card lead-profile-card">
            <div className="lead-avatar">{initials}</div>
            <div className="lead-profile-info">
              <div className="lead-name">{lead.name || 'Без имени'}</div>
              <div className="lead-phone">
                {phoneValue || 'Телефон не указан'}
              </div>
            </div>
          </div>
          <div className="lead-actions">
            <button
              className="success-button"
              type="button"
              onClick={handleCall}
              disabled={phoneMissing}
            >
              <Phone size={20} />
              Позвонить
            </button>
            <button
              className="success-outline-button"
              type="button"
              onClick={handleWhatsApp}
              disabled={phoneMissing}
            >
              <MessageCircle size={20} />
              WhatsApp
            </button>
          </div>
          {phoneMissing && <div className="info-text">Телефон не указан</div>}
          <div className="details-section details-section--with-icon">
            <div className="details-section-icon details-section-icon--blue">
              <MapPin size={18} />
            </div>
            <div className="details-section-body">
              <div className="details-section-title">ЛОКАЦИЯ</div>
              <div className="details-section-content">
                {lead.city || '—'}
              </div>
            </div>
            <span className="details-section-chevron" aria-hidden="true">›</span>
          </div>
          <div className="details-section details-section--with-icon">
            <div className="details-section-icon details-section-icon--orange">
              <FileText size={18} />
            </div>
            <div className="details-section-body">
              <div className="details-section-title">ДЕТАЛИ ЗАПРОСА</div>
              <div className="details-section-content">
                {lead.request || '—'}
              </div>
            </div>
            <span className="details-section-chevron" aria-hidden="true">›</span>
          </div>
          <div className="details-sticky">
            <div className="details-actions">
              <button
                className="details-action-reject"
                type="button"
                onClick={() => handleStatusChange('failed')}
                disabled={Boolean(statusLoading) || deleteLoading}
              >
                {statusLoading === 'failed' ? 'Сохраняю…' : 'Отказать'}
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => handleStatusChange('success')}
                disabled={Boolean(statusLoading) || deleteLoading}
              >
                {statusLoading === 'success' ? 'Сохраняю…' : 'Взять в работу'}
              </button>
            </div>
            {actionError && <div className="error-text">{actionError}</div>}
          </div>
          <ConfirmDialog
            open={confirmOpen}
            title="Удалить лид?"
            text="Лид будет удалён без возможности восстановления."
            confirmLabel={deleteLoading ? 'Удаляю…' : 'Удалить'}
            cancelLabel="Отмена"
            onCancel={() => setConfirmOpen(false)}
            onConfirm={handleDelete}
          />
        </>
      ) : (
        <p className="subtitle">
          {isOffline
            ? 'Нет сохранённых данных. Подключитесь к интернету.'
            : 'Заявка не найдена'}
        </p>
      )}
    </div>
  )
}

export default LeadDetails
