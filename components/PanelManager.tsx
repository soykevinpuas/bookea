"use client"

import { useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import CartPanel from './CartPanel'
import LibraryPanel from './LibraryPanel'
import { useEdgeSwipe } from '@/hooks/useEdgeSwipe'

export default function PanelManager() {
  const [cartOpen, setCartOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const pathname = usePathname()
  const isReader = pathname?.startsWith('/reader/')

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
    enabled: !isReader,
  })

  return (
    <>
      <CartPanel open={cartOpen} onClose={closeCart} />
      <LibraryPanel open={libraryOpen} onClose={closeLibrary} />
    </>
  )
}
