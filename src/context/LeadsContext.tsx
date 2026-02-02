import { createContext, useContext } from 'react'
import type { NormalizedLead } from '../utils/normalizeLead'
import type { OutboxEntry } from '../services/offlineDb'

export type SyncOutboxResult = { processed: number; failed: number; stoppedByAuth: boolean }

export type LeadsContextValue = {
  leads: NormalizedLead[]
  isLoading: boolean
  error: string | null
  toastMessage: string | null
  lastLoadedAt: number | null
  outboxCount: number
  pendingLeadIds: string[]
  loadLeads: () => Promise<{ raw: unknown; normalized: NormalizedLead[] }>
  getLeadById: (id: string) => NormalizedLead | undefined
  updateLeadStatus: (id: string, status: 'success' | 'failed') => Promise<void>
  updateLeadInState: (
    id: string,
    update: Partial<NormalizedLead>,
  ) => Promise<void>
  deleteLead: (id: string) => Promise<void>
  syncOutbox: () => Promise<SyncOutboxResult>
  getOutboxItems: () => Promise<OutboxEntry[]>
  clearOutbox: () => Promise<void>
  refreshOutboxState: () => Promise<void>
  clearToast: () => void
  showToast: (message: string) => void
}

export const LeadsContext = createContext<LeadsContextValue | undefined>(undefined)

export const useLeads = () => {
  const value = useContext(LeadsContext)
  if (!value) {
    throw new Error('LeadsContext not found')
  }
  return value
}
