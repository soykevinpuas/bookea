// 6.x - Componente de balance de monedas de gamificación
import { CoinBalance } from '@/types/coins'
import { COIN_ICONS, COIN_TAILWIND_CLASSES, COIN_BG_CLASSES, COIN_LABELS } from '@/types/coins'

interface CoinBalanceProps {
  balance: CoinBalance
  variant?: 'full' | 'compact'
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
        <span>🪙</span>
        <span>{total}</span>
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {coins.map(({ type, label }) => {
        const count = balance[type]
        const colorClass = COIN_TAILWIND_CLASSES[type]
        const bgClass = COIN_BG_CLASSES[type]

        return (
          <div
            key={type}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${bgClass} ${colorClass}`}
            title={`${label}: ${count}`}
          >
            <span className="text-sm">{COIN_ICONS[type]}</span>
            <span>{count}</span>
          </div>
        )
      })}
    </div>
  )
}
