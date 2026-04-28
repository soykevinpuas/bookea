"use client";

import React from "react";

/**
 * 6.8 - AnimalEngine: Motor de renderizado usando DiceBear API
 * Genera avatares SVG dinámicos con estilos profesionales
 * https://api.dicebear.com/7.x/{style}/svg?seed={seed}&backgroundColor={color}
 */

export type DiceBearStyle = "avataaars" | "bottts" | "botttsNeutral" | "identicon" | "shapes" | "lorelei";

export interface AvatarConfig {
  type: DiceBearStyle;
  color: string;
}

interface AnimalAvatarProps {
  type: DiceBearStyle;
  color: string;
  size?: number | string;
  className?: string;
}

interface AnimalAvatarConfigProps {
  config: AvatarConfig;
  size?: number | string;
  className?: string;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  type: "avataaars",
  color: "b6e3f4",
};

// Colores de fondo para DiceBear (sin #)
export const AVATAR_COLORS = [
  "b6e3f4", "ffd5dc", "ffdfbf", "baffc9", "e0bbf3",
  "ffc6c6", "c6ffdd", "d4c6ff", "fff5c6", "c6e1ff",
  "333333", "666666", "cccccc", "8b4513", "4a0e0e"
];

/**
 * 6.8.1 - Convierte color hex a formato DiceBear (sin #)
 */
function formatColorForDiceBear(color: string): string {
  return color.replace('#', '');
}

/**
 * 6.8.2 - Genera URL de DiceBear SVG
 */
function getDiceBearUrl(style: DiceBearStyle, seed: string, backgroundColor: string): string {
  const bgColor = formatColorForDiceBear(backgroundColor);
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&backgroundColor=${bgColor}&radius=50`;
}

export function AnimalEngine(props: AnimalAvatarProps | AnimalAvatarConfigProps) {
  // Support both modes: direct props or config object
  const { type, color, size = 48, className = "" } = 'config' in props 
    ? { type: props.config.type, color: props.config.color, size: props.size, className: props.className }
    : props;

  const svgUrl = getDiceBearUrl(type, type, color);

  return (
    <div 
      className={`relative flex items-center justify-center overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size }}
    >
      {/* 6.8.3 - Renderizado de SVG via img tag para evitar CORS */}
      <img 
        src={svgUrl}
        alt="Avatar"
        className="w-full h-full rounded-full"
        style={{ width: size, height: size }}
        loading="lazy"
      />
    </div>
  );
}
