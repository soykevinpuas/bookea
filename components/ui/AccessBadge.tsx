"use client";

import type { BookAccessType } from "@/types/book";

interface AccessBadgeProps {
  accessType: BookAccessType | null;
  daysRemaining?: number | null;
}

export default function AccessBadge({ accessType, daysRemaining }: AccessBadgeProps) {
  if (!accessType) return null;

  const config: Record<BookAccessType, { label: string; class: string }> = {
    permanent: {
      label: 'Compra Permanente',
      class: 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400',
    },
    subscription: {
      label: daysRemaining && daysRemaining <= 7 ? `Suscripción (${daysRemaining}días)` : 'Suscripción Activa',
      class: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
    },
    gift: {
      label: `Canje (${daysRemaining ?? '?'} días)`,
      class: 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400',
    },
    coin_redemption: {
      label: `Canje (${daysRemaining ?? '?'} días)`,
      class: 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400',
    },
  };

  const { label, class: className } = config[accessType];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${className}`}>
      {label}
    </span>
  );
}
