import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";

export interface SubscriptionData {
  role: 'free' | 'subscriber' | 'admin';
  subscription_ends_at: string | null;
  isActive: boolean;
  isExpired: boolean;
  daysRemaining: number | null;
}

export function useSubscription(userId: string | undefined) {
  const supabase = useMemo(() => createClientClient(), []);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["user-subscription", userId],
    queryFn: async (): Promise<SubscriptionData | null> => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("users")
        .select("role, subscription_ends_at")
        .eq("id", userId)
        .single();

      if (error) throw error;

      const now = new Date();
      const endsAt = data.subscription_ends_at ? new Date(data.subscription_ends_at) : null;
      
      const isActive = data.role === 'admin' || 
                      (data.role === 'subscriber' && (!endsAt || endsAt > now));
      
      const isExpired = data.role === 'subscriber' && !!endsAt && endsAt <= now;
      
      let daysRemaining = null;
      if (endsAt && endsAt > now) {
        daysRemaining = Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        role: data.role as SubscriptionData['role'],
        subscription_ends_at: data.subscription_ends_at,
        isActive,
        isExpired,
        daysRemaining
      };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 1, // 1 minuto de cache (seguro y reactivo)
  });

  // 2.2 - Suscripción Realtime: Escuchar cambios en el rol del usuario para actualizar instantáneamente
  useEffect(() => {
    if (!userId) {
      console.log("[SubscriptionHook] No userId provided, skipping realtime.");
      return;
    }

    console.log(`[SubscriptionHook] Connecting to Realtime for user: ${userId}`);

    const channel = supabase
      .channel(`user-updates-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`
        },
        (payload: any) => {
          console.log("[SubscriptionHook] 🔔 CHANGE DETECTED!", payload);
          // Forzar refresco de React Query al detectar cambio en DB
          query.refetch();
        }
      )
      .subscribe((status) => {
        console.log(`[SubscriptionHook] Status: ${status}`);
        if (status === 'CHANNEL_ERROR') {
          console.error("[SubscriptionHook] ❌ Realtime error. Check RLS or Supabase Dashboard replication settings.");
        }
      });

    return () => {
      console.log(`[SubscriptionHook] Cleaning up channel for user: ${userId}`);
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, query]);

  return query;
}
