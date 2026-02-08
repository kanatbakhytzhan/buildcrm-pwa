import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Phone, User } from 'lucide-react'
import type { NormalizedLead } from '../../utils/normalizeLead'
import { getScoreLevel, getScoreEmoji } from '../../types/leadScore'
import './LeadCard.css'

interface LeadCardProps {
    lead: NormalizedLead
    onClick: () => void
    isSelected?: boolean
}

export function LeadCard({ lead, onClick, isSelected }: LeadCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: lead.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }

    // Calculate reaction time
    const reactionMinutes = lead.lastClientMessageAt
        ? Math.floor((Date.now() - new Date(lead.lastClientMessageAt).getTime()) / 60000)
        : null

    // Score emoji
    const scoreLevel = lead.score !== undefined ? getScoreLevel(lead.score) : null
    const scoreEmoji = scoreLevel ? getScoreEmoji(scoreLevel) : null

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`lead-card ${isSelected ? 'lead-card--selected' : ''} ${isDragging ? 'lead-card--dragging' : ''}`}
            onClick={onClick}
        >
            {/* Header row */}
            <div className="lead-card__header">
                <div className="lead-card__name">
                    <User size={14} />
                    <span>{lead.name || 'Без имени'}</span>
                </div>
                {scoreEmoji && (
                    <span className="lead-card__score" title={`Score: ${lead.score}`}>
                        {scoreEmoji}
                    </span>
                )}
            </div>

            {/* Phone */}
            {lead.phone && (
                <div className="lead-card__phone">
                    <Phone size={12} />
                    <span>{lead.phone}</span>
                </div>
            )}

            {/* City */}
            {lead.city && (
                <div className="lead-card__city">
                    📍 {lead.city}
                </div>
            )}

            {/* Footer: reaction timer */}
            {reactionMinutes !== null && reactionMinutes > 0 && (
                <div className={`lead-card__timer ${reactionMinutes > 30 ? 'lead-card__timer--urgent' : ''}`}>
                    ⏱ без ответа {reactionMinutes}м
                </div>
            )}
        </div>
    )
}
