import React from 'react'
import './Button.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant
    size?: ButtonSize
    fullWidth?: boolean
    loading?: boolean
    icon?: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    loading = false,
    icon,
    children,
    className = '',
    disabled,
    ...props
}) => {
    const classes = [
        'ui-button',
        `ui-button--${variant}`,
        `ui-button--${size}`,
        fullWidth && 'ui-button--full',
        loading && 'ui-button--loading',
        className,
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <button className={classes} disabled={disabled || loading} {...props}>
            {loading && (
                <span className="ui-button__spinner">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle
                            cx="8"
                            cy="8"
                            r="6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeDasharray="30 10"
                        >
                            <animateTransform
                                attributeName="transform"
                                type="rotate"
                                from="0 8 8"
                                to="360 8 8"
                                dur="0.8s"
                                repeatCount="indefinite"
                            />
                        </circle>
                    </svg>
                </span>
            )}
            {icon && <span className="ui-button__icon">{icon}</span>}
            {children && <span className="ui-button__text">{children}</span>}
        </button>
    )
}
