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
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`profile-${userId}`, JSON.stringify(data));
    } catch (e) {}
  }

  return data as Profile | null;
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
