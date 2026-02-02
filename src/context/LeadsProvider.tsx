import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { LeadsContext } from './LeadsContext'
import { deleteLead as apiDeleteLead, getLeads, updateLeadStatus as apiUpdateLeadStatus } from '../services/api'
import { getToken } from '../services/auth'
import { normalizeLead, normalizeLeadStatus } from '../utils/normalizeLead'
import type { NormalizedLead } from '../utils/normalizeLead'
import {
  enqueueDelete,
  enqueueStatusUpdate,
  getCachedLeadById,
  getCachedLeads,
  getLastSyncAt,
  getOutboxCount,
  getOutboxItems,
  clearOutbox as clearOutboxDb,
  offlineDb,
  saveLeadsToCache,
} from '../services/offlineDb'
import { syncOutbox } from '../services/syncOutbox'

const POLL_LEADS_INTERVAL_MS = 15_000

const resolveStatusFromResponse = (
  data: unknown,
  fallback: NormalizedLead['status'],
) => {
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    const direct = record.status
    const leadStatus =
      (record.lead as Record<string, unknown> | undefined)?.status
    const dataStatus = (record.data as Record<string, unknown> | undefined)?.status
    const nestedLeadStatus = (
      (record.data as Record<string, unknown> | undefined)?.lead as
        | Record<string, unknown>
        | undefined
    )?.status
    return normalizeLeadStatus(
      direct ?? leadStatus ?? dataStatus ?? nestedLeadStatus ?? fallback,
    )
  }
  return normalizeLeadStatus(fallback)
}

