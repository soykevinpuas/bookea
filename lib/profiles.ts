import { createClientClient } from "@/lib/supabase";

/**
 * 6.2 - Perfiles: Lógica de acceso a datos para la gestión de identidad de usuario
 */

export interface Profile {
  id: string;
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  reading_streak: number;
  total_books_read: number;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = createClientClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    // Fallback: intentar recuperar del caché local
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('bookea-avatar-cache');
      if (cached) {
        try {
          const config = JSON.parse(cached);
          return {
            id: 'temp',
            user_id: userId,
            name: null,
            avatar_url: `v2:${config.type}:${config.color}:${config.seed}`,
            bio: null,
            reading_streak: 0,
            total_books_read: 0,
          } as Profile;
        } catch (e) {}
      }
    }
    return null;
  }

  // Si recuperamos de DB, actualizar caché local
  if (data?.avatar_url && typeof window !== 'undefined') {
    try {
      const parts = data.avatar_url.split(":");
      if (parts.length >= 3) {
        localStorage.setItem('bookea-avatar-cache', JSON.stringify({
          type: parts[1],
          color: parts[2],
          seed: parts[3] || ''
        }));
      }
    } catch (e) {}
  }

  return data as Profile;
}

export async function updateProfileAvatar(userId: string, avatarConfig: string): Promise<boolean> {
  const supabase = createClientClient();

  const { data: existing } = await supabase
    .from("profiles")
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  let error;
  if (existing) {
    ({ error } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarConfig, updated_at: new Date().toISOString() })
      .eq('user_id', userId));
  } else {
    ({ error } = await supabase
      .from("profiles")
      .insert({ user_id: userId, avatar_url: avatarConfig, updated_at: new Date().toISOString() }));
  }

  return !error;
}

export async function updateProfileName(userId: string, name: string): Promise<boolean> {
  const supabase = createClientClient();

  const { data: existing } = await supabase
    .from("profiles")
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  let error;
  if (existing) {
    ({ error } = await supabase
      .from("profiles")
      .update({ name, updated_at: new Date().toISOString() })
      .eq('user_id', userId));
  } else {
    ({ error } = await supabase
      .from("profiles")
      .insert({ user_id: userId, name, updated_at: new Date().toISOString() }));
  }

  return !error;
}
