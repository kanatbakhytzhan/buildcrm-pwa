import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Stage } from '../../types/stage'
import type { NormalizedLead } from '../../utils/normalizeLead'
import { LeadCard } from './LeadCard'
import { EmptyState } from '../ui/EmptyState'
import './KanbanColumn.css'

interface KanbanColumnProps {
    stage: Stage
    leads: NormalizedLead[]
    onLeadClick: (leadId: string) => void
    selectedLeadId?: string | null
}

export function KanbanColumn({ stage, leads, onLeadClick, selectedLeadId }: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: stage.key,
    })

    const leadIds = leads.map(l => l.id)

    return (
        <div className="kanban-column">
            {/* Column header */}
            <div className="kanban-column__header" style={{ borderTopColor: stage.color }}>
                <div className="kanban-column__title">{stage.title}</div>
                <div className="kanban-column__count">{leads.length}</div>
            </div>

            {/* Droppable area */}
            <div
                ref={setNodeRef}
                className={`kanban-column__body ${isOver ? 'kanban-column__body--over' : ''}`}
            >
                <SortableContext items={leadIds} strategy={verticalListSortingStrategy}>
                    {leads.length === 0 ? (
                        <div className="kanban-column__empty">
                            <EmptyState
                                title="Пусто"
                                description="Нет заявок в этой стадии"
                            />
                        </div>
                    ) : (
                        leads.map(lead => (
                            <LeadCard
                                key={lead.id}
                                lead={lead}
                                onClick={() => onLeadClick(lead.id)}
                                isSelected={lead.id === selectedLeadId}
                            />
                        ))
                    )}
                </SortableContext>
            </div>
        </div>
    )
}
