import React from 'react'
import { X, Check } from 'lucide-react'
import { LeadCategory, LEAD_CATEGORIES } from '../../types/leadCategory'
import { CATEGORY_CONFIG } from '../../utils/categoryColorMap'
import './LeadCategoryBottomSheet.css'

interface LeadCategoryBottomSheetProps {
    currentCategory: LeadCategory | string
    onSelect: (category: LeadCategory) => void
    onClose: () => void
}

const LeadCategoryBottomSheet: React.FC<LeadCategoryBottomSheetProps> = ({
    currentCategory,
    onSelect,
    onClose
}) => {
    return (
        <div className="category-bottom-sheet-overlay" onClick={onClose}>
            <div
                className="category-bottom-sheet"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="category-bottom-sheet__header">
                    <h3 className="category-bottom-sheet__title">Сменить категорию</h3>
                    <button className="category-bottom-sheet__close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="category-bottom-sheet__list">
                    {LEAD_CATEGORIES.map((cat) => {
                        const config = CATEGORY_CONFIG[cat]
                        const isSelected = currentCategory === cat

                        return (
                            <button
                                key={cat}
                                className={`category-sheet-item ${isSelected ? 'selected' : ''}`}
                                onClick={() => onSelect(cat)}
                            >
                                <div
                                    className="category-sheet-item__icon"
                                    style={{ backgroundColor: config.bgColor, color: config.color }}
                                >
                                    <div className="category-sheet-item__dot" style={{ backgroundColor: config.color }} />
                                </div>
                                <div className="category-sheet-item__info">
                                    <span className="category-sheet-item__label">{config.label}</span>
                                </div>
                                {isSelected && <Check size={20} className="category-sheet-item__check" style={{ color: config.color }} />}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default LeadCategoryBottomSheet
