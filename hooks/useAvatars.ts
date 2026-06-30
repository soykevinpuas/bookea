"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProfile, updateProfileAvatar, updateProfileName } from "@/lib/profiles";
import type { Profile } from "@/lib/profiles";

/**
 * 6.3 - useProfile / useAvatars: Hook de gestión de la identidad visual del usuario
 */

export function useProfile(userId: string | undefined) {
  const queryClient = useQueryClient();

  const cacheProfile = (profile: Profile | null | undefined) => {
    if (!userId || typeof window === "undefined") return;
    try {
      localStorage.setItem(`profile-${userId}`, JSON.stringify(profile ?? null));
    } catch {}
  };

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
    mutationFn: async (avatarConfig: string) => {
      const success = await updateProfileAvatar(userId!, avatarConfig);
      if (!success) throw new Error("No se pudo guardar el avatar");
      return avatarConfig;
    },
    onMutate: async (avatarConfig: string) => {
      await queryClient.cancelQueries({ queryKey: ["profile", userId] });
      const previousProfile = queryClient.getQueryData<Profile | null>(["profile", userId]);
      const optimisticProfile: Profile = {
        id: previousProfile?.id || "",
        user_id: previousProfile?.user_id || userId!,
        name: previousProfile?.name || null,
        avatar_url: avatarConfig,
        bio: previousProfile?.bio || null,
        reading_streak: previousProfile?.reading_streak || 0,
        total_books_read: previousProfile?.total_books_read || 0,
      };

      queryClient.setQueryData(["profile", userId], optimisticProfile);
      cacheProfile(optimisticProfile);

      return { previousProfile };
    },
    onError: (_error, _avatarConfig, context) => {
      queryClient.setQueryData(["profile", userId], context?.previousProfile);
      cacheProfile(context?.previousProfile);
    },
    onSuccess: (avatarConfig: string) => {
      const currentProfile = queryClient.getQueryData<Profile | null>(["profile", userId]);
      if (currentProfile) {
        const syncedProfile = { ...currentProfile, avatar_url: avatarConfig };
        queryClient.setQueryData(["profile", userId], syncedProfile);
        cacheProfile(syncedProfile);
      }
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
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
