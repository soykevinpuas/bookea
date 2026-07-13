import { NextResponse } from 'next/server'
import { createClient } from '@/lib/server'
import { getStripeClient } from '@/lib/stripe'
import type Stripe from 'stripe'

type CartItemType = 'digital' | 'physical'

type CheckoutCartBook = {
  title: string | null
  price_digital: number | null
  price_physical: number | null
  stock_physical: number | null
}

type CheckoutCartRow = {
  id: string
  book_id: string
  type: CartItemType
  quantity: number | null
  books: CheckoutCartBook | CheckoutCartBook[] | null
}

type CheckoutItemMeta = {
  book_id: string
  type: CartItemType
  cart_item_id: string
  quantity: number
}

function pickCheckoutBook(books: CheckoutCartRow['books']) {
  return Array.isArray(books) ? books[0] ?? null : books ?? null
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { shipping } = await req.json()

    const { data: cartItems, error } = await supabase
      .from('cart_items')
      .select('id, book_id, type, quantity, books(title, price_digital, price_physical, stock_physical)')
      .eq('user_id', user.id)

    if (error || !cartItems || cartItems.length === 0) {
      return NextResponse.json({ error: 'Carrito vacío' }, { status: 400 })
    }

    const stripe = getStripeClient()
    const baseUrl = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
    const itemsMeta: CheckoutItemMeta[] = []
    let hasPhysical = false

    for (const item of cartItems as CheckoutCartRow[]) {
      const book = pickCheckoutBook(item.books)
      if (!book) {
        return NextResponse.json({ error: 'Libro no encontrado en el carrito' }, { status: 400 })
      }
      const quantity = item.quantity || 1
      const price = item.type === 'digital' ? (book.price_digital || 29) : (book.price_physical || 299)

      if (item.type === 'physical') {
        hasPhysical = true
        if (!book.stock_physical || book.stock_physical < quantity) {
          return NextResponse.json({ error: `"${book.title}" físico agotado` }, { status: 400 })
        }
      }

      lineItems.push({
        price_data: {
          currency: 'mxn',
          product_data: { name: `${book.title} - ${item.type === 'digital' ? 'Digital' : 'Físico'}` },
          unit_amount: Math.round(Number(price) * 100),
        },
        quantity,
      })

      itemsMeta.push({ book_id: item.book_id, type: item.type, cart_item_id: item.id, quantity })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      customer_email: user.email || undefined,
      metadata: {
        userId: user.id,
        items: JSON.stringify(itemsMeta),
        hasPhysical: hasPhysical ? 'true' : 'false',
        shipping: hasPhysical && shipping ? JSON.stringify(shipping) : '',
      },
      success_url: `${baseUrl}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/catalog?payment=cancelled`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error del servidor'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
