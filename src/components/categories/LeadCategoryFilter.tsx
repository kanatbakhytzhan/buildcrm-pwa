import React, { useRef, useEffect } from 'react'
import { CATEGORY_CONFIG } from '../../utils/categoryColorMap'
import { LEAD_CATEGORIES } from '../../types/leadCategory'
import type { LeadCategory } from '../../types/leadCategory'
import './LeadCategoryFilter.css'

interface LeadCategoryFilterProps {
    activeCategory: LeadCategory | 'all'
    onChange: (category: LeadCategory | 'all') => void
}

const LeadCategoryFilter: React.FC<LeadCategoryFilterProps> = ({
    activeCategory,
    onChange
}) => {
    const scrollRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to active item
    useEffect(() => {
        if (scrollRef.current) {
            const activeEl = scrollRef.current.querySelector('.category-filter-item--active') as HTMLElement
            if (activeEl) {
                const container = scrollRef.current
                const scrollLeft = activeEl.offsetLeft - container.offsetWidth / 2 + activeEl.offsetWidth / 2
                container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
            }
        }
    }, [activeCategory])

    return (
        <div className="category-filter-scroll" ref={scrollRef}>
            <button
                className={`category-filter-item ${activeCategory === 'all' ? 'category-filter-item--active' : ''}`}
                onClick={() => onChange('all')}
            >
                Все
            </button>

            {LEAD_CATEGORIES.map((cat) => {
                const config = CATEGORY_CONFIG[cat]
                const isActive = activeCategory === cat

                return (
                    <button
                        key={cat}
                        className={`category-filter-item ${isActive ? 'category-filter-item--active' : ''}`}
                        onClick={() => onChange(cat)}
                        style={isActive ? {
                            backgroundColor: config.bgColor,
                            color: config.color,
                            borderColor: config.borderColor
                        } : {}}
                    >
                        <span
                            className="category-filter-dot"
                            style={{ backgroundColor: config.color }}
                        />
                        {config.label}
                    </button>
                )
            })}
        </div>
    )
}

export default LeadCategoryFilter
