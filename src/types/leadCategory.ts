// Business-specific categories for aluminum panel sales
export type LeadCategory =
    | 'no_reply'              // НЕ ОТВЕТИЛИ
    | 'wants_call'            // ПРОСИТ ЗВОНОК
    | 'partial_data'          // НЕПОЛНЫЕ ДАННЫЕ
    | 'full_data'             // ПОЛНЫЕ ДАННЫЕ
    | 'measurement_assigned'  // ЗАМЕР НАЗНАЧЕН
    | 'measurement_done'      // ЗАМЕР ПРОВЕДЕН
    | 'rejected'              // ОТКАЗ/НЕЦЕЛЕВОЙ
    | 'non_target'            // НЕЦЕЛЕВОЙ
    | 'postponed'             // ОТЛОЖЕН
    | 'won'                   // УСПЕШНО

export interface LeadCategoryConfig {
    id: LeadCategory
    label: string
    color: string
    bgColor: string
    borderColor: string
    icon?: string
    order: number  // For sorting
}

export const LEAD_CATEGORIES: LeadCategory[] = [
    'no_reply',
    'wants_call',
    'partial_data',
    'full_data',
    'measurement_assigned',
    'measurement_done',
    'rejected',
    'non_target',
    'postponed',
    'won',
]
