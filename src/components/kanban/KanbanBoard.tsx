import { useState, useMemo } from 'react'
import {
    DndContext,
    DragOverlay,
    closestCorners,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core'
import type { Stage } from '../../types/stage'
import type { NormalizedLead } from '../../utils/normalizeLead'
import { groupLeadsByStage } from '../../utils/leadSorting'
import { categoryToStageKey } from '../../types/stage'
import { KanbanColumn } from './KanbanColumn'
import { LeadCard } from './LeadCard'
import './KanbanBoard.css'

interface KanbanBoardProps {
    stages: Stage[]
    leads: NormalizedLead[]
    onLeadMove: (leadId: string, toStageKey: string) => void
    onLeadClick: (leadId: string) => void
    selectedLeadId?: string | null
}

export function KanbanBoard({
    stages,
    leads,
    onLeadMove,
    onLeadClick,
    selectedLeadId,
}: KanbanBoardProps) {
    const [activeId, setActiveId] = useState<string | null>(null)

    // Group leads by stage
    const leadsByStage = useMemo(
        () => groupLeadsByStage(leads),
        [leads]
    )

    // Get active lead being dragged
    const activeLead = activeId ? leads.find(l => l.id === activeId) : null

    function handleDragStart(event: DragStartEvent) {
        setActiveId(event.active.id as string)
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event

        if (!over) {
            setActiveId(null)
            return
        }

        const leadId = active.id as string
        const overId = over.id as string
        let toStageKey = overId

        // If dropped over a lead card, resolve its stage from the lead itself
        if (!stages.some(s => s.key === overId)) {
            const overLead = leads.find(l => l.id === overId)
            if (overLead) {
                toStageKey = overLead.stage_key || categoryToStageKey(overLead.category)
            }
        }

        // Move lead to new stage
        if (toStageKey && active.id !== over.id) {
            onLeadMove(leadId, toStageKey)
        }

        setActiveId(null)
    }

    return (
        <DndContext
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="kanban-board">
                <div className="kanban-board__scroll">
                    {stages.map(stage => (
                        <KanbanColumn
                            key={stage.key}
                            stage={stage}
                            leads={leadsByStage[stage.key] || []}
                            onLeadClick={onLeadClick}
                            selectedLeadId={selectedLeadId}
                        />
                    ))}
                </div>
            </div>

            {/* Drag overlay */}
            <DragOverlay>
                {activeLead ? (
                    <div style={{ cursor: 'grabbing' }}>
                        <LeadCard
                            lead={activeLead}
                            onClick={() => { }}
                            isSelected={false}
                        />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    )
}
