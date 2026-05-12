'use server'

import { createClient } from '@/lib/server'
import { getStripeClient } from '@/lib/stripe'
import { revalidatePath } from 'next/cache'

/**
 * Verifica el ESTADO de un pago después de redirect desde Stripe Checkout.
 * Detecta si fue suscripción o compra de libro(s) y retorna los items.
 * NO muta la base de datos — el webhook de Stripe es el único que escribe.
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

    // === SUSCRIPCIÓN ===
    if (session.mode === 'subscription') {
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (userData?.role === 'subscriber' || userData?.role === 'admin') {
        revalidatePath('/')
        revalidatePath('/dashboard')
        return { success: true, type: 'subscription' }
      }

      return { success: false, pending: true, error: 'El pago aún se está procesando.' }
    }

    // === COMPRA DE LIBRO(S) (individual o carrito) ===
    if (session.mode === 'payment') {
      const cartItemsStr = session.metadata?.items

      // Compra de carrito (múltiples items)
      if (cartItemsStr) {
        const items = JSON.parse(cartItemsStr) as { book_id: string; type: string; cart_item_id: string }[]

        // Verificar que el carrito ya fue limpiado (webhook lo procesó)
        const { data: remaining } = await supabase
          .from('cart_items')
          .select('id')
          .eq('user_id', user.id)

        if (!remaining || remaining.length === 0) {
          // Obtener nombres de los libros
          const bookIds = [...new Set(items.map(i => i.book_id))]
          const { data: books } = await supabase
            .from('books')
            .select('id, title')
            .in('id', bookIds)

          const itemNames = items.map(item => {
            const book = books?.find(b => b.id === item.book_id)
            const label = item.type === 'physical' ? 'Físico' : 'Digital'
            return book ? `${book.title} (${label})` : `Libro (${label})`
          })

          revalidatePath('/')
          revalidatePath('/dashboard')
          return { success: true, type: 'payment', items: itemNames }
        }
      }

      // Compra individual (legacy)
      const bookId = session.metadata?.bookId
      if (bookId) {
        const { data: access } = await supabase
          .from('user_books')
          .select('id')
          .eq('user_id', user.id)
          .eq('book_id', bookId)
          .maybeSingle()

        if (access) {
          const { data: book } = await supabase
            .from('books')
            .select('title')
            .eq('id', bookId)
            .single()

          revalidatePath('/')
          revalidatePath('/dashboard')
          return { success: true, type: 'payment', items: [book?.title || 'Libro'] }
        }
      }

      return { success: false, pending: true, error: 'El pago aún se está procesando.' }
    }

    return { success: false, error: 'Tipo de sesión no soportado.' }
  } catch (error: unknown) {
    console.error('Error verificando pago:', error)
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    return { success: false, error: 'Error al verificar el pago' }
  }
}
