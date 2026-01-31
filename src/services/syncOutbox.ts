import { deleteLead, updateLeadStatus } from './api'
import { bumpAttempt, clearOutboxItem, offlineDb } from './offlineDb'

export type SyncResult = {
  processed: number
  failed: number
  stoppedByAuth: boolean
}

export const syncOutbox = async (): Promise<SyncResult> => {
  if (!navigator.onLine) {
    return { processed: 0, failed: 0, stoppedByAuth: false }
  }
  const items = await offlineDb.outbox.orderBy('createdAt').toArray()
  let processed = 0
  let failed = 0
  let stoppedByAuth = false

  for (const item of items) {
    if (!item.id) {
      continue
    }
    try {
      if (item.type === 'PATCH_STATUS') {
        const status = String(item.payload?.status || '')
        if (status === 'success' || status === 'failed') {
          await updateLeadStatus(item.leadId, status)
        } else {
          throw new Error('Некорректный статус')
        }
      }
      if (item.type === 'DELETE_LEAD') {
        await deleteLead(item.leadId)
      }
      await clearOutboxItem(item.id)
      processed += 1
    } catch (error) {
      await bumpAttempt(item.id, error)
      failed += 1
      const status = (error as { status?: number })?.status
      if (status === 401) {
        stoppedByAuth = true
        break
      }
    }
  }

  return { processed, failed, stoppedByAuth }
}
