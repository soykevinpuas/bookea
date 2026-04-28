/**
 * 6.9 - Avatares V2: Utilidades para el manejo de avatars dinámicos
 */

import { AvatarStyleType, AVATAR_COLORS, AvatarConfig } from "@/components/avatars/AnimalEngine";

export type { AvatarConfig };

export const DEFAULT_AVATAR: AvatarConfig = {
  type: "avataaars",
  color: AVATAR_COLORS[0],
  seed: "",
};

/**
 * Parsea un string de configuración de avatar (formato v2:tipo:color[:seed])
 */
export function parseAvatarConfig(configStr: string | null | undefined): AvatarConfig {
  if (!configStr || !configStr.startsWith("v2:")) {
    return { ...DEFAULT_AVATAR, seed: Math.random().toString(36).substring(2, 10) };
  }

  const parts = configStr.split(":");
  if (parts.length < 3) return { ...DEFAULT_AVATAR, seed: Math.random().toString(36).substring(2, 10) };
  
  // Validar que el tipo sea un estilo válido
  const validStyles: AvatarStyleType[] = ["avataaars", "bottts", "animal", "lorelei"];
  const type = validStyles.includes(parts[1] as AvatarStyleType) ? parts[1] as AvatarStyleType : "avataaars";
    
  return {
    type,
    color: parts[2] || AVATAR_COLORS[0],
    seed: parts[3] || Math.random().toString(36).substring(2, 10),
  };
}

/**
 * Genera un string de configuración a partir de un objeto
 */
export function stringifyAvatarConfig(config: AvatarConfig): string {
  return `v2:${config.type}:${config.color}:${config.seed || Math.random().toString(36).substring(2, 10)}`;
}
