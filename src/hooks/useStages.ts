import { useState, useEffect, useCallback } from 'react'
import { DEFAULT_STAGES, tenantStageToStage, type Stage } from '../types/stage'
import { getTenantStages } from '../services/api'

/**
 * Hook to get stages for kanban board
 * 
 * Fetches from: GET /api/tenants/me/stages
 * Fallback: DEFAULT_STAGES if API returns empty or fails
 */
export function useStages(): {
    stages: Stage[]
    isLoading: boolean
    error: string | null
    refetch: () => Promise<void>
} {
    const [stages, setStages] = useState<Stage[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const loadStages = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            const { stages: tenantStages } = await getTenantStages()

            if (tenantStages.length === 0) {
                // No stages configured - use defaults
                const defaultStagesMapped = DEFAULT_STAGES
                    .filter(s => s.is_active)
                    .sort((a, b) => a.order_index - b.order_index)
                    .map(s => tenantStageToStage(s))
                setStages(defaultStagesMapped)
            } else {
                // Use tenant stages
                const mapped = tenantStages
                    .filter(s => s.is_active)
                    .sort((a, b) => a.order_index - b.order_index)
                    .map(s => tenantStageToStage(s))
                setStages(mapped)
            }
        } catch (err) {
            console.error('[useStages] Failed to load:', err)
            setError('Failed to load stages')

            // Fallback to default stages
            const fallback = DEFAULT_STAGES
                .filter(s => s.is_active)
                .sort((a, b) => a.order_index - b.order_index)
                .map(s => tenantStageToStage(s))
            setStages(fallback)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        loadStages()
    }, [loadStages])

    return {
        stages,
        isLoading,
        error,
        refetch: loadStages,
    }
}
