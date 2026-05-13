"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProfile, updateProfileAvatar, updateProfileName } from "@/lib/profiles";
import type { Profile } from "@/lib/profiles";

/**
 * 6.3 - useProfile / useAvatars: Hook de gestión de la identidad visual del usuario
 */

export function useProfile(userId: string | undefined) {
  const queryClient = useQueryClient();

  // 6.3.1 - Consulta del perfil actual
  const profileQuery = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const data = await getProfile(userId!);
      return data;
    },
    enabled: !!userId,
    staleTime: 0,
    initialData: () => {
      if (!userId || typeof window === "undefined") return undefined;
      const cached = localStorage.getItem("bookea-avatar-cache");
      if (cached) {
        try {
          const config = JSON.parse(cached);
          return {
            id: "temp",
            user_id: userId,
            name: null,
            avatar_url: `v2:${config.type}:${config.color}:${config.seed}`,
            bio: null,
            reading_streak: 0,
            total_books_read: 0,
          } as Profile;
        } catch (e) {}
      }
      return undefined;
    },
  });

  // 6.3.2 - Mutación para actualizar el avatar
  const avatarMutation = useMutation({
    mutationFn: (avatarConfig: string) => updateProfileAvatar(userId!, avatarConfig),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  });

  // 6.3.3 - Mutación para actualizar el nombre público
  const nameMutation = useMutation({
    mutationFn: (name: string) => updateProfileName(userId!, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    }
  });

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    updateAvatar: avatarMutation.mutateAsync,
    isUpdatingAvatar: avatarMutation.isPending,
    updateName: nameMutation.mutateAsync,
    isUpdatingName: nameMutation.isPending,
  };
}
