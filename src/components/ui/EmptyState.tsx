import React from 'react'
import './EmptyState.css'

export interface EmptyStateProps {
    icon?: React.ReactNode
    title: string
    description?: string
    action?: React.ReactNode
    className?: string
}

const defaultIcon = (
    <svg viewBox="0 0 80 80" fill="none">
        <rect x="10" y="20" width="60" height="50" rx="4" stroke="currentColor" strokeWidth="2" />
        <line x1="25" y1="35" x2="55" y2="35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="25" y1="45" x2="45" y2="45" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="25" y1="55" x2="50" y2="55" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
)

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon = defaultIcon,
    title,
    description,
    action,
    className = '',
}) => {
    return (
        <div className={`ui-empty-state ${className}`}>
            <div className="ui-empty-state__icon">{icon}</div>
            <h3 className="ui-empty-state__title">{title}</h3>
            {description && <p className="ui-empty-state__description">{description}</p>}
            {action && <div className="ui-empty-state__action">{action}</div>}
        </div>
    )
}
