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
  open: boolean
  shipping: { name: string; address: string; city: string; state: string; zip: string; phone: string }
}

interface CartActions {
  fetchCart: () => Promise<void>
  addItem: (bookId: string, type: 'digital' | 'physical') => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  clearCart: () => Promise<void>
  setOpen: (open: boolean) => void
  toggleCart: () => void
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

export const useCartStore = create<CartStoreState>((set, get) => ({
  items: [],
  loading: false,
  open: false,
  shipping: loadShipping(),

  fetchCart: async () => {
    set({ loading: true })
    try {
      const res = await fetch('/api/cart')
      if (res.ok) {
        const data = await res.json()
        set({ items: data.items || [] })
      }
    } catch {
      // silencioso
    } finally {
      set({ loading: false })
    }
  },

  addItem: async (bookId, type) => {
    const res = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, type }),
    })
    if (res.ok) {
      const data = await res.json()
      set({ items: data.items })
    }
  },

  removeItem: async (itemId) => {
    const res = await fetch(`/api/cart?id=${itemId}`, { method: 'DELETE' })
    if (res.ok) {
      const data = await res.json()
      set({ items: data.items })
    }
  },

  clearCart: async () => {
    const res = await fetch('/api/cart', { method: 'DELETE' })
    if (res.ok) {
      set({ items: [] })
    }
  },

  setOpen: (open) => set({ open }),
  toggleCart: () => set((s) => ({ open: !s.open })),

  setShipping: (shipping) => {
    set({ shipping })
    saveShipping(shipping)
  },
}))
