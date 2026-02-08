import React, { useState, useEffect } from 'react'
import { Clock, AlertCircle } from 'lucide-react'
import './ReactionTimer.css'

interface ReactionTimerProps {
    lastClientMessageAt?: string | Date | null
    urgentThresholdMinutes?: number
    className?: string
}

export const ReactionTimer: React.FC<ReactionTimerProps> = ({
    lastClientMessageAt,
    urgentThresholdMinutes = 30,
    className = '',
}) => {
    const [minutesSince, setMinutesSince] = useState<number | null>(null)

    useEffect(() => {
        if (!lastClientMessageAt) {
            setMinutesSince(null)
            return
        }

        const calculate = () => {
            const now = new Date()
            const lastMessage = new Date(lastClientMessageAt)
            const diffMs = now.getTime() - lastMessage.getTime()
            const minutes = Math.floor(diffMs / 60000)
            setMinutesSince(minutes)
        }

        calculate()
        const interval = setInterval(calculate, 60000) // Update every minute

        return () => clearInterval(interval)
    }, [lastClientMessageAt])

    if (minutesSince === null || minutesSince < 0) {
        return null
    }

    const isUrgent = minutesSince >= urgentThresholdMinutes
    const classes = [
        'reaction-timer',
        isUrgent && 'reaction-timer--urgent',
        className,
    ].filter(Boolean).join(' ')

    const formatTime = (mins: number): string => {
        if (mins < 60) return `${mins} мин`
        const hours = Math.floor(mins / 60)
        const remainingMins = mins % 60
        return remainingMins > 0 ? `${hours}ч ${remainingMins}м` : `${hours}ч`
    }

    return (
        < div className={classes}>
            <span className="reaction-timer__icon">
                {isUrgent ? <AlertCircle size={14} /> : <Clock size={14} />}
            </span>
            <span className="reaction-timer__text">
                {isUrgent ? 'Нужно перехватить:' : 'Без ответа:'} {formatTime(minutesSince)}
            </span>
        </div>
    )
}
