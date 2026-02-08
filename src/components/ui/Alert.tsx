import React from 'react'
import './Alert.css'

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger'

export interface AlertProps {
    variant?: AlertVariant
    title?: string
    children: React.ReactNode
    onClose?: () => void
    className?: string
}

const icons = {
    info: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2" />
            <path d="M10 6V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="10" cy="14" r="1" fill="currentColor" />
        </svg>
    ),
    success: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
                d="M6 10L9 13L14 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2" />
        </svg>
    ),
    warning: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
                d="M10 2L2 17H18L10 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
            />
            <path d="M10 8V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="10" cy="15" r="1" fill="currentColor" />
        </svg>
    ),
    danger: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2" />
            <path d="M10 6V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="10" cy="14" r="1" fill="currentColor" />
        </svg>
    ),
}

export const Alert: React.FC<AlertProps> = ({
    variant = 'info',
    title,
    children,
    onClose,
    className = '',
}) => {
    const classes = ['ui-alert', `ui-alert--${variant}`, className].filter(Boolean).join(' ')

    return (
        <div className={classes} role="alert">
            <div className="ui-alert__icon">{icons[variant]}</div>
            <div className="ui-alert__content">
                {title && <div className="ui-alert__title">{title}</div>}
                <div className="ui-alert__message">{children}</div>
            </div>
            {onClose && (
                <button className="ui-alert__close" onClick={onClose} aria-label="Close">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path
                            d="M4 4L12 12M12 4L4 12"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                    </svg>
                </button>
            )}
        </div>
    )
}
