import { useEffect, useRef } from 'react'

const EDGE_THRESHOLD = 40
const SWIPE_THRESHOLD = 60

interface UseEdgeSwipeOptions {
  onSwipeFromRight?: () => void
  onSwipeFromLeft?: () => void
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  enabled?: boolean
}

function lockBody() {
  document.body.style.overflow = 'hidden'
  document.body.style.overscrollBehaviorX = 'none'
  document.documentElement.style.overscrollBehaviorX = 'none'
}

function unlockBody() {
  document.body.style.overflow = ''
  document.body.style.overscrollBehaviorX = 'none'
  document.documentElement.style.overscrollBehaviorX = 'none'
}

export function useEdgeSwipe({
  onSwipeFromRight,
  onSwipeFromLeft,
  onSwipeLeft,
  onSwipeRight,
  enabled = true,
}: UseEdgeSwipeOptions) {
  const startX = useRef(0)
  const startY = useRef(0)
  const edgeSwipe = useRef(false)

  useEffect(() => {
    document.body.style.touchAction = 'pan-y'
    document.body.style.overscrollBehaviorX = 'none'
    document.documentElement.style.overscrollBehaviorX = 'none'
    return () => {
      document.body.style.touchAction = ''
      document.body.style.overscrollBehaviorX = ''
      document.documentElement.style.overscrollBehaviorX = ''
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      startX.current = touch.clientX
      startY.current = touch.clientY
      const fromLeftEdge = touch.clientX < EDGE_THRESHOLD
      const fromRightEdge = window.innerWidth - touch.clientX < EDGE_THRESHOLD
      edgeSwipe.current = fromLeftEdge || fromRightEdge

      if (edgeSwipe.current) {
        // No prevenir default si el target es un elemento interactivo
        // (botón, link, input, etc.) para no matar clicks en UI de borde
        // como el avatar de UserMenu, cart toggle, etc.
        const target = e.target as HTMLElement
        const isInteractive = target?.closest?.('button, a, [role="button"], input, select, textarea, label')
        if (!isInteractive) {
          e.preventDefault()
          lockBody()
        }
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!edgeSwipe.current) return
      e.preventDefault()
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!edgeSwipe.current) return
      edgeSwipe.current = false
      unlockBody()

      const touch = e.changedTouches[0]
      const dx = touch.clientX - startX.current
      const dy = touch.clientY - startY.current
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      if (absDx < SWIPE_THRESHOLD || absDx < absDy) return

      if (dx > 0 && startX.current < EDGE_THRESHOLD) {
        onSwipeFromRight?.()
        return
      }

      if (dx < 0 && window.innerWidth - startX.current < EDGE_THRESHOLD) {
        onSwipeFromLeft?.()
        return
      }

      if (dx > SWIPE_THRESHOLD) {
        onSwipeRight?.()
        return
      }

      if (dx < -SWIPE_THRESHOLD) {
        onSwipeLeft?.()
        return
      }
    }

    const handleTouchCancel = () => {
      if (edgeSwipe.current) {
        edgeSwipe.current = false
        unlockBody()
      }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: false })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    document.addEventListener('touchcancel', handleTouchCancel, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('touchcancel', handleTouchCancel)
      unlockBody()
    }
  }, [enabled, onSwipeFromLeft, onSwipeFromRight, onSwipeLeft, onSwipeRight])
}
