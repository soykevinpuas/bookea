'use server'

import { createClient } from '@/lib/server'
import { CoinBalance } from '@/types/coins'

export async function getProfileDataAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      success: false,
      coins: { bronze: 0, silver: 0, gold: 0, diamond: 0 } as CoinBalance,
      streak: 0,
      referralLink: '',
      referralCount: 0,
    }
  }

  const [coinsResult, streakResult, referralCountResult] = await Promise.all([
    supabase.rpc('get_user_coins', { p_user_id: user.id }),
    supabase.from('profiles').select('reading_streak').eq('user_id', user.id).single(),
    supabase.from('referrals').select('id', { count: 'exact', head: true }).eq('referrer_id', user.id),
  ])

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://bookea-nine.vercel.app'

  return {
    success: true,
    coins: (coinsResult.data || { bronze: 0, silver: 0, gold: 0, diamond: 0 }) as CoinBalance,
    streak: streakResult.data?.reading_streak || 0,
    referralLink: `${baseUrl}/?ref=${user.id}`,
    referralCount: referralCountResult.count || 0,
  }
}
