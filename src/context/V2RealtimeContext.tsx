import { createContext, useCallback, useContext, useEffect, useRef } from 'react'
import { subscribeEvents } from '../services/api'

type V2RealtimeContextValue = {
  registerRefetch: (fn: () => void) => () => void
}

const V2RealtimeContext = createContext<V2RealtimeContextValue | undefined>(undefined)

export function useV2RealtimeRefetch(refetch: () => void) {
  const ctx = useContext(V2RealtimeContext)
  useEffect(() => {
    if (!ctx) return
    return ctx.registerRefetch(refetch)
  }, [ctx, refetch])
}

export function V2RealtimeProvider({
  children,
  onNewLeadToast,
}: {
  children: React.ReactNode
  onNewLeadToast: (message: string) => void
}) {
  const refetchRef = useRef<Set<() => void>>(new Set())
  const registerRefetch = useCallback((fn: () => void) => {
    refetchRef.current.add(fn)
    return () => {
      refetchRef.current.delete(fn)
    }
  }, [])

  useEffect(() => {
    const unsub = subscribeEvents({
      onLeadCreated: (payload) => {
        const parts = [payload.name, payload.city].filter(Boolean)
        const msg = parts.length ? `Новый лид: ${parts.join(' / ')}` : 'Новый лид'
        onNewLeadToast(msg)
        refetchRef.current.forEach((fn) => {
          try {
            fn()
          } catch {
            // ignore
          }
        })
      },
      onError: () => {
        // Polling already started inside subscribeEvents
      },
    })
    return unsub
  }, [onNewLeadToast])

  const value: V2RealtimeContextValue = { registerRefetch }
  return (
    <V2RealtimeContext.Provider value={value}>
      {children}
    </V2RealtimeContext.Provider>
  )
}
