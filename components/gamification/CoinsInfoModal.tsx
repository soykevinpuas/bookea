"use client";

import { X, Circle, Medal, Award, Gem, Sparkles } from "lucide-react";
import { COIN_DAYS, COIN_LABELS, COIN_TAILWIND_CLASSES, COIN_BG_CLASSES, ANTI_ABUSE_LIMITS } from "@/types/coins";

interface CoinsInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COIN_INFO = [
  {
    type: 'bronze' as const,
    icon: Circle,
    earning: ['Completar un libro + cuestionario', 'Reseña (≥50 chars, ≥3 estrellas)', 'Rachas de 3 y 5 días'],
    limit: `Máx ${ANTI_ABUSE_LIMITS.max_review_coins_per_month}/mes por reseñas`,
  },
  {
    type: 'silver' as const,
    icon: Medal,
    earning: ['Referir a un amigo que se registre'],
    limit: `Máx ${ANTI_ABUSE_LIMITS.max_referral_coins_per_month}/mes por referidos`,
  },
  {
    type: 'gold' as const,
    icon: Award,
    earning: ['Racha de 10 días de lectura'],
    limit: 'Una sola vez',
  },
  {
    type: 'diamond' as const,
    icon: Gem,
    earning: ['Racha de 30 días de lectura'],
    limit: 'Una sola vez',
  },
];

export default function CoinsInfoModal({ isOpen, onClose }: CoinsInfoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white dark:bg-[#1a1a1a] flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-white/10">
          <h2 className="text-lg font-bold">Monedas Bookea</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            Las monedas te permiten <strong className="text-gray-900 dark:text-white">desbloquear acceso temporal</strong> a libros sin suscripción. Cada tipo te da una cantidad distinta de días de acceso.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {COIN_INFO.map(({ type, icon: Icon, earning, limit }) => (
              <div
                key={type}
                className={`rounded-xl border p-4 space-y-2 ${COIN_BG_CLASSES[type]} ${COIN_TAILWIND_CLASSES[type]}`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5" />
                  <span className="font-bold text-sm">{COIN_LABELS[type]}</span>
                  <span className="text-xs opacity-70 ml-auto">{COIN_DAYS[type]} días</span>
                </div>
                <ul className="space-y-1">
                  {earning.map((text, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs leading-relaxed">
                      <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] opacity-60">{limit}</p>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300 leading-relaxed space-y-1">
            <p>
              <strong>Canjear:</strong> En la página del libro, usa el botón <strong>&quot;Desbloquear con monedas&quot;</strong>.
            </p>
            <p>
              Límite: <strong>{ANTI_ABUSE_LIMITS.max_total_redemptions_per_month} canjes por mes</strong>, máximo 1 por libro.
            </p>
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
