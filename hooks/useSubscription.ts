import { useQuery } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";

export interface SubscriptionData {
  role: 'free' | 'subscriber' | 'admin';
  subscription_ends_at: string | null;
  isActive: boolean;
  isExpired: boolean;
  daysRemaining: number | null;
}

export function useSubscription(userId: string | undefined) {
  const query = useQuery({
    queryKey: ["user-subscription", userId],
    queryFn: async (): Promise<SubscriptionData | null> => {
      if (!userId) return null;

      const supabase = createClientClient();
      const { data, error } = await supabase
        .from("users")
        .select("role, subscription_ends_at")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("[useSubscription] Error fetching role:", error.message);
        throw error;
      }

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

      const subscription = {
        role: data.role as SubscriptionData['role'],
        subscription_ends_at: data.subscription_ends_at,
        isActive,
        isExpired,
        daysRemaining
      };

      // 2.3 - Cache local para reconocimiento instantáneo en el próximo inicio
      if (typeof window !== 'undefined') {
        localStorage.setItem(`bookea-sub-${userId}`, JSON.stringify(subscription));
      }

      return subscription;
    },
    initialData: () => {
      if (typeof window !== 'undefined' && userId) {
        const cached = localStorage.getItem(`bookea-sub-${userId}`);
        if (cached) {
          try {
            return JSON.parse(cached);
          } catch (e) {
            return undefined;
          }
        }
      }
      return undefined;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return query;
}
