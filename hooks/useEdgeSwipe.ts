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
    document.body.style.overscrollBehaviorX = 'contain'
    document.body.style.touchAction = 'pan-y'
    return () => {
      document.body.style.overscrollBehaviorX = ''
      document.body.style.touchAction = ''
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
        e.preventDefault()
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!edgeSwipe.current) return
      const touch = e.touches[0]
      const dx = Math.abs(touch.clientX - startX.current)
      const dy = Math.abs(touch.clientY - startY.current)
      if (dx > dy) {
        e.preventDefault()
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!edgeSwipe.current) return
      edgeSwipe.current = false

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

    document.addEventListener('touchstart', handleTouchStart, { passive: false })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [enabled, onSwipeFromLeft, onSwipeFromRight, onSwipeLeft, onSwipeRight])
}
