/* Lead Score Component - shows 🔥/🟡/❄️ indicator */
export type LeadScoreLevel = 'hot' | 'warm' | 'cold'

export interface LeadScore {
    score: number  // 0-100
    level: LeadScoreLevel
    reasons?: string[]  // Why this score
}

export function getScoreLevel(score: number): LeadScoreLevel {
    if (score >= 70) return 'hot'
    if (score >= 40) return 'warm'
    return 'cold'
}

export function getScoreEmoji(level: LeadScoreLevel): string {
    switch (level) {
        case 'hot': return '🔥'
        case 'warm': return '🟡'
        case 'cold': return '❄️'
        default: return '❓'
    }
}

export function getScoreLabel(level: LeadScoreLevel): string {
    switch (level) {
        case 'hot': return 'Горячий'
        case 'warm': return 'Теплый'
        case 'cold': return 'Холодный'
        default: return 'Неизвестно'
    }
}
