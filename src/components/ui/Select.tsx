import React, { useState, useRef, useEffect } from 'react'
import './Select.css'

export interface SelectOption {
    value: string
    label: string
    disabled?: boolean
}

export interface SelectProps {
    options: SelectOption[]
    value?: string
    onChange?: (value: string) => void
    placeholder?: string
    searchable?: boolean
    disabled?: boolean
    size?: 'sm' | 'md' | 'lg'
    fullWidth?: boolean
    className?: string
}

export const Select: React.FC<SelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Выберите...',
    searchable = false,
    disabled = false,
    size = 'md',
    fullWidth = false,
    className = '',
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)

    const selectedOption = options.find(opt => opt.value === value)

    const filteredOptions = searchable
        ? options.filter(opt =>
            opt.label.toLowerCase().includes(search.toLowerCase())
        )
        : options

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    const handleSelect = (optionValue: string) => {
        onChange?.(optionValue)
        setIsOpen(false)
        setSearch('')
    }

    const classes = [
        'ui-select',
        `ui-select--${size}`,
        fullWidth && 'ui-select--full',
        className,
    ].filter(Boolean).join(' ')

    return (
        <div className={classes} ref={containerRef}>
            <button
                type="button"
                className={`ui-select__trigger ${disabled ? 'ui-select__trigger--disabled' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
            >
                <span className={selectedOption ? '' : 'ui-select__placeholder'}>
                    {selectedOption?.label || placeholder}
                </span>
                <span className={`ui-select__icon ${isOpen ? 'ui-select__icon--open' : ''}`}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path
                            d="M4 6L8 10L12 6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </span>
            </button>

            {isOpen && (
                <div className="ui-select__dropdown">
                    {searchable && (
                        <div className="ui-select__search">
                            <input
                                type="text"
                                placeholder="Поиск..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                    )}

                    {filteredOptions.length === 0 ? (
                        <div className="ui-select__empty">Ничего не найдено</div>
                    ) : (
                        filteredOptions.map((option) => (
                            <div
                                key={option.value}
                                className={`ui-select__option ${option.value === value ? 'ui-select__option--selected' : ''
                                    } ${option.disabled ? 'ui-select__option--disabled' : ''}`}
                                onClick={() => !option.disabled && handleSelect(option.value)}
                            >
                                {option.label}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}
