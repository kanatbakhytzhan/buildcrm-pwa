import { createContext, useContext } from 'react'
import type { NormalizedLead } from '../utils/normalizeLead'

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
  syncOutbox: () => Promise<void>
  clearToast: () => void
}

export const LeadsContext = createContext<LeadsContextValue | undefined>(undefined)

export const useLeads = () => {
  const value = useContext(LeadsContext)
  if (!value) {
    throw new Error('LeadsContext not found')
  }
  return value
}
