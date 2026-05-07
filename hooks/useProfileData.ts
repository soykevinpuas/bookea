'use client'

import { useQuery } from '@tanstack/react-query'
import { getProfileDataAction } from '@/lib/actions/profile'
import { CoinBalance } from '@/types/coins'

export interface ProfileData {
  coins: CoinBalance
  streak: number
  referralLink: string
  referralCount: number
}

export function useProfileData(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile-data', userId],
    queryFn: async (): Promise<ProfileData> => {
      const result = await getProfileDataAction()
      return {
        coins: result.coins,
        streak: result.streak,
        referralLink: result.referralLink,
        referralCount: result.referralCount,
      }
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })
}
