import React from 'react'
import './Skeleton.css'

export type SkeletonVariant = 'text' | 'title' | 'circle' | 'rect' | 'card'

export interface SkeletonProps {
    variant?: SkeletonVariant
    width?: string | number
    height?: string | number
    className?: string
}

export const Skeleton: React.FC<SkeletonProps> = ({
    variant = 'text',
    width,
    height,
    className = '',
}) => {
    const classes = ['ui-skeleton', `ui-skeleton--${variant}`, className].filter(Boolean).join(' ')

    const style: React.CSSProperties = {}
    if (width) style.width = typeof width === 'number' ? `${width}px` : width
    if (height) style.height = typeof height === 'number' ? `${height}px` : height

    return <div className={classes} style={style} aria-label="Loading..." />
}
