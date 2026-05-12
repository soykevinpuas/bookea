"use client"

import React, { useCallback } from 'react'
import { usePathname } from 'next/navigation'
import CartPanel from './CartPanel'
import LibraryPanel from './LibraryPanel'
import { useEdgeSwipe } from '@/hooks/useEdgeSwipe'
import { useCartStore } from '@/stores/cart'

export default function PanelManager() {
  const cartOpen = useCartStore((s) => s.open)
  const setCartOpen = useCartStore((s) => s.setOpen)
  const [libraryOpen, setLibraryOpen] = React.useState(false)
  const pathname = usePathname()
  const isReader = pathname?.startsWith('/reader/')

  const closeCart = useCallback(() => setCartOpen(false), [setCartOpen])
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
