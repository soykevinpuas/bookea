"use client"

import { useState, useCallback } from 'react'
import CartPanel from './CartPanel'
import LibraryPanel from './LibraryPanel'
import { useEdgeSwipe } from '@/hooks/useEdgeSwipe'

export default function PanelManager() {
  const [cartOpen, setCartOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)

  const closeCart = useCallback(() => setCartOpen(false), [])
  const closeLibrary = useCallback(() => setLibraryOpen(false), [])

  useEdgeSwipe({
    onSwipeFromRight: () => setCartOpen(true),
    onSwipeFromLeft: () => setLibraryOpen(true),
    onSwipeRight: cartOpen ? closeCart : undefined,
    onSwipeLeft: libraryOpen ? closeLibrary : undefined,
    enabled: !cartOpen && !libraryOpen,
  })

  return (
    <>
      <CartPanel open={cartOpen} onClose={closeCart} />
      <LibraryPanel open={libraryOpen} onClose={closeLibrary} />
    </>
  )
}
