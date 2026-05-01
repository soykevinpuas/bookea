// 6.x - Componente de balance de monedas de gamificación
import { CoinBalance } from '@/types/coins'
import { COIN_TAILWIND_CLASSES, COIN_BG_CLASSES, COIN_LABELS } from '@/types/coins'
import { Circle, Medal, Award, Gem } from 'lucide-react'

interface CoinBalanceProps {
  balance: CoinBalance
  variant?: 'full' | 'compact'
}

const ICON_MAP = {
  bronze: Circle,
  silver: Medal,
  gold: Award,
  diamond: Gem,
}

export function CoinBalanceDisplay({ balance, variant = 'full' }: CoinBalanceProps) {
  const coins: { type: keyof CoinBalance; label: string }[] = [
    { type: 'bronze', label: COIN_LABELS.bronze },
    { type: 'silver', label: COIN_LABELS.silver },
    { type: 'gold', label: COIN_LABELS.gold },
    { type: 'diamond', label: COIN_LABELS.diamond },
  ]

  if (variant === 'compact') {
    const total = balance.bronze + balance.silver + balance.gold + balance.diamond
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
        <Circle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        <span>{total}</span>
      </span>
    )
  }

  return (
    <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 shadow-lg p-3 space-y-1.5 min-w-[200px]">
      {coins.map(({ type }) => {
        const count = balance[type]
        const colorClass = COIN_TAILWIND_CLASSES[type]
        const bgClass = COIN_BG_CLASSES[type]
        const Icon = ICON_MAP[type]

        return (
          <div
            key={type}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${bgClass} ${colorClass}`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-xs font-semibold flex-1">{COIN_LABELS[type]}</span>
            <span className="text-sm font-bold">{count}</span>
          </div>
        )
      })}
    </div>
  )
}
