import { useEffect, useMemo, useRef } from "react";
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
  // Ref estable para evitar reconexiones del canal Realtime
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const query = useQuery({
    queryKey: ["user-subscription", userId],
    queryFn: async (): Promise<SubscriptionData | null> => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("users")
        .select("role, subscription_ends_at")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("[useSubscription] Error fetching role:", error.message);
        throw error;
      }

      console.log("[useSubscription] Fetched from DB:", data);

      let endsAt: Date | null = null;
      if (data.subscription_ends_at) {
        const parsedDate = new Date(data.subscription_ends_at);
        if (!isNaN(parsedDate.getTime())) {
          endsAt = parsedDate;
        }
      }
      
      const now = new Date();
      const isActive = data.role === 'admin' || 
                      (data.role === 'subscriber' && (endsAt === null || endsAt > now));
      
      const isExpired = data.role === 'subscriber' && endsAt !== null && endsAt <= now;
      
      let daysRemaining = null;
      if (endsAt !== null && endsAt > now) {
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
    staleTime: 0, // SIEMPRE refrescar del servidor — sin cache engañoso
    refetchOnWindowFocus: true, // Refrescar al volver a la pestaña
  });

  // 2.2 - Suscripción Realtime: Escuchar cambios en el rol del usuario
  useEffect(() => {
    if (!userId) return;

    // No reconectar si ya existe un canal para este userId
    if (channelRef.current) return;

    console.log(`[useSubscription] Connecting Realtime for user: ${userId}`);

    const channel = supabase
      .channel(`user-role-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`
        },
        (payload: any) => {
          console.log("[useSubscription] 🔔 REALTIME CHANGE:", payload.new);
          // Forzar refetch inmediato ignorando staleTime
          queryClient.invalidateQueries({ 
            queryKey: ["user-subscription", userId],
            refetchType: 'all'
          });
        }
      )
      .subscribe((status: string) => {
        console.log(`[useSubscription] Realtime status: ${status}`);
      });

    channelRef.current = channel;

    return () => {
      console.log(`[useSubscription] Cleaning up channel for user: ${userId}`);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId]); // Solo depende de userId — supabase y queryClient son estables

  return query;
}
