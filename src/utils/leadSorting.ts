import type { NormalizedLead } from '../utils/normalizeLead'

/**
 * Priority sorting for leads within a kanban column
 * 
 * Priority order:
 * 1. No reply (longest wait) - HIGHEST priority
 * 2. Hot leads (high score)
 * 3. Warm leads (medium score)
 * 4. Newer leads before older
 */
export function sortLeadsByPriority(leads: NormalizedLead[]): NormalizedLead[] {
    return [...leads].sort((a, b) => {
        // 1. Reaction time (no reply) - longer wait = higher priority
        const aNoReplyMinutes = a.lastClientMessageAt
            ? (Date.now() - new Date(a.lastClientMessageAt).getTime()) / 60000
            : 0
        const bNoReplyMinutes = b.lastClientMessageAt
            ? (Date.now() - new Date(b.lastClientMessageAt).getTime()) / 60000
            : 0

        // If one has no reply > 30 min and other doesn't, prioritize the waiting one
        const aUrgent = aNoReplyMinutes > 30
        const bUrgent = bNoReplyMinutes > 30

        if (aUrgent && !bUrgent) return -1
        if (bUrgent && !aUrgent) return 1

        // If both urgent or both not urgent, compare wait time
        if (aUrgent && bUrgent) {
            return bNoReplyMinutes - aNoReplyMinutes // Longer wait first
        }

        // 2. Score priority (hot > warm > cold)
        const aScore = a.score ?? 0
        const bScore = b.score ?? 0

        const aLevel = aScore >= 70 ? 3 : aScore >= 40 ? 2 : 1
        const bLevel = bScore >= 70 ? 3 : bScore >= 40 ? 2 : 1

        if (aLevel !== bLevel) {
            return bLevel - aLevel // Higher score first
        }

        // 3. Recency - newer first
        const aTime = new Date(a.createdAt).getTime()
        const bTime = new Date(b.createdAt).getTime()

        return bTime - aTime
    })
}

/**
 * Group leads by stage key
 */
export function groupLeadsByStage(
    leads: NormalizedLead[],
    categoryToStageKey: (category: string) => string
): Record<string, NormalizedLead[]> {
    const grouped: Record<string, NormalizedLead[]> = {}

    leads.forEach(lead => {
        const stageKey = categoryToStageKey(lead.category)
        if (!grouped[stageKey]) {
            grouped[stageKey] = []
        }
        grouped[stageKey].push(lead)
    })

    // Sort each group
    Object.keys(grouped).forEach(stageKey => {
        grouped[stageKey] = sortLeadsByPriority(grouped[stageKey])
    })

    return grouped
}
