import React from 'react'
import { getCategoryConfig } from '../utils/categoryColorMap'
import { LeadCategory } from '../types/leadCategory'
import './LeadCategoryBadge.css'

interface LeadCategoryBadgeProps {
    category: LeadCategory | string
    className?: string
    onClick?: () => void
}

const LeadCategoryBadge: React.FC<LeadCategoryBadgeProps> = ({
    category,
    className = '',
    onClick
}) => {
    const config = getCategoryConfig(category)

    return (
        <span
            className={`lead-category-badge ${className} ${onClick ? 'lead-category-badge--clickable' : ''}`}
            style={{
                backgroundColor: config.bgColor,
                color: config.color,
                borderColor: config.borderColor,
            }}
            onClick={onClick}
        >
            <span className="lead-category-badge__dot" style={{ backgroundColor: config.color }} />
            {config.label}
        </span>
    )
}

export default LeadCategoryBadge
