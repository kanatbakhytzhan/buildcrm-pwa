import React, { useEffect } from 'react'
import './Drawer.css'

export interface DrawerProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    children: React.ReactNode
    footer?: React.ReactNode
}

export const Drawer: React.FC<DrawerProps> = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
}) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        }

        return () => {
            document.body.style.overflow = ''
        }
    }, [isOpen])

    if (!isOpen) return null

    return (
        <>
            <div className="ui-drawer-overlay" onClick={onClose} />
            <div className="ui-drawer">
                <div className="ui-drawer__handle" onClick={onClose}>
                    <div className="ui-drawer__handle-bar" />
                </div>

                {title && (
                    <div className="ui-drawer__header">
                        <h2 className="ui-drawer__title">{title}</h2>
                        <button className="ui-drawer__close" onClick={onClose} aria-label="Close">
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

                <div className="ui-drawer__body">{children}</div>

                {footer && <div className="ui-drawer__footer">{footer}</div>}
            </div>
        </>
    )
}
