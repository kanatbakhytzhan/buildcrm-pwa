import { LeadCategory, LeadCategoryConfig } from '../types/leadCategory'

export const CATEGORY_CONFIG: Record<LeadCategory, LeadCategoryConfig> = {
    new: {
        id: 'new',
        label: 'Новый',
        color: '#0ea5e9', // sky-500
        bgColor: '#f0f9ff', // sky-50
        borderColor: '#e0f2fe', // sky-100
    },
    hot: {
        id: 'hot',
        label: 'Горячий',
        color: '#dc2626', // red-600
        bgColor: '#fef2f2', // red-50
        borderColor: '#fee2e2', // red-100
    },
    warm: {
        id: 'warm',
        label: 'Тёплый',
        color: '#f59e0b', // amber-500
        bgColor: '#fffbeb', // amber-50
        borderColor: '#fef3c7', // amber-100
    },
    cold: {
        id: 'cold',
        label: 'Холодный',
        color: '#3b82f6', // blue-500
        bgColor: '#eff6ff', // blue-50
        borderColor: '#dbeafe', // blue-100
    },
    postponed: {
        id: 'postponed',
        label: 'Отложен',
        color: '#8b5cf6', // violet-500
        bgColor: '#f5f3ff', // violet-50
        borderColor: '#ede9fe', // violet-100
    },
    non_target: {
        id: 'non_target',
        label: 'Не целевой',
        color: '#64748b', // slate-500
        bgColor: '#f8fafc', // slate-50
        borderColor: '#e2e8f0', // slate-200
    },
}

export const getCategoryConfig = (category: LeadCategory | string): LeadCategoryConfig => {
    return CATEGORY_CONFIG[category as LeadCategory] || CATEGORY_CONFIG.new
}

export const getCategoryColor = (category: LeadCategory | string): string => {
    return getCategoryConfig(category).color
}
