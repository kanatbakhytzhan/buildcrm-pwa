import React from 'react'
import './Card.css'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    padding?: 'none' | 'sm' | 'md' | 'lg'
    hoverable?: boolean
}

export const Card: React.FC<CardProps> = ({
    padding = 'md',
    hoverable = false,
    className = '',
    children,
    ...props
}) => {
    const classes = [
        'ui-card',
        `ui-card--padding-${padding}`,
        hoverable && 'ui-card--hoverable',
        className,
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div className={classes} {...props}>
            {children}
        </div>
    )
}
