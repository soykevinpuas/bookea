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

  if (error) return null;
  return data as Profile;
}

export async function updateProfileAvatar(userId: string, avatarConfig: string): Promise<boolean> {
  const supabase = createClientClient();
  
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarConfig, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  return !error;
}

export async function updateProfileName(userId: string, name: string): Promise<boolean> {
  const supabase = createClientClient();
  const { error } = await supabase
    .from("profiles")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  return !error;
}
