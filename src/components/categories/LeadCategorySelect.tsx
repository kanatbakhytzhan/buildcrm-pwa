import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { LEAD_CATEGORIES } from '../../types/leadCategory'
import type { LeadCategory } from '../../types/leadCategory'
import { CATEGORY_CONFIG } from '../../utils/categoryColorMap'
import LeadCategoryBadge from './LeadCategoryBadge'
import './LeadCategorySelect.css'

interface LeadCategorySelectProps {
    category: LeadCategory | string
    onChange: (category: LeadCategory) => void
    disabled?: boolean
}

const LeadCategorySelect: React.FC<LeadCategorySelectProps> = ({
    category,
    onChange,
    disabled
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const wrapperRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSelect = (cat: LeadCategory) => {
        onChange(cat)
        setIsOpen(false)
    }

    return (
        <div className="lead-category-select" ref={wrapperRef}>
            <button
                type="button"
                className="lead-category-select__trigger"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
            >
                <LeadCategoryBadge category={category} />
                <ChevronDown size={16} className={`lead-category-select__chevron ${isOpen ? 'open' : ''}`} />
            </button>

            {isOpen && (
                <div className="lead-category-select__dropdown">
                    {LEAD_CATEGORIES.map((cat) => {
                        const config = CATEGORY_CONFIG[cat]
                        const isSelected = category === cat

                        return (
                            <button
                                key={cat}
                                type="button"
                                className={`lead-category-select__option ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleSelect(cat)}
                            >
                                <span
                                    className="lead-category-select__dot"
                                    style={{ backgroundColor: config.color }}
                                />
                                <span className="lead-category-select__label">{config.label}</span>
                                {isSelected && <Check size={14} className="lead-category-select__check" />}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default LeadCategorySelect
