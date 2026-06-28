import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";

export interface SubscriptionData {
  role: 'free' | 'subscriber' | 'admin' | 'vendedor';
  subscription_ends_at: string | null;
  isActive: boolean;
  isExpired: boolean;
  daysRemaining: number | null;
}

function buildSubscriptionData(data: {
  role: string;
  subscription_ends_at: string | null;
}): SubscriptionData {
  let endsAt: Date | null = null;
  if (data.subscription_ends_at) {
    const parsedDate = new Date(data.subscription_ends_at);
    if (!isNaN(parsedDate.getTime())) {
      endsAt = parsedDate;
    }
  }

  const now = new Date();
  const isActive = data.role === 'admin' || data.role === 'vendedor' ||
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
    daysRemaining,
  };
}

export function useSubscription(userId: string | undefined) {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClientClient(), []);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const cacheKey = `bookea-subscription-cache-v2-${userId || 'anon'}`;

  const query = useQuery({
    queryKey: ["user-subscription", userId],
    queryFn: async (): Promise<SubscriptionData | null> => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("users")
        .select("role, subscription_ends_at")
        .eq("id", userId)
        .maybeSingle();

      if (error || !data) {
        const cached = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null;
        if (cached) {
          try { return JSON.parse(cached) as SubscriptionData; } catch {}
        }
        return null;
      }

      const subscription = buildSubscriptionData(data);

      if (typeof window !== "undefined") {
        localStorage.setItem(cacheKey, JSON.stringify(subscription));
      }

      return subscription;
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    initialData: () => {
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try { return JSON.parse(cached) as SubscriptionData; } catch {}
        }
      }
      return undefined;
    },
  });

  // Escuchar cambios de rol/suscripción hechos desde el panel admin en tiempo real
  useEffect(() => {
    if (!userId) return;
    if (channelRef.current) return;

    const channel = supabase
      .channel(`user-role-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const newRow = payload.new as { role?: string; subscription_ends_at?: string | null };
          if (!newRow?.role) return;

          const subscription = buildSubscriptionData({
            role: newRow.role,
            subscription_ends_at: newRow.subscription_ends_at ?? null,
          });

          if (typeof window !== "undefined") {
            localStorage.setItem(cacheKey, JSON.stringify(subscription));
          }

          queryClient.setQueryData(["user-subscription", userId], subscription);
          queryClient.invalidateQueries({ queryKey: ["user-role", userId] });
          queryClient.invalidateQueries({ queryKey: ["my-role"] });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId, supabase, queryClient, cacheKey]);

  return query;
}
