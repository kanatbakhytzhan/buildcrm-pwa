import React, { useState } from 'react'
import './LeadScore.css'
import type { LeadScore as LeadScoreType } from '../types/leadScore'
import { getScoreEmoji, getScoreLabel } from '../types/leadScore'

interface LeadScoreProps {
    score: LeadScoreType
    showLabel?: boolean
    showDetails?: boolean
    className?: string
}

export const LeadScore: React.FC<LeadScoreProps> = ({
    score,
    showLabel = true,
    showDetails = false,
    className = '',
}) => {
    const [detailsOpen, setDetailsOpen] = useState(false)
    const emoji = getScoreEmoji(score.level)
    const label = getScoreLabel(score.level)

    const scoreClasses = [
        'lead-score',
        `lead-score--${score.level}`,
        className,
    ].filter(Boolean).join(' ')

    const handleClick = () => {
        if (showDetails && score.reasons && score.reasons.length > 0) {
            setDetailsOpen(!detailsOpen)
        }
    }

    return (
        <div style={{ position: 'relative' }}>
            <div
                className={scoreClasses}
                onClick={handleClick}
                style={{ cursor: showDetails && score.reasons ? 'pointer' : 'default' }}
                title={showDetails ? 'Показать детали' : undefined}
            >
                <span className="lead-score__emoji">{emoji}</span>
                {showLabel && (
                    <>
                        <span className="lead-score__label">{label}</span>
                        <span className="lead-score__value">{score.score}</span>
                    </>
                )}
            </div>

            {detailsOpen && score.reasons && score.reasons.length > 0 && (
                <div className="score-details" onClick={(e) => e.stopPropagation()}>
                    <div className="score-details__header">
                        <span>{emoji}</span>
                        <h4 className="score-details__title">Почему {label.toLowerCase()}?</h4>
                    </div>
                    <ul className="score-details__reasons">
                        {score.reasons.map((reason, idx) => (
                            <li key={idx} className="score-details__reason">
                                {reason}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}
