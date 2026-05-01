// 4.x - Utilería para gestión de rachas de lectura con anti-abuse
// Un día cuenta como "activo" solo si el usuario leyó al menos 2 minutos o avanzó 1 página

import { createClientClient } from '@/lib/supabase'
import { ANTI_ABUSE_LIMITS } from '@/types/coins'

const STREAK_SESSION_KEY = 'bookea-streak-session-start'

export async function recordReadingSession(bookId: string): Promise<void> {
  if (typeof window === 'undefined') return

  const sessionStart = sessionStorage.getItem(STREAK_SESSION_KEY)

  if (!sessionStart) {
    sessionStorage.setItem(STREAK_SESSION_KEY, Date.now().toString())
    return
  }

  const elapsed = Date.now() - parseInt(sessionStart, 10)
  const minMinutes = ANTI_ABUSE_LIMITS.min_reading_minutes_for_streak
  const minMs = minMinutes * 60 * 1000

  if (elapsed >= minMs) {
    await updateStreakOnServer()
  }
}

async function updateStreakOnServer() {
  try {
    const supabase = createClientClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    const { data } = await supabase
      .rpc('update_streak_and_check_milestones', { p_user_id: user.id })

    if (data?.coins_awarded && data.coins_awarded.length > 0) {
      console.log(`[Streak] ¡Monedas otorgadas! Racha: ${data.streak}`, data.coins_awarded)
    }
  } catch (err) {
    console.warn('[Streak] Error actualizando racha:', err)
  }
}

export function getReadingSessionElapsedMs(): number {
  if (typeof window === 'undefined') return 0

  const sessionStart = sessionStorage.getItem(STREAK_SESSION_KEY)
  if (!sessionStart) return 0

  return Date.now() - parseInt(sessionStart, 10)
}

export function resetReadingSession(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(STREAK_SESSION_KEY)
}

export function canCountStreakDay(): boolean {
  const elapsed = getReadingSessionElapsedMs()
  const minMs = ANTI_ABUSE_LIMITS.min_reading_minutes_for_streak * 60 * 1000
  return elapsed >= minMs
}
