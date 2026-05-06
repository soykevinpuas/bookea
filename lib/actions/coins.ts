'use server'

import { createClient } from '@/lib/server'
import { revalidatePath } from 'next/cache'
import { CoinType, CoinSource, ANTI_ABUSE_LIMITS } from '@/types/coins'

// 8.x - Server Actions para el sistema de monedas de gamificación

export async function getUserCoinsAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'No autorizado', coins: { bronze: 0, silver: 0, gold: 0, diamond: 0 } }
  }

  try {
    const { data, error } = await supabase
      .rpc('get_user_coins', { p_user_id: user.id })

    if (error) {
      console.error('[getUserCoinsAction] RPC error:', error.message)
      return { success: false, error: error.message, coins: { bronze: 0, silver: 0, gold: 0, diamond: 0 } }
    }

    return { success: true, coins: data as Record<string, number> }
  } catch (err: any) {
    console.error('[getUserCoinsAction] Exception:', err)
    return { success: false, error: err.message, coins: { bronze: 0, silver: 0, gold: 0, diamond: 0 } }
  }
}

export async function addCoinsAction(coinType: CoinType, source: CoinSource, bookId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'No autorizado' }
  }

  try {
    const { data, error } = await supabase
      .rpc('add_coins', {
        p_user_id: user.id,
        p_coin_type: coinType,
        p_amount: 1,
        p_source: source,
        p_book_id: bookId || null,
      })

    if (error) {
      console.error('[addCoinsAction] RPC error:', error.message)
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard')
    revalidatePath('/profile')

    return { success: true, result: data }
  } catch (err: any) {
    console.error('[addCoinsAction] Exception:', err)
    return { success: false, error: err.message }
  }
}

export async function redeemCoinAction(bookId: string, coinType: CoinType) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'No autorizado' }
  }

  try {
    const { data, error } = await supabase
      .rpc('redeem_coin', {
        p_user_id: user.id,
        p_book_id: bookId,
        p_coin_type: coinType,
      })

    if (error) {
      console.error('[redeemCoinAction] RPC error:', error.message)
      return { success: false, error: error.message }
    }

    if (!data.success) {
      return { success: false, error: data.error, current_count: data.current_count }
    }

    revalidatePath('/dashboard')
    revalidatePath(`/book/${bookId}`)

    return { success: true, result: data }
  } catch (err: any) {
    console.error('[redeemCoinAction] Exception:', err)
    return { success: false, error: err.message }
  }
}

export async function getUserCoinTransactionsAction(limit = 50) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'No autorizado', transactions: [] }
  }

  try {
    const { data, error } = await supabase
      .from('coin_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[getUserCoinTransactionsAction] DB error:', error.message)
      return { success: false, error: error.message, transactions: [] }
    }

    return { success: true, transactions: data }
  } catch (err: any) {
    console.error('[getUserCoinTransactionsAction] Exception:', err)
    return { success: false, error: err.message, transactions: [] }
  }
}

export async function getUserCoinRedemptionsAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'No autorizado', redemptions: [] }
  }

  try {
    const { data, error } = await supabase
      .from('coin_redemptions')
      .select('*, books(title, cover_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[getUserCoinRedemptionsAction] DB error:', error.message)
      return { success: false, error: error.message, redemptions: [] }
    }

    return { success: true, redemptions: data }
  } catch (err: any) {
    console.error('[getUserCoinRedemptionsAction] Exception:', err)
    return { success: false, error: err.message, redemptions: [] }
  }
}

export async function getUserStreakAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'No autorizado', streak: 0 }
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('reading_streak')
      .eq('user_id', user.id)
      .single()

    if (error) {
      console.error('[getUserStreakAction] DB error:', error.message)
      return { success: false, error: error.message, streak: 0 }
    }

    return { success: true, streak: profile?.reading_streak || 0 }
  } catch (err: any) {
    console.error('[getUserStreakAction] Exception:', err)
    return { success: false, error: err.message, streak: 0 }
  }
}

