import React from 'react'
import { Bot, User } from 'lucide-react'
import './AiModeToggle.css'

interface AiModeToggleProps {
    isAiMode: boolean
    onChange: (isAiMode: boolean) => void
    disabled?: boolean
    className?: string
}

export const AiModeToggle: React.FC<AiModeToggleProps> = ({
    isAiMode,
    onChange,
    disabled = false,
    className = '',
}) => {
    const handleToggle = () => {
        if (!disabled) {
            onChange(!isAiMode)
        }
    }

    const statusClasses = [
        'ai-mode-toggle__status',
        isAiMode ? 'ai-mode-toggle__status--ai' : 'ai-mode-toggle__status--manual',
    ].join(' ')

    return (
        <div className={`ai-mode-toggle ${className}`}>
            <span className="ai-mode-toggle__label">Режим:</span>

            <label className="ai-mode-toggle__switch">
                <input
                    type="checkbox"
                    className="ai-mode-toggle__input"
                    checked={isAiMode}
                    onChange={handleToggle}
                    disabled={disabled}
                />
                <span className="ai-mode-toggle__slider" />
            </label>

            <div className={statusClasses}>
                <span className="ai-mode-toggle__icon">
                    {isAiMode ? <Bot size={16} /> : <User size={16} />}
                </span>
                <span>{isAiMode ? 'AI отвечает' : 'Менеджер отвечает'}</span>
            </div>
        </div>
    )
}
