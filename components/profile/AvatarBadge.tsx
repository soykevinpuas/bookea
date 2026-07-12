"use client";

import { AnimalEngine } from "@/components/avatars/AnimalEngine";
import { parseAvatarConfig } from "@/lib/avatars-v2";

type AvatarBadgeProps = {
  avatarUrl?: string | null;
  fallbackText?: string | null;
  premium?: boolean;
  className?: string;
  fallbackClassName?: string;
  badgeClassName?: string;
  size?: number | string;
};

// Avatar reutilizable para evitar que perfil y menu rendericen estados distintos.
export function AvatarBadge({
  avatarUrl,
  fallbackText,
  premium = false,
  className = "w-8 h-8",
  fallbackClassName = "bg-white dark:bg-[#111] text-gray-400",
  badgeClassName = "border-white dark:border-black",
  size = "100%",
}: AvatarBadgeProps) {
  const initial = (fallbackText || "U").trim().charAt(0).toUpperCase() || "U";
  const hasAvatar = !!avatarUrl && avatarUrl.startsWith("v2:");

  return (
    <div className={`rounded-full border border-gray-200 dark:border-white/10 overflow-hidden flex items-center justify-center relative ${className}`}>
      {hasAvatar ? (
        <AnimalEngine config={parseAvatarConfig(avatarUrl)} size={size} />
      ) : (
        <span className={`w-full h-full flex items-center justify-center text-sm font-bold uppercase ${fallbackClassName}`}>
          {initial}
        </span>
      )}

      {premium && (
        <div className={`absolute top-0 right-0 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 ${badgeClassName}`} />
      )}
    </div>
  );
}
