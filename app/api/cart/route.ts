import { NextResponse } from 'next/server'
import { createClient } from '@/lib/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ items: [] })

  const { data, error } = await supabase
    .from('cart_items')
    .select('id, book_id, type, quantity, books(title, author, cover_url, price_digital, price_physical, stock_physical)')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ items: [] })

  const items = data.map((item: any) => ({
    id: item.id,
    book_id: item.book_id,
    type: item.type,
    title: item.books?.title || '',
    author: item.books?.author || '',
    cover_url: item.books?.cover_url || null,
    price: item.type === 'digital' ? item.books?.price_digital || 29 : item.books?.price_physical || 349,
    stock_physical: item.books?.stock_physical || 0,
  }))

  return NextResponse.json({ items })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { bookId, type } = await req.json()
  if (!bookId || !type) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  if (!['digital', 'physical'].includes(type)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

  if (type === 'physical') {
    const { data: book } = await supabase.from('books').select('stock_physical').eq('id', bookId).single()
    if (!book || book.stock_physical <= 0) {
      return NextResponse.json({ error: 'Sin stock' }, { status: 400 })
    }
  }

  const { error: upsertError } = await supabase.from('cart_items').upsert(
    { user_id: user.id, book_id: bookId, type, quantity: 1 },
    { onConflict: 'user_id, book_id, type', ignoreDuplicates: false }
  )

  if (upsertError) return NextResponse.json({ error: 'Error al agregar' }, { status: 500 })

  const { data } = await supabase
    .from('cart_items')
    .select('id, book_id, type, quantity, books(title, author, cover_url, price_digital, price_physical, stock_physical)')
    .eq('user_id', user.id)

  const items = (data || []).map((item: any) => ({
    id: item.id,
    book_id: item.book_id,
    type: item.type,
    title: item.books?.title || '',
    author: item.books?.author || '',
    cover_url: item.books?.cover_url || null,
    price: item.type === 'digital' ? item.books?.price_digital || 29 : item.books?.price_physical || 349,
    stock_physical: item.books?.stock_physical || 0,
  }))

  return NextResponse.json({ items })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const itemId = searchParams.get('id')

  if (itemId) {
    await supabase.from('cart_items').delete().eq('id', itemId).eq('user_id', user.id)
  } else {
    await supabase.from('cart_items').delete().eq('user_id', user.id)
  }

  const { data } = await supabase
    .from('cart_items')
    .select('id, book_id, type, quantity, books(title, author, cover_url, price_digital, price_physical, stock_physical)')
    .eq('user_id', user.id)

  const items = (data || []).map((item: any) => ({
    id: item.id,
    book_id: item.book_id,
    type: item.type,
    title: item.books?.title || '',
    author: item.books?.author || '',
    cover_url: item.books?.cover_url || null,
    price: item.type === 'digital' ? item.books?.price_digital || 29 : item.books?.price_physical || 349,
    stock_physical: item.books?.stock_physical || 0,
  }))

  return NextResponse.json({ items })
}
