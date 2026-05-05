// 4.x - Utilería para gestión de rachas de lectura con anti-abuse
// Un día cuenta como "activo" solo si el usuario leyó al menos 2 minutos

import { createClientClient } from '@/lib/supabase'
import { ANTI_ABUSE_LIMITS } from '@/types/coins'

const STREAK_SESSION_KEY = 'bookea-streak-session-start'
const STREAK_UPDATED_KEY = 'bookea-streak-updated-date'

export function startReadingSession(): void {
  if (typeof window === 'undefined') return
  if (!sessionStorage.getItem(STREAK_SESSION_KEY)) {
    sessionStorage.setItem(STREAK_SESSION_KEY, Date.now().toString())
  }
}

export function endReadingSession(): void {
  if (typeof window === 'undefined') return
  const elapsed = getReadingSessionElapsedMs()
  const minMs = ANTI_ABUSE_LIMITS.min_reading_minutes_for_streak * 60 * 1000

  if (elapsed >= minMs) {
    const today = new Date().toDateString()
    const lastUpdated = sessionStorage.getItem(STREAK_UPDATED_KEY)

    if (lastUpdated !== today) {
      sessionStorage.setItem(STREAK_UPDATED_KEY, today)
      triggerStreakUpdate()
    }
  }
  sessionStorage.removeItem(STREAK_SESSION_KEY)
}

function triggerStreakUpdate(): void {
  if (typeof window === 'undefined') return

  const data = new FormData()
  data.append('action', 'update_streak')

  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/streak', data)
  } else {
    fetch('/api/streak', {
      method: 'POST',
      body: data,
      keepalive: true,
    }).catch(() => {})
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
  sessionStorage.removeItem(STREAK_UPDATED_KEY)
}

export function recordReadingSession(bookId: string): void {
  // Guardamos el ID del libro por si fuera necesario en el futuro,
  // aunque la racha es por día de lectura global.
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('bookea-current-reading-book', bookId)
  }
  startReadingSession()
}

export function canCountStreakDay(): boolean {
  if (typeof window === 'undefined') return false
  const elapsed = getReadingSessionElapsedMs()
  const minMs = ANTI_ABUSE_LIMITS.min_reading_minutes_for_streak * 60 * 1000
  return elapsed >= minMs
}

export async function updateStreakOnServer(): Promise<{ streak: number; coins: Array<{ coin_type: string; amount: number }> | null }> {
  const supabase = createClientClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { streak: 0, coins: null }

  try {
    const { data, error } = await supabase
      .rpc('update_streak_and_check_milestones', { p_user_id: user.id })

    if (error) {
      console.warn('[Streak] RPC error:', error.message)
      return { streak: 0, coins: null }
    }

    return { streak: data?.streak || 0, coins: data?.coins_awarded || null }
  } catch (err) {
    console.warn('[Streak] Exception:', err)
    return { streak: 0, coins: null }
  }
}
