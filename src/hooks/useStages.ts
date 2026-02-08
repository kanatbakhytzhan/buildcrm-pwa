import { useMemo } from 'react'
import { DEFAULT_STAGES, type Stage } from '../types/stage'

/**
 * Hook to get stages for kanban board
 * 
 * TODO: Enhance to fetch from tenant settings / AmoCRM mapping
 * For MVP: uses default stages
 */
export function useStages(): {
    stages: Stage[]
    isLoading: boolean
    error: string | null
} {
    // For now, return default stages
    // Later: fetch from API based on tenant configuration
    const stages = useMemo(() => DEFAULT_STAGES, [])

    return {
        stages,
        isLoading: false,
        error: null,
    }
}

/**
 * Future enhancement: fetch stages from API
 * 
 * Example implementation:
 * 
 * const { data, isLoading, error } = useQuery('stages', async () => {
 *   const settings = await getTenantSettings()
 *   if (settings.amocrmPipelineMapping) {
 *     return parseAmocrmStages(settings.amocrmPipelineMapping)
 *   }
 *   return DEFAULT_STAGES
 * })
 */
