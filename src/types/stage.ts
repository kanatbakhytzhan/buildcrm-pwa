// Backend-compatible Stage types
export type StageKey = string // Now dynamic, not enum

export interface TenantStage {
    id: number
    stage_key: string         // e.g., 'new', 'in_progress', 'won'
    title_ru: string          // e.g., 'Новый'
    title_kz?: string | null  // e.g., 'Жаңа'
    color: string             // hex color
    order_index: number       // sort order
    is_active: boolean        // soft delete
    created_at: string
    updated_at: string
}

export interface Stage {
    key: string               // stage_key
    title: string            // title_ru (or title_kz if locale is KZ)
    titleRu: string
    titleKz?: string | null
    order: number            // from order_index
    color?: string
    id?: number             // backend ID
}

// Fallback stages (if backend not configured)
export const DEFAULT_STAGES: TenantStage[] = [
    { id: 1, stage_key: 'unsorted', title_ru: 'Неразобранное', title_kz: 'Бөлінбеген', color: '#94a3b8', order_index: 0, is_active: true, created_at: '', updated_at: '' },
    { id: 2, stage_key: 'in_progress', title_ru: 'В работе', title_kz: 'Жұмыста', color: '#3b82f6', order_index: 1, is_active: true, created_at: '', updated_at: '' },
    { id: 3, stage_key: 'call_1', title_ru: '1-й звонок', title_kz: '1-ші қоңырау', color: '#8b5cf6', order_index: 2, is_active: true, created_at: '', updated_at: '' },
    { id: 4, stage_key: 'measurement_assigned', title_ru: 'Назначен замер', title_kz: 'Өлшеу тағайындалған', color: '#06b6d4', order_index: 3, is_active: true, created_at: '', updated_at: '' },
    { id: 5, stage_key: 'won', title_ru: 'Успешно', title_kz: 'Сәтті', color: '#10b981', order_index: 4, is_active: true, created_at: '', updated_at: '' },
    { id: 6, stage_key: 'cancelled', title_ru: 'Отказ', title_kz: 'Бас тарту', color: '#64748b', order_index: 5, is_active: true, created_at: '', updated_at: '' },
]

// Convert backend stage to UI stage
export function tenantStageToStage(ts: TenantStage, locale: 'ru' | 'kz' = 'ru'): Stage {
    return {
        key: ts.stage_key,
        title: locale === 'kz' && ts.title_kz ? ts.title_kz : ts.title_ru,
        titleRu: ts.title_ru,
        titleKz: ts.title_kz || undefined,
        order: ts.order_index,
        color: ts.color,
        id: ts.id,
    }
}

// Map old category values to stage keys (migration helper)
export function categoryToStageKey(category: string | undefined | null): string {
    if (!category) return 'unsorted'

    const normalized = category.toLowerCase().trim()

    // Legacy mappings (from old category system)
    const legacyMap: Record<string, string> = {
        'no_reply': 'unsorted',
        'wants_call': 'call_1',
        'partial_data': 'in_progress',
        'full_data': 'measurement_assigned',
        'rejected': 'cancelled',
        'new': 'unsorted',
        'hot': 'in_progress',
        'warm': 'in_progress',
        'cold': 'unsorted',
        'non_target': 'cancelled',
        'postponed': 'in_progress',
        'won': 'won',
        'successful': 'won',
    }

    // Check if it's already a valid stage_key (just return it)
    if (legacyMap[normalized]) {
        return legacyMap[normalized]
    }

    // Unknown -> unsorted
    return normalized || 'unsorted'
}

export function getStageByKey(key: string, stages: Stage[]): Stage | undefined {
    return stages.find(s => s.key === key)
}
