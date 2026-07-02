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

// Hook consolidado para evitar varias server actions en la pagina de perfil.
export function useProfileData(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile-data', userId],
    // La server action ya empaqueta monedas, racha y referidos para una sola ida al servidor.
    queryFn: async (): Promise<ProfileData> => {
      const result = await getProfileDataAction()
      return {
        coins: result.coins,
        streak: result.streak,
        referralLink: result.referralLink,
        referralCount: result.referralCount,
      }
    },
    // No consulta hasta que auth resuelve el usuario actual.
    enabled: !!userId,
    staleTime: 0,
  })
}
