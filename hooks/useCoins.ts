// 8.x - Hook React Query para el sistema de monedas de gamificación
import { useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClientClient } from '@/lib/supabase'
import {
  getUserCoinsAction,
  redeemCoinAction,
  getUserStreakAction,
  updateStreakAction,
  getReferralLinkAction,
  getReferralCountAction,
  getUserCoinTransactionsAction,
  getUserCoinRedemptionsAction,
} from '@/lib/actions/coins'
import { CoinType, CoinBalance } from '@/types/coins'

export function useCoins(userId: string | undefined) {
  const queryClient = useQueryClient()
  const supabase = useMemo(() => createClientClient(), [])
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const query = useQuery({
    queryKey: ['user-coins', userId],
    queryFn: async (): Promise<CoinBalance> => {
      if (!userId) return { bronze: 0, silver: 0, gold: 0, diamond: 0 }

      const result = await getUserCoinsAction()
      return (result.coins || { bronze: 0, silver: 0, gold: 0, diamond: 0 }) as CoinBalance
    },
    enabled: !!userId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

  const redeemMutation = useMutation({
    mutationFn: async ({ bookId, coinType }: { bookId: string; coinType: CoinType }) => {
      return redeemCoinAction(bookId, coinType)
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['user-coins', userId] })
      }
    },
  })

  // Realtime listener para cambios en monedas
  useEffect(() => {
    if (!userId) return
    if (channelRef.current) return

    const channel = supabase
      .channel(`coins-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'coins',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['user-coins', userId] })
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [userId, supabase, queryClient])

  return {
    ...query,
    redeemCoin: redeemMutation.mutate,
    isRedeeming: redeemMutation.isPending,
    updateStreak: updateStreakAction,
  }
}

export function useStreak(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-streak', userId],
    queryFn: async (): Promise<number> => {
      if (!userId) return 0
      const result = await getUserStreakAction()
      return result.streak || 0
    },
    enabled: !!userId,
    staleTime: 60_000,
  })
}

export function useReferral(userId: string | undefined) {
  const referralLinkQuery = useQuery({
    queryKey: ['user-referral-link', userId],
    queryFn: async (): Promise<string> => {
      if (!userId) return ''
      const result = await getReferralLinkAction()
      return result.link || ''
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  const referralCountQuery = useQuery({
    queryKey: ['user-referral-count', userId],
    queryFn: async (): Promise<number> => {
      if (!userId) return 0
      const result = await getReferralCountAction()
      return result.count || 0
    },
    enabled: !!userId,
    staleTime: 60_000,
  })

  return {
    link: referralLinkQuery.data || '',
    count: referralCountQuery.data || 0,
    isLoading: referralLinkQuery.isLoading || referralCountQuery.isLoading,
  }
}

export function useCoinTransactions(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-coin-transactions', userId],
    queryFn: async () => {
      if (!userId) return []
      const result = await getUserCoinTransactionsAction()
      return result.transactions || []
    },
    enabled: !!userId,
    staleTime: 30_000,
  })
}

export function useCoinRedemptions(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-coin-redemptions', userId],
    queryFn: async () => {
      if (!userId) return []
      const result = await getUserCoinRedemptionsAction()
      return result.redemptions || []
    },
    enabled: !!userId,
    staleTime: 30_000,
  })
}
