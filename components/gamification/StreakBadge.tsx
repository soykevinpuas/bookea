// 6.x - Badge de racha de lectura
'use client'

import { Flame } from 'lucide-react'

interface StreakBadgeProps {
  streak: number
  variant?: 'full' | 'compact'
}

export function StreakBadge({ streak, variant = 'full' }: StreakBadgeProps) {
  if (streak <= 0) return null

  const getColorClasses = () => {
    if (streak >= 30) return 'text-orange-500 dark:text-orange-400'
    if (streak >= 10) return 'text-amber-500 dark:text-amber-400'
    if (streak >= 5) return 'text-yellow-500 dark:text-yellow-400'
    return 'text-orange-400 dark:text-orange-300'
  }

  const getBgClasses = () => {
    if (streak >= 30) return 'bg-orange-500/10 border-orange-500/20'
    if (streak >= 10) return 'bg-amber-500/10 border-amber-500/20'
    if (streak >= 5) return 'bg-yellow-500/10 border-yellow-500/20'
    return 'bg-orange-400/10 border-orange-400/20'
  }

  const getFireEmoji = () => {
    if (streak >= 30) return '🔥'
    if (streak >= 10) return '🔥'
    if (streak >= 5) return '🔥'
    return '🔥'
  }

  if (variant === 'compact') {
    return (
      <span className={`flex items-center gap-0.5 text-xs font-bold ${getColorClasses()}`}>
        <Flame className="w-3.5 h-3.5" />
        <span>{streak}</span>
      </span>
    )
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${getBgClasses()}`}>
      <Flame className={`w-4 h-4 ${getColorClasses()}`} />
      <span className={`text-sm font-bold ${getColorClasses()}`}>
        {streak} {streak === 1 ? 'día' : 'días'}
      </span>
    </div>
  )
}
