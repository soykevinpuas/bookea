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
 * 6.8.3 - SVGs para el estilo "Animal" (múltiples animales según seed)
 */
const AnimalSvgs = {
  dog: ({ color, size }: { color: string; size: number | string }) => (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: size, height: size }}>
      {/* Fondo circular con el color seleccionado */}
      <circle cx="50" cy="50" r="48" fill={color} />
      {/* Perro en blanco para contrastar */}
      <path d="M30 40C30 30 40 20 50 20C60 20 70 30 70 40V70H30V40Z" fill="white" fillOpacity="0.9" />
      <path d="M25 35C25 25 30 20 35 20V45C35 45 25 45 25 35Z" fill="white" fillOpacity="0.7" />
      <path d="M75 35C75 25 70 20 65 20V45C65 45 75 45 75 35Z" fill="white" fillOpacity="0.7" />
      <circle cx="40" cy="45" r="3" fill={color} />
      <circle cx="60" cy="45" r="3" fill={color} />
      <path d="M45 55C45 55 50 60 55 55" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  cat: ({ color, size }: { color: string; size: number | string }) => (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: size, height: size }}>
      {/* Fondo circular con el color seleccionado */}
      <circle cx="50" cy="50" r="48" fill={color} />
      {/* Gato en blanco para contrastar */}
      <path d="M30 45C30 35 40 25 50 25C60 25 70 35 70 45V75H30V45Z" fill="white" fillOpacity="0.9" />
      <path d="M30 30L40 45H30V30Z" fill="white" fillOpacity="0.7" />
      <path d="M70 30L60 45H70V30Z" fill="white" fillOpacity="0.7" />
      <circle cx="42" cy="48" r="3" fill={color} />
      <circle cx="58" cy="48" r="3" fill={color} />
      <path d="M40 60C40 60 50 65 60 60" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  rabbit: ({ color, size }: { color: string; size: number | string }) => (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: size, height: size }}>
      {/* Fondo circular con el color seleccionado */}
      <circle cx="50" cy="50" r="48" fill={color} />
      {/* Conejo en blanco para contrastar */}
      <path d="M35 50C35 40 42 33 50 33C58 33 65 40 65 50V75H35V50Z" fill="white" fillOpacity="0.9" />
      <path d="M40 10C40 10 35 25 40 40H48V10H40Z" fill="white" fillOpacity="0.7" />
      <path d="M60 10C60 10 65 25 60 40H52V10H60Z" fill="white" fillOpacity="0.7" />
      <circle cx="44" cy="52" r="2.5" fill={color} />
      <circle cx="56" cy="52" r="2.5" fill={color} />
      <circle cx="50" cy="58" r="1.5" fill="white" />
    </svg>
  ),
  panda: ({ color, size }: { color: string; size: number | string }) => (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: size, height: size }}>
      {/* Fondo circular con el color seleccionado */}
      <circle cx="50" cy="50" r="48" fill={color} />
      {/* Panda en blanco para contrastar */}
      <circle cx="50" cy="55" r="25" fill="white" fillOpacity="0.9" />
      <circle cx="35" cy="35" r="10" fill="white" fillOpacity="0.7" />
      <circle cx="65" cy="35" r="10" fill="white" fillOpacity="0.7" />
      <circle cx="42" cy="52" r="5" fill={color} />
      <circle cx="58" cy="52" r="5" fill={color} />
      <circle cx="42" cy="52" r="2" fill="white" />
      <circle cx="58" cy="52" r="2" fill="white" />
    </svg>
  ),
  fox: ({ color, size }: { color: string; size: number | string }) => (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: size, height: size }}>
      <circle cx="50" cy="50" r="48" fill={color} fillOpacity="0.2" />
      <ellipse cx="50" cy="60" rx="25" ry="28" fill={color} />
      <circle cx="50" cy="38" r="20" fill={color} />
      <path d="M35 28 L30 10 L45 25 Z" fill={color} />
      <path d="M65 28 L70 10 L55 25 Z" fill={color} />
      <circle cx="43" cy="35" r="4" fill="white" />
      <circle cx="57" cy="35" r="4" fill="white" />
      <circle cx="43" cy="35" r="2" fill="#333" />
      <circle cx="57" cy="35" r="2" fill="#333" />
      <ellipse cx="50" cy="42" rx="5" ry="3" fill="#ffd5dc" />
      <path d="M45 47 Q50 52 55 47" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M75 55 Q85 45 80 65 Q75 70 72 60 Z" fill={color} opacity="0.8" />
    </svg>
  ),
};

/**
 * 6.8.4 - Obtiene animal SVG basado en seed
 */
function getAnimalSvg(seed: string): keyof typeof AnimalSvgs {
  // Convertir seed a número para selección determinista
  const num = parseInt(seed, 36) || 0;
  const animals = Object.keys(AnimalSvgs);
  return animals[num % animals.length] as keyof typeof AnimalSvgs;
}

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

  // Para estilo "animal", usar SVG propio según seed
  if (type === "animal") {
    const animalKey = getAnimalSvg(seed);
    const SvgComponent = AnimalSvgs[animalKey];
    return (
      <div 
        className={`relative flex items-center justify-center overflow-hidden rounded-full ${className}`}
        style={{ width: size, height: size }}
      >
        <SvgComponent color={color} size={size} />
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
