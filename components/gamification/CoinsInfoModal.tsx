"use client";

import { X, Circle, Medal, Award, Gem, Trophy, MessageSquare, BookOpen, Share2, Sparkles, HelpCircle } from "lucide-react";
import { COIN_DAYS, COIN_LABELS, COIN_TAILWIND_CLASSES, COIN_BG_CLASSES, ANTI_ABUSE_LIMITS, SOURCE_LABELS } from "@/types/coins";

interface CoinsInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COIN_INFO = [
  {
    type: 'bronze' as const,
    icon: Circle,
    earning: ['Completar un libro (cuestionario)', 'Escribir una reseña (mín. 50 caracteres, 3 estrellas)', 'Rachas de 3 y 5 días de lectura'],
    limit: `Máx ${ANTI_ABUSE_LIMITS.max_review_coins_per_month} por reseñas al mes`,
  },
  {
    type: 'silver' as const,
    icon: Medal,
    earning: ['Referir a un amigo que se registre en Bookea'],
    limit: `Máx ${ANTI_ABUSE_LIMITS.max_referral_coins_per_month} por referidos al mes`,
  },
  {
    type: 'gold' as const,
    icon: Award,
    earning: ['Alcanzar una racha de 10 días de lectura'],
    limit: 'Una sola vez al alcanzar el hito',
  },
  {
    type: 'diamond' as const,
    icon: Gem,
    earning: ['Alcanzar una racha de 30 días de lectura'],
    limit: 'Una sola vez al alcanzar el hito',
  },
];

export default function CoinsInfoModal({ isOpen, onClose }: CoinsInfoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white dark:bg-[#1a1a1a] flex items-center justify-between p-5 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold">¿Cómo funcionan las monedas?</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Las monedas te permiten <strong className="text-gray-900 dark:text-white">desbloquear acceso temporal</strong> a libros sin necesidad de suscripción. Cada moneda te da una cantidad distinta de días de acceso.
          </p>

          <div className="space-y-3">
            {COIN_INFO.map(({ type, icon: Icon, earning, limit }) => (
              <div
                key={type}
                className={`rounded-xl border p-4 space-y-2 ${COIN_BG_CLASSES[type]} ${COIN_TAILWIND_CLASSES[type]}`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5" />
                  <span className="font-bold text-sm">{COIN_LABELS[type]}</span>
                  <span className="text-xs opacity-70 ml-auto">— {COIN_DAYS[type]} días de acceso</span>
                </div>
                <ul className="space-y-1">
                  {earning.map((text, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] opacity-60 mt-1">{limit}</p>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-bold text-blue-800 dark:text-blue-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              ¿Cómo canjearlas?
            </h3>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              En la página de cualquier libro, si tienes monedas disponibles verás un botón <strong>"Desbloquear con monedas"</strong>.
              Puedes elegir qué tipo de moneda usar — entre más valiosa, más días de acceso obtienes.
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              Límite de <strong>{ANTI_ABUSE_LIMITS.max_total_redemptions_per_month} canjes por mes</strong> y máximo 1 canje por libro.
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              Resumen de fuentes
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                { icon: BookOpen, color: 'text-green-500', label: SOURCE_LABELS.complete_book },
                { icon: MessageSquare, color: 'text-blue-500', label: SOURCE_LABELS.review },
                { icon: Trophy, color: 'text-orange-500', label: SOURCE_LABELS.streak_3 },
                { icon: Trophy, color: 'text-orange-500', label: SOURCE_LABELS.streak_10 },
                { icon: Share2, color: 'text-purple-500', label: SOURCE_LABELS.referral },
              ].map(({ icon: Icon, color, label }) => (
                <div key={label} className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-black/20">
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
