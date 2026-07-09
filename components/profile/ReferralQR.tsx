// Componente de QR de referido para compartir Bookea
'use client'

import AppImage from "@/components/ui/AppImage";
import { useState } from 'react'
import { Copy, Check, Share2 } from 'lucide-react'

interface ReferralQRProps {
  referralLink: string
  referralCount: number
}

export function ReferralQR({ referralLink, referralCount }: ReferralQRProps) {
  const [copied, setCopied] = useState(false)

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=0a0a0a&bgcolor=f5f5f5&data=${encodeURIComponent(referralLink)}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = referralLink
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Bookea — Tu próxima lectura te espera',
          text: '¡Descubre Bookea! Miles de libros al alcance de tu mano.',
          url: referralLink,
        })
      } catch {
        // User cancelled or share failed
      }
    } else {
      handleCopy()
    }
  }

  return (
    <div className="bg-white/5 dark:bg-white/[0.02] rounded-2xl border border-white/10 p-6 space-y-4">
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Invita a un amigo</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Comparte tu enlace y gana <span className="text-gray-400 font-semibold">monedas de plata</span> por cada amigo que se registre.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
        {/* QR Code */}
        <div className="flex-shrink-0">
          <div className="w-[200px] h-[200px] bg-white rounded-xl p-2 shadow-lg">
            <AppImage
              src={qrUrl}
              alt="QR de referido"
              className="w-full h-full object-contain"
              loading="lazy"
            />
          </div>
        </div>

        {/* Link + Actions */}
        <div className="flex-1 space-y-3">
          <div className="bg-black/5 dark:bg-white/5 rounded-lg px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-300 break-all">
            {referralLink}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 dark:bg-white hover:opacity-90 text-white dark:text-black text-xs font-bold transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? '¡Copiado!' : 'Copiar enlace'}
            </button>

            {typeof window !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white text-xs font-bold transition-all"
              >
                <Share2 className="w-3.5 h-3.5" />
                Compartir
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Referral count */}
      {referralCount > 0 && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          Has referido a <span className="font-bold text-gray-900 dark:text-white">{referralCount}</span> {referralCount === 1 ? 'amigo' : 'amigos'}
        </div>
      )}
    </div>
  )
}