export const LeadsProvider = ({ children }: { children: ReactNode }) => {
  const [leads, setLeads] = useState<NormalizedLead[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null)
  const [outboxCount, setOutboxCount] = useState(0)
  const [pendingLeadIds, setPendingLeadIds] = useState<string[]>([])
  const toastTimerRef = useRef<number | null>(null)
  const leadsRef = useRef<NormalizedLead[]>([])
  const syncingRef = useRef(false)
  const prevLeadIdsRef = useRef<Set<string> | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearToast = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
    }
    setToastMessage(null)
  }, [])

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
    }
    setToastMessage(message)
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null)
      toastTimerRef.current = null
    }, 3000)
  }, [])

  useEffect(() => {
    leadsRef.current = leads
  }, [leads])

  const refreshOutboxState = useCallback(async () => {
    const items = await offlineDb.outbox.toArray()
    const pendingIds = items
      .filter((item) => item.type === 'PATCH_STATUS')
      .map((item) => item.leadId)
    setPendingLeadIds(Array.from(new Set(pendingIds)))
    setOutboxCount(items.length)
  }, [])

  const runSync = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) {
      await refreshOutboxState()
      return { processed: 0, failed: 0, stoppedByAuth: false }
    }
    syncingRef.current = true
    const result = await syncOutbox()
    await refreshOutboxState()
    if (result.processed > 0 && result.failed === 0 && !result.stoppedByAuth) {
      showToast('Синхронизация завершена')
    }
    syncingRef.current = false
    return result
  }, [refreshOutboxState, showToast])

  const getOutboxItemsCallback = useCallback(() => getOutboxItems(), [])
  const clearOutboxCallback = useCallback(async () => {
    await clearOutboxDb()
    await refreshOutboxState()
  }, [refreshOutboxState])

  useEffect(() => {
    refreshOutboxState()
    if (navigator.onLine) {
      runSync()
    }
    const handleOnline = () => {
      runSync()
    }
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [refreshOutboxState, runSync])

  const applyOutboxToLeads = useCallback(async (items: NormalizedLead[]) => {
    const outboxItems = await offlineDb.outbox.orderBy('createdAt').toArray()
    if (outboxItems.length === 0) {
      return items
    }
    let updated = [...items]
    for (const item of outboxItems) {
      if (item.type === 'DELETE_LEAD') {
        updated = updated.filter((lead) => lead.id !== item.leadId)
        continue
      }
      if (item.type === 'PATCH_STATUS') {
        const status = normalizeLeadStatus(item.payload?.status)
        updated = updated.map((lead) =>
          lead.id === item.leadId ? { ...lead, status } : lead,
        )
      }
    }
    return updated
  }, [])

  const loadLeads = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await getLeads()
      const items = response.leads
      const normalized = items.map((lead) =>
        normalizeLead(lead as Record<string, unknown>),
      )
      const withOutbox = await applyOutboxToLeads(normalized)
      setLeads(withOutbox)
      leadsRef.current = withOutbox
      const loadedAt = Date.now()
      setLastLoadedAt(loadedAt)
      try {
        await saveLeadsToCache(withOutbox)
      } catch {
        setLastLoadedAt(loadedAt)
      }
      return { raw: response.raw, normalized: withOutbox }
    } catch {
      const cached = await getCachedLeads()
      if (cached.length > 0) {
        const lastSyncAt = await getLastSyncAt()
        const withOutbox = await applyOutboxToLeads(cached)
        setLeads(withOutbox)
        leadsRef.current = withOutbox
        setLastLoadedAt(lastSyncAt ?? Date.now())
        return { raw: null, normalized: withOutbox }
      }
      setLeads([])
      setLastLoadedAt(null)
      setError('Нет сохранённых данных. Подключитесь к интернету.')
      return { raw: null, normalized: [] }
    } finally {
      await refreshOutboxState()
      setIsLoading(false)
    }
  }, [applyOutboxToLeads, refreshOutboxState])

  useEffect(() => {
    const poll = async () => {
      if (!getToken()) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
        return
      }
      if (!navigator.onLine) return
      try {
        const response = await getLeads()
        const items = response.leads
        const normalized = items.map((lead) =>
          normalizeLead(lead as Record<string, unknown>),
        )
        const currentIds = new Set(normalized.map((l) => l.id))
        const prevIds = prevLeadIdsRef.current
        if (prevIds !== null) {
          const newLeads = normalized.filter((l) => !prevIds.has(l.id))
          for (const lead of newLeads) {
            const label = lead.name?.trim() || lead.phone?.trim() || `#${lead.id}`
            showToast(`Новый лид: ${label}`)
          }
          if (newLeads.length > 0) {
            loadLeads()
          }
        }
        prevLeadIdsRef.current = currentIds
      } catch {
        // ignore poll errors (e.g. offline)
      }
    }
    const id = setInterval(poll, POLL_LEADS_INTERVAL_MS)
    pollIntervalRef.current = id
    return () => {
      clearInterval(id)
      pollIntervalRef.current = null
    }
  }, [loadLeads, showToast])

  const getLeadById = useCallback(
    (id: string) => leads.find((lead) => lead.id === id),
    [leads],
  )

  const updateLeadInState = useCallback(
    async (id: string, update: Partial<NormalizedLead>) => {
      let found = false
      let updated = leadsRef.current.map((lead) => {
        if (lead.id !== id) {
          return lead
        }
        found = true
        return { ...lead, ...update }
      })
      if (!found) {
        const cachedLead = await getCachedLeadById(id)
        if (cachedLead) {
          updated = [...updated, { ...cachedLead, ...update }]
        }
      }
      leadsRef.current = updated
      setLeads(updated)
      await saveLeadsToCache(updated)
    },
    [],
  )

  const updateLeadStatusLocal = useCallback(
    async (id: string, status: NormalizedLead['status']) => {
      await updateLeadInState(id, { status: normalizeLeadStatus(status) })
    },
    [updateLeadInState],
  )

  const updateLeadStatus = useCallback(
    async (id: string, status: 'success' | 'failed') => {
      const queueUpdate = async () => {
        await updateLeadStatusLocal(id, status)
        await enqueueStatusUpdate(id, status)
        setPendingLeadIds((prev) => Array.from(new Set([...prev, id])))
        setOutboxCount(await getOutboxCount())
        showToast('Действие сохранено. Синхронизируем при появлении интернета.')
      }
      if (!navigator.onLine) {
        await queueUpdate()
        return
      }
      try {
        const response = await apiUpdateLeadStatus(id, status)
        const resolvedStatus = resolveStatusFromResponse(response, status)
        await updateLeadStatusLocal(id, resolvedStatus)
        setPendingLeadIds((prev) => prev.filter((leadId) => leadId !== id))
        showToast('Статус обновлён')
      } catch {
        await queueUpdate()
      }
    },
    [showToast, updateLeadStatusLocal],
  )

  const deleteLead = useCallback(
    async (id: string) => {
      const applyDelete = () => {
        const updated = leadsRef.current.filter((lead) => lead.id !== id)
        leadsRef.current = updated
        setLeads(updated)
        return updated
      }
      const queueDelete = async () => {
        const updated = applyDelete()
        await saveLeadsToCache(updated)
        await enqueueDelete(id)
        setPendingLeadIds((prev) => prev.filter((leadId) => leadId !== id))
        setOutboxCount(await getOutboxCount())
        showToast('Действие сохранено. Синхронизируем при появлении интернета.')
      }
      if (!navigator.onLine) {
        await queueDelete()
        return
      }
      try {
        await apiDeleteLead(id)
        const updated = applyDelete()
        await saveLeadsToCache(updated)
        showToast('Лид удалён')
      } catch {
        await queueDelete()
      }
    },
    [showToast],
  )

  const value = useMemo(
    () => ({
      leads,
      isLoading,
      error,
      toastMessage,
      lastLoadedAt,
      outboxCount,
      pendingLeadIds,
      loadLeads,
      getLeadById,
      updateLeadStatus,
      updateLeadInState,
      deleteLead,
      syncOutbox: runSync,
      getOutboxItems: getOutboxItemsCallback,
      clearOutbox: clearOutboxCallback,
      refreshOutboxState,
      clearToast,
      showToast,
    }),
    [
      leads,
      isLoading,
      error,
      toastMessage,
      lastLoadedAt,
      outboxCount,
      pendingLeadIds,
      loadLeads,
      getLeadById,
      updateLeadStatus,
      updateLeadInState,
      deleteLead,
      runSync,
      getOutboxItemsCallback,
      clearOutboxCallback,
      refreshOutboxState,
      clearToast,
      showToast,
    ],
  )

  return <LeadsContext.Provider value={value}>{children}</LeadsContext.Provider>
}
