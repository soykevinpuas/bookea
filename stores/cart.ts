import { create } from 'zustand'

export interface CartItem {
  id: string
  book_id: string
  title: string
  author: string
  cover_url: string | null
  type: 'digital' | 'physical'
  price: number
  stock_physical: number
}

interface CartStore {
  items: CartItem[]
  loading: boolean
  removingItems: Set<string>
  open: boolean
  libraryOpen: boolean
  shipping: { name: string; address: string; city: string; state: string; zip: string; phone: string }
}

interface CartActions {
  fetchCart: () => Promise<void>
  addItem: (bookId: string, type: 'digital' | 'physical') => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  clearCart: () => Promise<void>
  setOpen: (open: boolean) => void
  toggleCart: () => void
  setLibraryOpen: (open: boolean) => void
  toggleLibrary: () => void
  setShipping: (s: CartStore['shipping']) => void
}

type CartStoreState = CartStore & CartActions

const SHIPPING_KEY = 'bookea_shipping'

function loadShipping() {
  if (typeof window === 'undefined') return { name: '', address: '', city: '', state: '', zip: '', phone: '' }
  try {
    const stored = localStorage.getItem(SHIPPING_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return { name: '', address: '', city: '', state: '', zip: '', phone: '' }
}

function saveShipping(s: CartStore['shipping']) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SHIPPING_KEY, JSON.stringify(s))
  }
}

let fetchId = 0
let mutateId = 0

export const useCartStore = create<CartStoreState>((set, get) => ({
  items: [],
  loading: false,
  removingItems: new Set<string>(),
  open: false,
  libraryOpen: false,
  shipping: loadShipping(),

  fetchCart: async () => {
    const id = ++fetchId
    const snapshot = mutateId
    set({ loading: true })
    try {
      const res = await fetch('/api/cart', { cache: 'no-store' })
      if (!res.ok) return
      if (snapshot !== mutateId) return
      const data = await res.json()
      if (id === fetchId) set({ items: data.items || [] })
    } catch (err) {
      console.error('[cart] fetchCart error:', err)
    } finally {
      if (id === fetchId) set({ loading: false })
    }
  },

  addItem: async (bookId, type) => {
    ++mutateId
    set({ loading: true })
    // Optimistic: add placeholder item instantly
    const placeholder: CartItem = { id: `pending-${bookId}`, book_id: bookId, title: '...', author: '...', cover_url: null, type, price: 0, stock_physical: 0 }
    set((s) => ({ items: [...s.items, placeholder] }))
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, type }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error('[cart] addItem API error:', res.status, body)
        throw new Error(body.error || `Error del servidor (${res.status})`)
      }
      const data = await res.json()
      set({ items: data.items || [] })
    } catch {
      // Revert on failure
      set((s) => ({ items: s.items.filter((i) => i.id !== `pending-${bookId}`) }))
    } finally {
      set({ loading: false })
    }
  },

  removeItem: async (itemId) => {
    ++mutateId
    const oldItems = get().items
    set((s) => ({ removingItems: new Set(s.removingItems).add(itemId), items: s.items.filter((i) => i.id !== itemId) }))
    try {
      const res = await fetch(`/api/cart?id=${itemId}`, { method: 'DELETE' })
      if (res.ok) {
        const data = await res.json()
        set({ items: data.items || [] })
      } else {
        set({ items: oldItems })
      }
    } catch {
      set({ items: oldItems })
    } finally {
      set((s) => { const next = new Set(s.removingItems); next.delete(itemId); return { removingItems: next }; })
    }
  },

  clearCart: async () => {
    const res = await fetch('/api/cart', { method: 'DELETE' })
    if (res.ok) {
      set({ items: [] })
    }
  },

  setOpen: (open) => set({ open }),
  toggleCart: () => {
    const { open } = get();
    if (!open) {
      get().fetchCart();
    }
    set({ open: !open });
  },
  setLibraryOpen: (open) => set({ libraryOpen: open }),
  toggleLibrary: () => set((s) => ({ libraryOpen: !s.libraryOpen })),

  setShipping: (shipping) => {
    set({ shipping })
    saveShipping(shipping)
  },
}))
