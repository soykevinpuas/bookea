/**
 * 6.9 - Avatares V2: Utilidades para el manejo de avatars dinámicos
 */

import { AnimalType, AVATAR_COLORS, AvatarConfig } from "@/components/avatars/AnimalEngine";

export type { AvatarConfig };

export const DEFAULT_AVATAR: AvatarConfig = {
  type: "dog",
  color: AVATAR_COLORS[0],
};

/**
 * Parsea un string de configuración de avatar (formato v2:tipo:color)
 */
export function parseAvatarConfig(configStr: string | null | undefined): AvatarConfig {
  if (!configStr || !configStr.startsWith("v2:")) {
    return DEFAULT_AVATAR;
  }

  const parts = configStr.split(":");
  if (parts.length < 3) return DEFAULT_AVATAR;

  return {
    type: parts[1] as AnimalType,
    color: parts[2],
  };
}

/**
 * Genera un string de configuración a partir de un objeto
 */
export function stringifyAvatarConfig(config: AvatarConfig): string {
  return `v2:${config.type}:${config.color}`;
}
