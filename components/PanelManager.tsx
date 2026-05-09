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
    onSwipeFromRight: () => {
      if (cartOpen) closeCart()
      else setCartOpen(true)
    },
    onSwipeFromLeft: () => {
      if (libraryOpen) closeLibrary()
      else setLibraryOpen(true)
    },
    onSwipeRight: cartOpen ? closeCart : undefined,
    onSwipeLeft: libraryOpen ? closeLibrary : undefined,
    enabled: true,
  })

  return (
    <>
      <CartPanel open={cartOpen} onClose={closeCart} />
      <LibraryPanel open={libraryOpen} onClose={closeLibrary} />

      {/* Left edge indicator — hint to open cart */}
      {!cartOpen && (
        <div className="fixed top-1/2 left-0 z-40 -translate-y-1/2 pointer-events-none">
          <div className="preserve-gradient w-[5px] h-24 rounded-r-full bg-gradient-to-b from-blue-400/50 via-blue-400/80 to-blue-400/50 shadow-[0_0_10px_rgba(96,165,250,0.4)] animate-pulse" />
        </div>
      )}

      {/* Right edge indicator — hint to open library */}
      {!libraryOpen && (
        <div className="fixed top-1/2 right-0 z-40 -translate-y-1/2 pointer-events-none">
          <div className="preserve-gradient w-[5px] h-24 rounded-l-full bg-gradient-to-b from-blue-400/50 via-blue-400/80 to-blue-400/50 shadow-[0_0_10px_rgba(96,165,250,0.4)] animate-pulse" />
        </div>
      )}
    </>
  )
}
