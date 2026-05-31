'use server'

import { createClient, createAdminClient } from '@/lib/server'
import { getStripeClient } from '@/lib/stripe'
import { revalidatePath } from 'next/cache'

/**
 * Verifica el ESTADO de un pago después de redirect desde Stripe Checkout.
 * Si el webhook de Stripe no ha procesado el pago aún, lo procesa como fallback.
 */
export async function verifySubscriptionAction(sessionId: string) {
  if (!sessionId) return { success: false, error: 'No session ID provided' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'No autorizado' }

  try {
    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'line_items.data.price.product'],
    })

    const userId = user.id
    const adminDb = createAdminClient()

    // === SUSCRIPCIÓN ===
    if (session.mode === 'subscription') {
      const { data: userData } = await adminDb
        .from('users')
        .select('role')
        .eq('id', userId)
        .single()

      if (userData?.role === 'subscriber' || userData?.role === 'admin' || userData?.role === 'vendedor') {
        revalidatePath('/')
        revalidatePath('/dashboard')
        return { success: true, type: 'subscription' }
      }

      // Fallback si webhook no ha procesado
      if (session.payment_status === 'paid') {
        const endsAt = new Date()
        endsAt.setDate(endsAt.getDate() + 30)
        await adminDb.from('users').update({
          role: userData?.role === 'admin' ? 'admin' : userData?.role === 'vendedor' ? 'vendedor' : 'subscriber',
          subscription_ends_at: endsAt.toISOString(),
        }).eq('id', userId)

        revalidatePath('/')
        revalidatePath('/dashboard')
        return { success: true, type: 'subscription' }
      }

      return { success: false, pending: true }
    }

    // === COMPRA DE LIBRO(S) ===
    if (session.mode === 'payment' && session.payment_status === 'paid') {
      const itemsStr = session.metadata?.items

      // Compra de carrito (múltiples items)
      if (itemsStr) {
        const items: { book_id: string; type: string; cart_item_id: string }[] = JSON.parse(itemsStr)

        // Procesar cada item (idempotente — verifica existencia primero)
        for (const item of items) {
          if (item.type === 'digital') {
            const { data: existing } = await adminDb
              .from('user_books')
              .select('id')
              .eq('user_id', userId)
              .eq('book_id', item.book_id)
              .maybeSingle()
            if (!existing) {
              await adminDb.from('user_books').insert({
                user_id: userId, book_id: item.book_id, access_type: 'permanent',
              })
            }
          } else if (item.type === 'physical') {
            const shippingStr = session.metadata?.shipping
            let shippingInfo: Record<string, string> | null = null
            if (shippingStr) try { shippingInfo = JSON.parse(shippingStr) } catch {}
            const { data: existing } = await adminDb
              .from('orders_physical')
              .select('id')
              .eq('stripe_payment_id', session.id)
              .maybeSingle()
            if (!existing) {
              const { data: bookPrice } = await adminDb
                .from('books')
                .select('price_physical')
                .eq('id', item.book_id)
                .single()
              const price = (bookPrice?.price_physical || 299)
              await adminDb.from('orders_physical').insert({
                user_id: userId, book_id: item.book_id, status: 'pending',
                name: shippingInfo?.name || '', address: shippingInfo?.address || '',
                city: shippingInfo?.city || '', state: shippingInfo?.state || '',
                zip: shippingInfo?.zip || '', phone: shippingInfo?.phone || '',
                shipping_cost: 50, total: price + 50, stripe_payment_id: session.id,
              })
              try { await adminDb.rpc('decrement_stock', { p_book_id: item.book_id }) } catch {}
            }
          }
        }

        // Limpiar carrito
        await adminDb.from('cart_items').delete().eq('user_id', userId)

        // Obtener nombres de items
        const bookIds = [...new Set(items.map(i => i.book_id))]
        const { data: books } = await adminDb
          .from('books').select('id, title').in('id', bookIds)
        const itemNames = items.map(item => {
          const book = books?.find(b => b.id === item.book_id)
          const label = item.type === 'physical' ? 'Físico' : 'Digital'
          return book ? `${book.title} (${label})` : `Libro (${label})`
        })

        revalidatePath('/')
        revalidatePath('/dashboard')
        return { success: true, type: 'payment', items: itemNames }
      }

      // Compra individual (legacy & physical/bundle individual checkout)
      const bookId = session.metadata?.bookId
      if (bookId) {
        const purchaseType = session.metadata?.purchaseType || 'digital_permanent'

        if (purchaseType === 'digital_permanent' || purchaseType === 'bundle') {
          const { data: existing } = await adminDb
            .from('user_books').select('id')
            .eq('user_id', userId).eq('book_id', bookId)
            .maybeSingle()
          if (!existing) {
            await adminDb.from('user_books').insert({
              user_id: userId, book_id: bookId, access_type: 'permanent',
            })
          }
        }

        if (purchaseType === 'physical' || purchaseType === 'bundle') {
          const { data: existing } = await adminDb
            .from('orders_physical')
            .select('id')
            .eq('stripe_payment_id', session.id)
            .maybeSingle()

          if (!existing) {
            const shippingStr = session.metadata?.shipping
            let shippingInfo: Record<string, string> | null = null
            if (shippingStr) try { shippingInfo = JSON.parse(shippingStr) } catch {}
            const { data: bookPrice } = await adminDb
              .from('books')
              .select('price_physical')
              .eq('id', bookId)
              .single()
            const price = (bookPrice?.price_physical || 299)
            await adminDb.from('orders_physical').insert({
              user_id: userId, book_id: bookId, status: 'pending',
              name: shippingInfo?.name || '', address: shippingInfo?.address || '',
              city: shippingInfo?.city || '', state: shippingInfo?.state || '',
              zip: shippingInfo?.zip || '', phone: shippingInfo?.phone || '',
              shipping_cost: 50, total: price + 50, stripe_payment_id: session.id,
            })
            try { await adminDb.rpc('decrement_stock', { p_book_id: bookId }) } catch {}
          }
        }

        const { data: book } = await adminDb
          .from('books').select('title').eq('id', bookId).single()

        revalidatePath('/')
        revalidatePath('/dashboard')
        return { success: true, type: 'payment', items: [book?.title || 'Libro'] }
      }
    }

    return { success: false, pending: true }
  } catch (error: unknown) {
    console.error('Error verificando pago:', error)
    return { success: false, error: 'Error al verificar el pago' }
  }
}
