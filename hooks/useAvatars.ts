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
    staleTime: 1000 * 60 * 5,
    initialDataUpdatedAt: 0,
    initialData: () => {
      if (!userId || typeof window === "undefined") return undefined;
      try {
        const cached = localStorage.getItem(`profile-${userId}`);
        if (cached) return JSON.parse(cached) as Profile;
      } catch {}
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
