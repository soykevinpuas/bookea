import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import { queryKeys } from '@/lib/query-keys'

export function useCoins(userId: string | undefined) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.coins.all(userId || ''),
    queryFn: async (): Promise<CoinBalance> => {
      if (!userId) return { bronze: 0, silver: 0, gold: 0, diamond: 0 }

      const result = await getUserCoinsAction()
      return (result.coins || { bronze: 0, silver: 0, gold: 0, diamond: 0 }) as CoinBalance
    },
    enabled: !!userId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const redeemMutation = useMutation({
    mutationFn: async ({ bookId, coinType }: { bookId: string; coinType: CoinType }) => {
      return redeemCoinAction(bookId, coinType)
    },
    onMutate: async ({ coinType }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.coins.all(userId || '') })
      const previous = queryClient.getQueryData<CoinBalance>(queryKeys.coins.all(userId || ''))
      queryClient.setQueryData(queryKeys.coins.all(userId || ''), (old: CoinBalance | undefined) => {
        if (!old) return old
        return { ...old, [coinType]: Math.max(0, (old[coinType] || 0) - 1) }
      })
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.coins.all(userId || ''), context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.coins.all(userId || '') })
    },
  })

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
    staleTime: 0,
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
    staleTime: 30 * 60 * 1000,
  })

  const referralCountQuery = useQuery({
    queryKey: ['user-referral-count', userId],
    queryFn: async (): Promise<number> => {
      if (!userId) return 0
      const result = await getReferralCountAction()
      return result.count || 0
    },
    enabled: !!userId,
    staleTime: 0,
  })

  return {
    link: referralLinkQuery.data || '',
    count: referralCountQuery.data || 0,
    isLoading: referralLinkQuery.isLoading || referralCountQuery.isLoading,
  }
}

export function useCoinTransactions(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.coins.transactions(userId || ''),
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
    queryKey: queryKeys.coins.redemptions(userId || ''),
    queryFn: async () => {
      if (!userId) return []
      const result = await getUserCoinRedemptionsAction()
      return result.redemptions || []
    },
    enabled: !!userId,
    staleTime: 30_000,
  })
}
