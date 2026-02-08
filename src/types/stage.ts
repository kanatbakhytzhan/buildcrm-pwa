// Stage types for Kanban board
export type StageKey =
    | 'unsorted'
    | 'in_progress'
    | 'call_1'
    | 'call_2'
    | 'call_3'
    | 'repair_not_ready'
    | 'other_city'
    | 'ignore'
    | 'measurement_assigned'
    | 'measurement_done'
    | 'after_measurement_reject'
    | 'won'
    | 'cancelled'
    | 'lost'

export interface Stage {
    key: StageKey
    title: string
    order: number
    color?: string
    amocrmStageId?: string | null
}

// Default stages (fallback when no AmoCRM mapping)
export const DEFAULT_STAGES: Stage[] = [
    { key: 'unsorted', title: 'Неразобранное', order: 0, color: '#94a3b8' },
    { key: 'in_progress', title: 'В работе', order: 1, color: '#3b82f6' },
    { key: 'call_1', title: '1-й звонок', order: 2, color: '#8b5cf6' },
    { key: 'call_2', title: '2-й звонок', order: 3, color: '#a855f7' },
    { key: 'call_3', title: '3-й звонок', order: 4, color: '#c084fc' },
    { key: 'repair_not_ready', title: 'Ремонт не готов', order: 5, color: '#fb923c' },
    { key: 'other_city', title: 'Другой город', order: 6, color: '#fbbf24' },
    { key: 'ignore', title: 'Игнор', order: 7, color: '#6b7280' },
    { key: 'measurement_assigned', title: 'Назначен замер', order: 8, color: '#06b6d4' },
    { key: 'measurement_done', title: 'Провел замер', order: 9, color: '#14b8a6' },
    { key: 'after_measurement_reject', title: 'Отказ после замера', order: 10, color: '#ef4444' },
    { key: 'won', title: 'Успешно', order: 11, color: '#10b981' },
    { key: 'cancelled', title: 'Отказ', order: 12, color: '#64748b' },
    { key: 'lost', title: 'Закрыто и не реализовано', order: 13, color: '#64748b' },
]

// Map old category values to stage keys
export function categoryToStageKey(category: string | undefined | null): StageKey {
    if (!category) return 'unsorted'

    const normalized = category.toLowerCase().trim()

    // Direct matches
    const validKeys: StageKey[] = [
        'unsorted', 'in_progress', 'call_1', 'call_2', 'call_3',
        'repair_not_ready', 'other_city', 'ignore',
        'measurement_assigned', 'measurement_done', 'after_measurement_reject',
        'won', 'cancelled', 'lost'
    ]

    if (validKeys.includes(normalized as StageKey)) {
        return normalized as StageKey
    }

    // Legacy mappings (from old category system)
    const legacyMap: Record<string, StageKey> = {
        'no_reply': 'unsorted',
        'wants_call': 'call_1',
        'partial_data': 'in_progress',
        'full_data': 'measurement_assigned',
        'rejected': 'cancelled',
        'new': 'unsorted',
        'hot': 'in_progress',
        'warm': 'in_progress',
        'cold': 'unsorted',
        'non_target': 'ignore',
        'postponed': 'in_progress',
    }

    if (legacyMap[normalized]) {
        return legacyMap[normalized]
    }

    // Unknown -> unsorted
    return 'unsorted'
}

export function getStageByKey(key: StageKey, stages: Stage[] = DEFAULT_STAGES): Stage | undefined {
    return stages.find(s => s.key === key)
}
