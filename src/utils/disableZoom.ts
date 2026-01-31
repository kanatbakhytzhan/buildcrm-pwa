/**
 * Disable pinch zoom and double-tap zoom on iOS Safari / mobile.
 * Does not block normal taps or scroll (touch-action: manipulation in CSS).
 */
export function setupZoomDisable(): () => void {
  let lastTouchEnd = 0
  const DOUBLE_TAP_MS = 300

  const preventGesture = (e: Event) => {
    e.preventDefault()
  }

  const preventDoubleTapZoom = (e: TouchEvent) => {
    const now = Date.now()
    if (now - lastTouchEnd <= DOUBLE_TAP_MS) {
      e.preventDefault()
    }
    lastTouchEnd = now
  }

  document.addEventListener('gesturestart', preventGesture, { passive: false })
  document.addEventListener('gesturechange', preventGesture, { passive: false })
  document.addEventListener('gestureend', preventGesture, { passive: false })
  document.addEventListener('touchend', preventDoubleTapZoom, { passive: false })

  return () => {
    document.removeEventListener('gesturestart', preventGesture)
    document.removeEventListener('gesturechange', preventGesture)
    document.removeEventListener('gestureend', preventGesture)
    document.removeEventListener('touchend', preventDoubleTapZoom)
  }
}
