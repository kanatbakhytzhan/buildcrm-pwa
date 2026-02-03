import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Bot, MessageCircle, MapPin, FileText, MessageSquare, Phone } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLeads } from '../context/LeadsContext'
import { sanitizePhoneForTel, sanitizePhoneForWa } from '../utils/phone'
import ThreeDotsMenu from '../components/ThreeDotsMenu'
import ConfirmDialog from '../components/ConfirmDialog'
import { getCachedLeadById } from '../services/offlineDb'
import {
  createLeadTask,
  getLeadAiStatus,
  getLeadComments,
  postLeadAiMute,
  postLeadComment,
  type LeadComment,
} from '../services/api'
import { formatBadgeAlmatyFix } from '../utils/dateFormat'
import type { NormalizedLead } from '../utils/normalizeLead'

const AI_MUTE_NO_TENANT_MESSAGE =
  'У этого лида не указан клиент (tenant). Сначала привяжите лид к клиенту или выполните исправление в админ-диагностике.'

const LeadDetails = () => {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { getLeadById, updateLeadStatus, deleteLead, showToast, updateLeadInState } = useLeads()
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
  const [comments, setComments] = useState<LeadComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [aiMutedInChat, setAiMutedInChat] = useState(false)
  const [aiEnabledGlobal, setAiEnabledGlobal] = useState(true)
  const [aiChatLoading, setAiChatLoading] = useState(false)
  const [aiChatStatusLoading, setAiChatStatusLoading] = useState(false)
  const [aiMuteError, setAiMuteError] = useState<string | null>(null)
  const [leadHasNoTenantId, setLeadHasNoTenantId] = useState(false)
  const [taskDueAt, setTaskDueAt] = useState('')
  const [taskComment, setTaskComment] = useState('')
  const [taskSubmitting, setTaskSubmitting] = useState(false)

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

  const loadComments = useCallback(async () => {
    if (!id) return
    setCommentsLoading(true)
    try {
      const list = await getLeadComments(id)
      setComments(Array.isArray(list) ? list : [])
    } catch {
      setComments([])
    } finally {
      setCommentsLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id && lead) {
      loadComments()
    } else {
      setComments([])
    }
  }, [id, lead, loadComments])

  useEffect(() => {
    if (!id) return
    setAiChatStatusLoading(true)
    getLeadAiStatus(id)
      .then((res) => {
        setAiMutedInChat(res.ai_muted_in_chat === true)
        setAiEnabledGlobal(res.ai_enabled_global !== false)
      })
      .catch(() => {
        setAiMutedInChat(false)
        setAiEnabledGlobal(true)
      })
      .finally(() => setAiChatStatusLoading(false))
  }, [id])

  const handleAiChatToggle = async (muted: boolean) => {
    if (!id) return
    setAiMuteError(null)
    setAiChatLoading(true)
    try {
      await postLeadAiMute(id, { muted })
      setAiMutedInChat(muted)
      setLeadHasNoTenantId(false)
      showToast('Готово')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const isNoTenant =
        /Lead has no tenant_id|no tenant_id|cannot set per-chat mute/i.test(msg)
      if (isNoTenant) {
        setAiMuteError(AI_MUTE_NO_TENANT_MESSAGE)
        setLeadHasNoTenantId(true)
      } else {
        showToast('Не удалось изменить')
      }
    } finally {
      setAiChatLoading(false)
    }
  }

  const handleAiMuteRetry = () => {
    setAiMuteError(null)
    setLeadHasNoTenantId(false)
    if (!id) return
    setAiChatStatusLoading(true)
    getLeadAiStatus(id)
      .then((res) => {
        setAiMutedInChat(res.ai_muted_in_chat === true)
        setAiEnabledGlobal(res.ai_enabled_global !== false)
      })
      .catch(() => {})
      .finally(() => setAiChatStatusLoading(false))
  }

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

  const handleCreateTask = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!id?.trim() || !taskDueAt.trim()) {
      showToast('Укажите дату и время')
      return
    }
    setTaskSubmitting(true)
    setActionError(null)
    try {
      await createLeadTask(id.trim(), {
        due_at: new Date(taskDueAt).toISOString(),
        comment: taskComment.trim() || undefined,
        type: 'call',
      })
      showToast('Задача создана')
      setTaskDueAt('')
      setTaskComment('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось создать задачу'
      showToast(msg)
      setActionError(msg)
    } finally {
      setTaskSubmitting(false)
    }
  }

  const handleAddComment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = commentText.trim()
    if (!trimmed) {
      showToast('Введите комментарий')
      return
    }
    const leadIdForApi = id.trim()
    if (!leadIdForApi) {
      showToast('Не удалось определить lead_id')
      return
    }
    setCommentSubmitting(true)
    setActionError(null)
    try {
      const newComment = await postLeadComment(leadIdForApi, trimmed)
      const commentBody = newComment?.body ?? (newComment as { text?: string })?.text ?? trimmed
      setCommentText('')
      await loadComments()
      setComments((prev) => {
        const added = { ...newComment, body: commentBody }
        const exists = prev.some((c) => String(c.id) === String(added.id))
        return exists ? prev : [added, ...prev]
      })
      if (lead?.id) {
        await updateLeadInState(lead.id, { last_comment: commentBody })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось добавить комментарий'
      showToast(msg)
      setActionError(msg)
    } finally {
      setCommentSubmitting(false)
    }
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
          {isAdmin && leadHasNoTenantId && (
            <div className="info-text" style={{ color: 'var(--danger)', marginBottom: 8 }}>
              tenant_id: отсутствует
            </div>
          )}
          <div className="details-section details-section--with-icon">
            <div className="details-section-icon details-section-icon--orange">
              <Phone size={18} />
            </div>
            <div className="details-section-body" style={{ flex: 1 }}>
              <div className="details-section-title">ЗАПЛАНИРОВАТЬ ЗВОНОК</div>
              <form className="comment-form" onSubmit={handleCreateTask} style={{ gap: 10 }}>
                <label className="field">
                  <span className="field-label">Дата и время</span>
                  <input
                    className="field-input"
                    type="datetime-local"
                    value={taskDueAt}
                    onChange={(e) => setTaskDueAt(e.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span className="field-label">Комментарий (необязательно)</span>
                  <input
                    className="field-input"
                    type="text"
                    value={taskComment}
                    onChange={(e) => setTaskComment(e.target.value)}
                    placeholder="Напомнить о…"
                  />
                </label>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={taskSubmitting}
                >
                  {taskSubmitting ? 'Создание…' : 'Создать задачу'}
                </button>
              </form>
            </div>
          </div>
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
          <div className="details-section details-section--comments">
            <div className="details-section-icon details-section-icon--blue">
              <MessageSquare size={18} />
            </div>
            <div className="details-section-body details-section-body--full">
              <div className="details-section-title">КОММЕНТАРИИ</div>
              {commentsLoading ? (
                <div className="info-text">Загрузка…</div>
              ) : comments.length === 0 ? (
                <div className="info-text">Комментариев пока нет</div>
              ) : (
                <ul className="comments-list">
                  {comments.map((c) => (
                    <li key={c.id} className="comment-item">
                      <div className="comment-body">{c.body ?? c.text ?? '—'}</div>
                      {(c.created_at || c.author) && (
                        <div className="comment-meta">
                          {c.author && <span>{c.author}</span>}
                          {c.created_at && (
                            <span>{formatBadgeAlmatyFix(c.created_at)}</span>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <form className="comment-form" onSubmit={handleAddComment}>
                <textarea
                  className="comment-input"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Добавить комментарий…"
                  rows={2}
                  disabled={commentSubmitting}
                />
                <button
                  className="primary-button comment-submit"
                  type="submit"
                  disabled={!commentText.trim() || commentSubmitting}
                >
                  {commentSubmitting ? 'Отправка…' : 'Добавить'}
                </button>
              </form>
            </div>
          </div>
          <div className="card settings-card" style={{ marginTop: 12 }}>
            <div className="settings-row settings-row--static">
              <div className="settings-left">
                <div className="settings-icon settings-icon--primary" aria-hidden="true">
                  <Bot size={20} />
                </div>
                <div className="settings-text">
                  <div className="settings-title">AI в этом чате</div>
                  <div className="settings-hint">
                    Когда выключено — бот не отвечает в этом чате, но лиды продолжают сохраняться.
                  </div>
                  {!aiEnabledGlobal && (
                    <div className="settings-hint" style={{ color: 'var(--danger)', marginTop: 4 }}>
                      AI выключен для всего клиента в настройках.
                    </div>
                  )}
                </div>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  aria-label="AI в этом чате"
                  checked={!aiMutedInChat}
                  disabled={aiChatLoading || aiChatStatusLoading || !aiEnabledGlobal}
                  onChange={(e) => handleAiChatToggle(e.target.checked ? false : true)}
                />
                <span className="switch-track">
                  <span className="switch-thumb" />
                </span>
              </label>
            </div>
            {aiMuteError && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div className="error-text" style={{ marginBottom: 8 }}>{aiMuteError}</div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={handleAiMuteRetry}
                  disabled={aiChatStatusLoading}
                >
                  {aiChatStatusLoading ? 'Загрузка…' : 'Обновить'}
                </button>
              </div>
            )}
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
