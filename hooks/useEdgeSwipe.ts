import { useEffect, useRef } from 'react'

const EDGE_THRESHOLD = 40
const SWIPE_THRESHOLD = 80

export type SwipeDirection = 'left' | 'right'

interface UseEdgeSwipeOptions {
  onSwipeFromLeft?: () => void
  onSwipeFromRight?: () => void
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  enabled?: boolean
}

export function useEdgeSwipe({
  onSwipeFromLeft,
  onSwipeFromRight,
  onSwipeLeft,
  onSwipeRight,
  enabled = true,
}: UseEdgeSwipeOptions) {
  const startX = useRef(0)
  const startY = useRef(0)
  const swiping = useRef(false)

  useEffect(() => {
    if (!enabled) return

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      startX.current = touch.clientX
      startY.current = touch.clientY
      swiping.current = true
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!swiping.current) return
      swiping.current = false

      const touch = e.changedTouches[0]
      const dx = touch.clientX - startX.current
      const dy = touch.clientY - startY.current
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      if (absDx < SWIPE_THRESHOLD || absDx < absDy) return

      // Swipe from left edge → open cart
      if (dx > 0 && startX.current < EDGE_THRESHOLD) {
        onSwipeFromRight?.()
        return
      }

      // Swipe from right edge → open library
      if (dx < 0 && window.innerWidth - startX.current < EDGE_THRESHOLD) {
        onSwipeFromLeft?.()
        return
      }

      // Swipe right (anywhere, for closing panels)
      if (dx > SWIPE_THRESHOLD) {
        onSwipeRight?.()
        return
      }

      // Swipe left (anywhere, for closing panels)
      if (dx < -SWIPE_THRESHOLD) {
        onSwipeLeft?.()
        return
      }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [enabled, onSwipeFromLeft, onSwipeFromRight, onSwipeLeft, onSwipeRight])
}
