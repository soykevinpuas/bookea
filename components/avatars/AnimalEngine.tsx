"use client";

import React from "react";

/**
 * 6.8 - AnimalEngine: Motor de renderizado usando DiceBear API
 * 3 estilos: Persona, Robot, Artístico
 * Paleta de colores clara/oscura
 */

export type AvatarStyleType = "avataaars" | "bottts" | "lorelei";

export interface AvatarConfig {
  type: AvatarStyleType;
  color: string;
  seed?: string;
}

interface AnimalAvatarProps {
  type: AvatarStyleType;
  color: string;
  seed?: string;
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
  seed: "",
};

// Colores de fondo para DiceBear (sin #) - Claros y Oscuros
export const AVATAR_COLORS = [
  // Claros
  "b6e3f4", // Azul claro
  "ffd5dc", // Rosa claro
  "ffdfbf", // Durazno
  "baffc9", // Verde menta
  "e0bbf3", // Lila
  "ffc6c6", // Coral
  "c6ffdd", // Verde lima
  "fff5c6", // Amarillo suave
  // Oscuros
  "333333", // Gris muy oscuro
  "666666", // Gris oscuro
  "8b4513", // Marrón
  "4a0e0e", // Vino
  "1a1a2e", // Azul marino
  "2d3436", // Gris carbón
  "6c5ce7", // Púrpura oscuro
  "e17055", // Naranja quemado
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
function getDiceBearUrl(style: string, seed: string, backgroundColor: string): string {
  const bgColor = formatColorForDiceBear(backgroundColor);
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&backgroundColor=${bgColor}&radius=50`;
}

/**
 * 6.8.3 - Genera una semilla aleatoria
 */
export function generateRandomSeed(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * 6.8.4 - Componente principal AnimalEngine
 */
export function AnimalEngine(props: AnimalAvatarProps | AnimalAvatarConfigProps) {
  // Support both modes: direct props or config object
  const { type, color, seed = "default", size = 48, className = "" } = 'config' in props 
    ? { type: props.config.type, color: props.config.color, seed: props.config.seed, size: props.size, className: props.className }
    : props;

  const url = getDiceBearUrl(type, seed, color);

  return (
    <div 
      className={`relative flex items-center justify-center overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size }}
    >
      <img 
        src={url}
        alt="Avatar"
        className="w-full h-full rounded-full"
        style={{ width: size, height: size }}
        loading="lazy"
      />
    </div>
  );
}
