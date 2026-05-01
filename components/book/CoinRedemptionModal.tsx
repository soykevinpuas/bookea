// 6.x - Modal de canje de monedas por acceso a libro
'use client'

import { useState } from 'react'
import { X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { CoinBalance, COIN_DAYS, COIN_COLORS, COIN_LABELS, ANTI_ABUSE_LIMITS } from '@/types/coins'
import { Circle, Medal, Award, Gem } from 'lucide-react'

interface CoinRedemptionModalProps {
  isOpen: boolean
  onClose: () => void
  balance: CoinBalance
  onRedeem: (coinType: string) => void
  bookTitle: string
  alreadyHasAccess: boolean
}

const COIN_LUCIDE_ICONS = {
  bronze: Circle,
  silver: Medal,
  gold: Award,
  diamond: Gem,
}

const COIN_OPTIONS = [
  { type: 'bronze' as const, days: COIN_DAYS.bronze, color: COIN_COLORS.bronze },
  { type: 'silver' as const, days: COIN_DAYS.silver, color: COIN_COLORS.silver },
  { type: 'gold' as const, days: COIN_DAYS.gold, color: COIN_COLORS.gold },
  { type: 'diamond' as const, days: COIN_DAYS.diamond, color: COIN_COLORS.diamond },
]

export function CoinRedemptionModal({
  isOpen,
  onClose,
  balance,
  onRedeem,
  bookTitle,
  alreadyHasAccess,
}: CoinRedemptionModalProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  if (!isOpen) return null

  const handleRedeem = async () => {
    if (!selectedType) return
    setIsProcessing(true)

    try {
      onRedeem(selectedType)
      setResult({ success: true, message: `¡${bookTitle} desbloqueado por ${COIN_DAYS[selectedType as keyof typeof COIN_DAYS]} días!` })
    } catch {
      setResult({ success: false, message: 'Error al canjear. Intenta de nuevo.' })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClose = () => {
    onClose()
    setSelectedType(null)
    setResult(null)
    setIsProcessing(false)
  }

  const maxRedemptionsReached = false // TODO: check from server

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-[#151515] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Desbloquear libro</h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {result ? (
            <div className={`flex items-start gap-3 p-4 rounded-xl ${result.success ? 'bg-green-50 dark:bg-green-500/10' : 'bg-red-50 dark:bg-red-500/10'}`}>
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`text-sm font-semibold ${result.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                  {result.message}
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Elige una moneda para desbloquear <span className="font-semibold text-gray-900 dark:text-white">"{bookTitle}"</span>
              </p>

              {alreadyHasAccess && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Ya tienes acceso a este libro.
                  </p>
                </div>
              )}

              {maxRedemptionsReached && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-300">
                    Has alcanzado el límite mensual de {ANTI_ABUSE_LIMITS.max_total_redemptions_per_month} canjes.
                  </p>
                </div>
              )}

              {/* Coin options */}
              <div className="space-y-2">
                {COIN_OPTIONS.map(({ type, days, color }) => {
                  const hasCoins = balance[type] > 0
                  const isSelected = selectedType === type
                  const isDisabled = !hasCoins || alreadyHasAccess || maxRedemptionsReached

                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      disabled={isDisabled}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-gray-900 dark:border-white bg-gray-100 dark:bg-white/5'
                          : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                      } ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center gap-3">
                        {(() => {
                          const Icon = COIN_LUCIDE_ICONS[type]
                          return <Icon className="w-6 h-6" style={{ color }} />
                        })()}
                        <div className="text-left">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{COIN_LABELS[type]}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{days} días de acceso</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-gray-900 dark:bg-white flex items-center justify-center">
                            <CheckCircle className="w-3.5 h-3.5 text-white dark:text-gray-900" />
                          </div>
                        )}
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                          {balance[type]} disponibles
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!result && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleRedeem}
              disabled={!selectedType || isProcessing || alreadyHasAccess || maxRedemptionsReached}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Canjeando...
                </>
              ) : (
                'Desbloquear'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
