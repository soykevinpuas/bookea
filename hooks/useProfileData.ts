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

function readCachedProfileData(cacheKey: string): ProfileData | undefined {
  if (typeof window === 'undefined') return undefined

  try {
    const cached = localStorage.getItem(cacheKey)
    return cached ? JSON.parse(cached) as ProfileData : undefined
  } catch {
    return undefined
  }
}

// Hook consolidado para evitar varias server actions en la pagina de perfil.
export function useProfileData(userId: string | undefined) {
  const cacheKey = `bookea-profile-data-${userId || 'anon'}`

  return useQuery({
    queryKey: ['profile-data', userId],
    // La server action ya empaqueta monedas, racha y referidos para una sola ida al servidor.
    queryFn: async (): Promise<ProfileData> => {
      const result = await getProfileDataAction()
      const data = {
        coins: result.coins,
        streak: result.streak,
        referralLink: result.referralLink,
        referralCount: result.referralCount,
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem(cacheKey, JSON.stringify(data))
      }
      return data
    },
    // No consulta hasta que auth resuelve el usuario actual.
    enabled: !!userId,
    initialData: () => readCachedProfileData(cacheKey),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })
}
