import type { LeadCategory, LeadCategoryConfig } from '../types/leadCategory'

// Business-specific categories for aluminum panel sales
export const CATEGORY_CONFIG: Record<LeadCategory, LeadCategoryConfig> = {
    no_reply: {
        id: 'no_reply',
        label: 'НЕ ОТВЕТИЛИ',
        color: '#64748b', // slate-500
        bgColor: '#f8fafc', // slate-50
        borderColor: '#e2e8f0', // slate-200
        order: 1,
    },
    wants_call: {
        id: 'wants_call',
        label: 'ПРОСИТ ЗВОНОК',
        color: '#dc2626', // red-600
        bgColor: '#fef2f2', // red-50
        borderColor: '#fee2e2', // red-100
        order: 2,
    },
    partial_data: {
        id: 'partial_data',
        label: 'НЕПОЛНЫЕ ДАННЫЕ',
        color: '#f59e0b', // amber-500
        bgColor: '#fffbeb', // amber-50
        borderColor: '#fef3c7', // amber-100
        order: 3,
    },
    full_data: {
        id: 'full_data',
        label: 'ПОЛНЫЕ ДАННЫЕ',
        color: '#3b82f6', // blue-500
        bgColor: '#eff6ff', // blue-50
        borderColor: '#dbeafe', // blue-100
        order: 4,
    },
    measurement_assigned: {
        id: 'measurement_assigned',
        label: 'ЗАМЕР НАЗНАЧЕН',
        color: '#8b5cf6', // violet-500
        bgColor: '#f5f3ff', // violet-50
        borderColor: '#ede9fe', // violet-100
        order: 5,
    },
    measurement_done: {
        id: 'measurement_done',
        label: 'ЗАМЕР ПРОВЕДЕН',
        color: '#7c3aed', // violet-600
        bgColor: '#f5f3ff', // violet-50
        borderColor: '#ede9fe', // violet-100
        order: 6,
    },
    rejected: {
        id: 'rejected',
        label: 'ОТКАЗ/НЕЦЕЛЕВОЙ',
        color: '#6b7280', // gray-500
        bgColor: '#f9fafb', // gray-50
        borderColor: '#f3f4f6', // gray-100
        order: 7,
    },
    non_target: {
        id: 'non_target',
        label: 'Нецелевой',
        color: '#888888',
        bgColor: '#f5f5f5',
        borderColor: '#dddddd',
        order: 70,
    },
    postponed: {
        id: 'postponed',
        label: 'Отложен',
        color: '#6b7280',
        bgColor: '#f3f4f6',
        borderColor: '#d1d5db',
        order: 80,
    },
    won: {
        id: 'won',
        label: 'УСПЕШНО',
        color: '#10b981', // green-500
        bgColor: '#f0fdf4', // green-50
        borderColor: '#dcfce7', // green-100
        order: 8,
    },
}

export const getCategoryConfig = (category: LeadCategory | string): LeadCategoryConfig => {
    return CATEGORY_CONFIG[category as LeadCategory] || CATEGORY_CONFIG.no_reply
}

export const getCategoryColor = (category: LeadCategory | string): string => {
    return getCategoryConfig(category).color
}
