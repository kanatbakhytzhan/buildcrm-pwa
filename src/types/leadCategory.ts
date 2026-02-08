export type LeadCategory = 'hot' | 'warm' | 'cold' | 'non_target' | 'postponed' | 'new'

export interface LeadCategoryConfig {
    id: LeadCategory
    label: string
    color: string
    bgColor: string
    borderColor: string
    icon?: string // Lucide icon name or similar identifier
}

export const LEAD_CATEGORIES: LeadCategory[] = [
    'new',
    'hot',
    'warm',
    'cold',
    'postponed',
    'non_target',
]
