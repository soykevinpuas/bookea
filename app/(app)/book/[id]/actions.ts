'use server'

import { createClient } from '@/lib/server'
import { PRICE_IDS } from '@/lib/stripe'

export async function createPurchaseSession(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'No autorizado' }
  }

  const type = formData.get('type') as string
  const bookId = formData.get('bookId') as string
  const price = formData.get('price') as string

  let priceId = ''
  
  switch (type) {
    case 'subscription':
      priceId = PRICE_IDS.subscription
      break
    case 'digital_permanent':
      priceId = price || PRICE_IDS.digital_permanent
      break
    case 'physical':
      priceId = price || PRICE_IDS.physical_basic
      break
    case 'bundle':
      priceId = price || PRICE_IDS.bundle
      break
    default:
      return { error: 'Tipo de compra inválido' }
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  try {
    const response = await fetch(`${baseUrl}/api/stripe/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        bookId,
        price: priceId,
      }),
    })

    const data = await response.json()

    if (data.error) {
      return { error: data.error }
    }

    return { url: data.url }
  } catch (error) {
    console.error('Error creating purchase session:', error)
    return { error: 'Error al crear la sesión de compra' }
  }
}
