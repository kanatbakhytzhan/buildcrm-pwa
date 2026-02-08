import React, { useEffect } from 'react'
import './Modal.css'

export interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    children: React.ReactNode
    footer?: React.ReactNode
    size?: 'sm' | 'md' | 'lg' | 'xl'
    closeOnOverlayClick?: boolean
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    size = 'md',
    closeOnOverlayClick = true,
}) => {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
            }
        }

        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
            document.body.style.overflow = 'hidden'
        }

        return () => {
            document.removeEventListener('keydown', handleEscape)
            document.body.style.overflow = ''
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div
            className="ui-modal-overlay"
            onClick={(e) => {
                if (closeOnOverlayClick && e.target === e.currentTarget) {
                    onClose()
                }
            }}
        >
            <div className={`ui-modal ui-modal--${size}`}>
                {title && (
                    <div className="ui-modal__header">
                        <h2 className="ui-modal__title">{title}</h2>
                        <button className="ui-modal__close" onClick={onClose} aria-label="Close">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path
                                    d="M6 6L18 18M18 6L6 18"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                            </svg>
                        </button>
                    </div>
                )}

                <div className="ui-modal__body">{children}</div>

                {footer && <div className="ui-modal__footer">{footer}</div>}
            </div>
        </div>
    )
}
