"use client"

import { useEffect, useState } from 'react'
import { useCartStore } from '@/stores/cart'
import { useUserId } from '@/hooks/useUser'
import { X, ShoppingCart, Trash2, Loader2, Minus, Plus, MapPin } from 'lucide-react'
import Image from 'next/image'

export default function CartPanel() {
  const { userId } = useUserId()
  const { items, loading, open, setOpen, fetchCart, addItem, removeItem, shipping, setShipping } = useCartStore()
  const [checkingOut, setCheckingOut] = useState(false)
  const [showShipping, setShowShipping] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (userId) fetchCart()
  }, [userId, fetchCart])

  useEffect(() => {
    if (items.some((i) => i.type === 'physical')) {
      setShowShipping(true)
    }
  }, [items])

  const totalDigital = items.filter((i) => i.type === 'digital').reduce((a, i) => a + i.price, 0)
  const totalPhysical = items.filter((i) => i.type === 'physical').reduce((a, i) => a + i.price, 0)
  const shippingCost = items.some((i) => i.type === 'physical') ? 50 : 0
  const total = totalDigital + totalPhysical + shippingCost

  const handleCheckout = async () => {
    if (items.length === 0) return
    setCheckingOut(true)
    setError('')

    if (showShipping && (!shipping.name || !shipping.address || !shipping.city || !shipping.state || !shipping.zip)) {
      setError('Completa los datos de envío')
      setCheckingOut(false)
      return
    }

    try {
      const res = await fetch('/api/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipping: showShipping ? shipping : null }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Error al crear el pago')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setCheckingOut(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed left-4 bottom-24 z-40 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-all"
      >
        <ShoppingCart className="w-5 h-5" />
        {items.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-[#111111] shadow-2xl h-full overflow-y-auto animate-in slide-in-from-left duration-300">
            <div className="sticky top-0 z-10 bg-white dark:bg-[#111111] border-b border-gray-200 dark:border-white/10 px-4 py-3 flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-500" />
                Carrito ({items.length})
              </h2>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
              ) : items.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Tu carrito está vacío</p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="flex gap-3 bg-gray-50 dark:bg-white/5 rounded-xl p-3">
                    {item.cover_url && (
                      <div className="w-14 h-20 rounded-lg overflow-hidden shrink-0 bg-gray-200 dark:bg-white/10">
                        <Image src={item.cover_url} alt={item.title} width={56} height={80} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{item.title}</p>
                      <p className="text-xs text-gray-500">{item.author}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          item.type === 'digital' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                        }`}>
                          {item.type === 'digital' ? 'Digital' : 'Físico'}
                        </span>
                        <span className="text-sm font-bold">${item.price} MXN</span>
                      </div>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="p-1 hover:bg-red-100 dark:hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-500 transition-colors self-start">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {showShipping && items.length > 0 && (
              <div className="px-4 pb-4">
                <div className="flex items-center gap-2 text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">
                  <MapPin className="w-4 h-4" /> Datos de envío
                </div>
                <div className="space-y-2">
                  <input placeholder="Nombre completo" value={shipping.name} onChange={(e) => setShipping({ ...shipping, name: e.target.value })} className="w-full p-2 text-sm bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
                  <input placeholder="Dirección" value={shipping.address} onChange={(e) => setShipping({ ...shipping, address: e.target.value })} className="w-full p-2 text-sm bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Ciudad" value={shipping.city} onChange={(e) => setShipping({ ...shipping, city: e.target.value })} className="w-full p-2 text-sm bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
                    <input placeholder="Estado" value={shipping.state} onChange={(e) => setShipping({ ...shipping, state: e.target.value })} className="w-full p-2 text-sm bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
                    <input placeholder="CP" value={shipping.zip} onChange={(e) => setShipping({ ...shipping, zip: e.target.value })} className="w-full p-2 text-sm bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
                    <input placeholder="Teléfono" value={shipping.phone} onChange={(e) => setShipping({ ...shipping, phone: e.target.value })} className="w-full p-2 text-sm bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
                  </div>
                </div>
              </div>
            )}

            {items.length > 0 && (
              <div className="sticky bottom-0 bg-white dark:bg-[#111111] border-t border-gray-200 dark:border-white/10 px-4 py-4 space-y-3">
                <div className="space-y-1 text-sm">
                  {totalDigital > 0 && <div className="flex justify-between text-gray-500"><span>Digitales</span><span>${totalDigital} MXN</span></div>}
                  {totalPhysical > 0 && <div className="flex justify-between text-gray-500"><span>Físicos</span><span>${totalPhysical} MXN</span></div>}
                  {shippingCost > 0 && <div className="flex justify-between text-gray-500"><span>Envío</span><span>${shippingCost} MXN</span></div>}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 dark:border-white/10">
                    <span>Total</span><span>${total} MXN</span>
                  </div>
                </div>
                {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
                <button
                  onClick={handleCheckout}
                  disabled={checkingOut || items.length === 0}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {checkingOut ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</> : `Pagar $${total} MXN`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
