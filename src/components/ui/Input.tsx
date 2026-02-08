import React from 'react'
import './Input.css'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
    fullWidth?: boolean
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    fullWidth = false,
    className = '',
    id,
    ...props
}) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`
    const classes = [
        'ui-input',
        error && 'ui-input--error',
        fullWidth && 'ui-input--full',
        className,
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div className={`ui-input-wrapper ${fullWidth ? 'ui-input-wrapper--full' : ''}`}>
            {label && (
                <label htmlFor={inputId} className="ui-input-label">
                    {label}
                </label>
            )}
            <input id={inputId} className={classes} {...props} />
            {error && <span className="ui-input-error">{error}</span>}
        </div>
    )
}
