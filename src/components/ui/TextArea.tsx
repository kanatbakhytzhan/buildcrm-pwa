import React from 'react'
import './TextArea.css'

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    size?: 'sm' | 'md' | 'lg'
    error?: string
    hint?: string
    showCount?: boolean
    maxLength?: number
}

export const TextArea: React.FC<TextAreaProps> = ({
    size = 'md',
    error,
    hint,
    showCount = false,
    maxLength,
    value,
    className = '',
    ...props
}) => {
    const currentLength = typeof value === 'string' ? value.length : 0
    const nearLimit = maxLength && currentLength > maxLength * 0.9

    const classes = ['ui-textarea', `ui-textarea--${size}`, className].filter(Boolean).join(' ')

    return (
        <div className={classes}>
            <textarea
                className="ui-textarea__field"
                value={value}
                maxLength={maxLength}
                {...props}
            />

            {(showCount || hint) && (
                <div className="ui-textarea__footer">
                    {hint && !error && <span className="ui-textarea__hint">{hint}</span>}
                    {showCount && maxLength && (
                        <span className={`ui-textarea__counter ${nearLimit ? 'ui-textarea__counter--limit' : ''}`}>
                            {currentLength} / {maxLength}
                        </span>
                    )}
                </div>
            )}

            {error && <div className="ui-textarea__error">{error}</div>}
        </div>
    )
}
