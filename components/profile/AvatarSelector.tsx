"use client";

import { motion } from "framer-motion";
import { ANIMAL_AVATARS, getAvatarStyle } from "@/lib/avatars";
import { Check, Loader2 } from "lucide-react";

/**
 * 6.4 - AvatarSelector: Componente premium para la selección de identidad animal
 * Utiliza el sprite sheet centralizado para optimizar la carga.
 */

interface AvatarSelectorProps {
  currentAvatarId?: string;
  onSelect: (avatarId: string) => void;
  isUpdating?: boolean;
}

export default function AvatarSelector({ currentAvatarId, onSelect, isUpdating }: AvatarSelectorProps) {
  // 6.4.1 - Extraigo el ID limpio si viene con el prefijo 'avatar:'
  const selectedId = currentAvatarId?.startsWith("avatar:") 
    ? currentAvatarId.split(":")[1] 
    : currentAvatarId;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4 sm:gap-6">
        {ANIMAL_AVATARS.map((avatar) => {
          const isSelected = selectedId === avatar.id;
          
          // 6.4.2 - Cálculo de posición para el sprite sheet (3x3)
          // Usamos porcentajes para que sea responsivo
          const backgroundPosition = `${(avatar.x / 2) * 100}% ${(avatar.y / 2) * 100}%`;

          return (
            <motion.button
              key={avatar.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(avatar.id)}
              disabled={isUpdating}
              className={`relative aspect-square rounded-2xl border-2 transition-all overflow-hidden ${
                isSelected 
                  ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20" 
                  : "border-gray-100 dark:border-white/10 hover:border-blue-400 dark:hover:border-blue-400/50 bg-white dark:bg-white/5"
              }`}
            >
              {/* 6.4.3 - Renderizado del avatar vía Sprite Clipping */}
              <div 
                className="w-full h-full"
                style={{
                  ...getAvatarStyle(`avatar:${avatar.id}`),
                  imageRendering: "auto",
                }}
              />

              {/* Indicador de selección */}
              {isSelected && (
                <div className="absolute top-2 right-2 bg-blue-500 text-white p-1 rounded-full shadow-sm">
                  {isUpdating ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                </div>
              )}
              
              {/* Overlay de carga si se está actualizando este específico */}
              {isUpdating && isSelected && (
                <div className="absolute inset-0 bg-white/20 dark:bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
                   <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              )}

              {/* Label (Opcional, escondido visualmente pero accesible) */}
              <span className="sr-only">{avatar.name}</span>
            </motion.button>
          );
        })}
      </div>
      
      <p className="text-center text-xs text-gray-500 dark:text-gray-400 font-medium">
        Elige tu identidad animal para la comunidad Bookea
      </p>
    </div>
  );
}
