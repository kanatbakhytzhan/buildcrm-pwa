import { useEffect, useState } from 'react'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

export interface BreakpointState {
    isMobile: boolean
    isTablet: boolean
    isDesktop: boolean
    current: Breakpoint
}

const MOBILE_MAX = 640
const TABLET_MAX = 1024

function getBreakpoint(width: number): Breakpoint {
    if (width < MOBILE_MAX) return 'mobile'
    if (width < TABLET_MAX) return 'tablet'
    return 'desktop'
}

export function useBreakpoint(): BreakpointState {
    const [breakpoint, setBreakpoint] = useState<Breakpoint>(() =>
        getBreakpoint(window.innerWidth)
    )

    useEffect(() => {
        const handleResize = () => {
            const newBreakpoint = getBreakpoint(window.innerWidth)
            if (newBreakpoint !== breakpoint) {
                setBreakpoint(newBreakpoint)
            }
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [breakpoint])

    return {
        isMobile: breakpoint === 'mobile',
        isTablet: breakpoint === 'tablet',
        isDesktop: breakpoint === 'desktop',
        current: breakpoint,
    }
}
