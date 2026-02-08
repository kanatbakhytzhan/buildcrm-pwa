import React from 'react'
import './Badge.css'

export type BadgeVariant = 'default' | 'primary' | 'success' | 'danger' | 'warning'
export type BadgeSize = 'sm' | 'md' | 'lg'

export interface BadgeProps {
    children: React.ReactNode
    variant?: BadgeVariant
    size?: BadgeSize
    dot?: boolean
    className?: string
}

export const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'default',
    size = 'md',
    dot = false,
    className = '',
}) => {
    const classes = [
        'ui-badge',
        `ui-badge--${variant}`,
        `ui-badge--${size}`,
        className,
    ].filter(Boolean).join(' ')

    return (
        <span className={classes}>
            {dot && <span className="ui-badge__dot" />}
            {children}
        </span>
    )
}