export async function updateStreakAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'No autorizado', streak: 0, coins_awarded: [] }
  }

  try {
    const { data, error } = await supabase
      .rpc('update_streak_and_check_milestones', { p_user_id: user.id })

    if (error) {
      console.error('[updateStreakAction] RPC error:', error.message)
      return { success: false, error: error.message, streak: 0, coins_awarded: [] }
    }

    revalidatePath('/dashboard')
    revalidatePath('/profile')

    return { success: true, streak: data.streak, coins_awarded: data.coins_awarded || [] }
  } catch (err: any) {
    console.error('[updateStreakAction] Exception:', err)
    return { success: false, error: err.message, streak: 0, coins_awarded: [] }
  }
}

export async function completeBookAndAwardCoinAction(bookId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'No autorizado' }
  }

  try {
    // 8.x.1 - ANTI-FARMING: Verificar si ya se otorgó una moneda por este libro y fuente
    const { data: existingTransaction } = await supabase
      .from('coin_transactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('book_id', bookId)
      .eq('source', 'complete_book')
      .maybeSingle()

    if (existingTransaction) {
      return { success: false, error: 'already_awarded' }
    }
    // Verificar que el usuario tenga al menos 10% de progreso
    const { data: progress } = await supabase
      .from('reading_progress')
      .select('percent_complete')
      .eq('user_id', user.id)
      .eq('book_id', bookId)
      .single()

    if (!progress || (progress.percent_complete || 0) < ANTI_ABUSE_LIMITS.min_book_progress_for_quiz * 100) {
      return { success: false, error: 'insufficient_progress' }
    }

    // Actualizar total_books_read
    await supabase
      .from('profiles')
      .update({ total_books_read: supabase.rpc('increment_counter' as any) })
      .eq('user_id', user.id)

    // Otorgar moneda de bronce
    const { data: result, error } = await supabase
      .rpc('add_coins', {
        p_user_id: user.id,
        p_coin_type: 'bronze',
        p_amount: 1,
        p_source: 'complete_book',
        p_book_id: bookId,
      })

    if (error) {
      console.error('[completeBookAndAwardCoinAction] RPC error:', error.message)
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard')
    revalidatePath('/profile')

    return { success: true, result }
  } catch (err: any) {
    console.error('[completeBookAndAwardCoinAction] Exception:', err)
    return { success: false, error: err.message }
  }
}

export async function processReviewAndAwardCoinAction(bookId: string, content: string, rating: number) {
  if (content.length < ANTI_ABUSE_LIMITS.min_review_chars_for_coin) {
    return { success: false, error: 'review_too_short', min_chars: ANTI_ABUSE_LIMITS.min_review_chars_for_coin }
  }

  if (rating < ANTI_ABUSE_LIMITS.min_review_rating_for_coin) {
    return { success: false, error: 'rating_too_low', min_rating: ANTI_ABUSE_LIMITS.min_review_rating_for_coin }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'No autorizado' }
  }

  try {
    const { data: result, error } = await supabase
      .rpc('add_coins', {
        p_user_id: user.id,
        p_coin_type: 'bronze',
        p_amount: 1,
        p_source: 'review',
        p_book_id: bookId,
      })

    if (error) {
      console.error('[processReviewAndAwardCoinAction] RPC error:', error.message)
      return { success: false, error: error.message }
    }

    if (!result.success) {
      return { success: false, error: result.error, current_count: result.current_count }
    }

    revalidatePath(`/book/${bookId}`)

    return { success: true, result }
  } catch (err: any) {
    console.error('[processReviewAndAwardCoinAction] Exception:', err)
    return { success: false, error: err.message }
  }
}

export async function getReferralLinkAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'No autorizado', link: '' }
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://bookea-nine.vercel.app'
  const referralLink = `${baseUrl}/?ref=${user.id}`

  return { success: true, link: referralLink, userId: user.id }
}

export async function getReferralCountAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'No autorizado', count: 0 }
  }

  try {
    const { data, error } = await supabase
      .from('referrals')
      .select('id')
      .eq('referrer_id', user.id)

    if (error) {
      console.error('[getReferralCountAction] DB error:', error.message)
      return { success: false, error: error.message, count: 0 }
    }

    return { success: true, count: data?.length || 0 }
  } catch (err: any) {
    console.error('[getReferralCountAction] Exception:', err)
    return { success: false, error: err.message, count: 0 }
  }
}
