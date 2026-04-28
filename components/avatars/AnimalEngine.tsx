"use client";

import React from "react";

/**
 * 6.8 - AnimalEngine: Motor de renderizado (DiceBear + SVG propio para Animal)
 * 4 estilos: Persona, Robot, Animal, Artístico
 * Paleta de colores clara/oscura
 */

export type AvatarStyleType = "avataaars" | "bottts" | "animal" | "lorelei";

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
 * 6.8.2 - Genera URL de DiceBear SVG (solo para avataaars, bottts, lorelei)
 */
function getDiceBearUrl(style: string, seed: string, backgroundColor: string): string {
  const bgColor = formatColorForDiceBear(backgroundColor);
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&backgroundColor=${bgColor}&radius=50`;
}

/**
 * 6.8.3 - SVG para el estilo "Animal" (Zorro artístico)
 */
const AnimalSvg = ({ color, size }: { color: string; size: number | string }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: size, height: size }}>
    {/* Fondo circular con color */}
    <circle cx="50" cy="50" r="48" fill={color} fillOpacity="0.2" />
    {/* Cuerpo del zorro */}
    <ellipse cx="50" cy="60" rx="25" ry="28" fill={color} />
    {/* Cabeza */}
    <circle cx="50" cy="38" r="20" fill={color} />
    {/* Orejas triangulares */}
    <path d="M35 28 L30 10 L45 25 Z" fill={color} />
    <path d="M65 28 L70 10 L55 25 Z" fill={color} />
    {/* Ojos blancos */}
    <circle cx="43" cy="35" r="4" fill="white" />
    <circle cx="57" cy="35" r="4" fill="white" />
    {/* Pupilas oscuras */}
    <circle cx="43" cy="35" r="2" fill="#333" />
    <circle cx="57" cy="35" r="2" fill="#333" />
    {/* Hocico */}
    <ellipse cx="50" cy="42" rx="5" ry="3" fill="#ffd5dc" />
    {/* Boca sonriente */}
    <path d="M45 47 Q50 52 55 47" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" />
    {/* Cola estilizada */}
    <path d="M75 55 Q85 45 80 65 Q75 70 72 60 Z" fill={color} opacity="0.8" />
  </svg>
);

/**
 * 6.8.4 - Genera una semilla aleatoria
 */
export function generateRandomSeed(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * 6.8.5 - Componente principal AnimalEngine
 */
export function AnimalEngine(props: AnimalAvatarProps | AnimalAvatarConfigProps) {
  // Support both modes: direct props or config object
  const { type, color, seed = generateRandomSeed(), size = 48, className = "" } = 'config' in props 
    ? { type: props.config.type, color: props.config.color, seed: props.config.seed, size: props.size, className: props.className }
    : props;

  // Para estilo "animal", usar SVG propio
  if (type === "animal") {
    return (
      <div 
        className={`relative flex items-center justify-center overflow-hidden rounded-full ${className}`}
        style={{ width: size, height: size }}
      >
        <AnimalSvg color={color} size={size} />
      </div>
    );
  }

  // Para DiceBear (avataaars, bottts, lorelei)
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
