import Dexie, { type Table } from 'dexie'
import type { NormalizedLead } from '../utils/normalizeLead'

type CachedLead = {
  id: string
  data: NormalizedLead
  updatedAt: number
}

type MetaEntry = {
  key: 'lastSyncAt'
  value: number
}

export type OutboxType = 'PATCH_STATUS' | 'DELETE_LEAD'

export type OutboxEntry = {
  id?: number
  type: OutboxType
  leadId: string
  payload: Record<string, unknown> | null
  createdAt: number
  attempts: number
  lastError: string | null
}

class OfflineDatabase extends Dexie {
  leads!: Table<CachedLead, string>
  meta!: Table<MetaEntry, string>
  outbox!: Table<OutboxEntry, number>

  constructor() {
    super('buildcrm_offline')
    this.version(1).stores({
      leads: 'id, updatedAt',
      meta: 'key',
    })
    this.version(2).stores({
      leads: 'id, updatedAt',
      meta: 'key',
      outbox: '++id, createdAt, leadId, type',
    })
  }
}

export const offlineDb = new OfflineDatabase()

export const saveLeadsToCache = async (leads: NormalizedLead[]) => {
  const now = Date.now()
  const records = leads.map((lead) => ({
    id: lead.id,
    data: lead,
    updatedAt: now,
  }))
  await offlineDb.transaction('rw', offlineDb.leads, offlineDb.meta, async () => {
    await offlineDb.leads.bulkPut(records)
    await offlineDb.meta.put({ key: 'lastSyncAt', value: now })
  })
}

export const getCachedLeads = async () => {
  const records = await offlineDb.leads.toArray()
  return records.map((record) => record.data)
}

export const getCachedLeadById = async (id: string) => {
  const record = await offlineDb.leads.get(id)
  return record?.data
}

export const getLastSyncAt = async () => {
  const record = await offlineDb.meta.get('lastSyncAt')
  return record?.value ?? null
}

export const enqueueStatusUpdate = async (
  leadId: string,
  status: 'success' | 'failed',
) => {
  return offlineDb.outbox.add({
    type: 'PATCH_STATUS',
    leadId,
    payload: { status },
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
  })
}

export const enqueueDelete = async (leadId: string) => {
  return offlineDb.outbox.add({
    type: 'DELETE_LEAD',
    leadId,
    payload: null,
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
  })
}

export const getOutboxCount = async () => {
  return offlineDb.outbox.count()
}

export const clearOutboxItem = async (id: number) => {
  await offlineDb.outbox.delete(id)
}

export const bumpAttempt = async (id: number, error: unknown) => {
  const lastError =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Ошибка синхронизации'
  const record = await offlineDb.outbox.get(id)
  const attempts = (record?.attempts ?? 0) + 1
  await offlineDb.outbox.update(id, { attempts, lastError })
}
