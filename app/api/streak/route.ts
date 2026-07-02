import { createClient } from '@/lib/server'
import { NextResponse } from 'next/server'

// API route para actualizar racha de lectura (llamada via sendBeacon)
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // La racha siempre pertenece al usuario autenticado; no aceptamos ids por body.
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // RPC centraliza reglas de hitos y monedas para que cliente y servidor no diverjan.
    const { data, error } = await supabase
      .rpc('update_streak_and_check_milestones', { p_user_id: user.id })

    if (error) {
      console.error('[Streak API] RPC error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, streak: data?.streak, coins: data?.coins_awarded })
  } catch (err: unknown) {
    console.error('[Streak API] Exception:', err)
    const message = err instanceof Error ? err.message : 'Error inesperado'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
