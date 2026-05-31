import { useQuery } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";

export interface SubscriptionData {
  role: 'free' | 'subscriber' | 'admin' | 'vendedor';
  subscription_ends_at: string | null;
  isActive: boolean;
  isExpired: boolean;
  daysRemaining: number | null;
}

const DEFAULT_FREE: SubscriptionData = {
  role: 'free',
  subscription_ends_at: null,
  isActive: false,
  isExpired: false,
  daysRemaining: null,
};

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
        return DEFAULT_FREE;
      }

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
      
      const isExpired = (data.role === 'subscriber' && endsAt !== null && endsAt <= now);
      
      let daysRemaining = null;
      if (endsAt !== null && endsAt > now) {
        daysRemaining = Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      const subscription: SubscriptionData = {
        role: data.role as SubscriptionData['role'],
        subscription_ends_at: data.subscription_ends_at,
        isActive,
        isExpired,
        daysRemaining
      };

      if (typeof window !== "undefined") {
        localStorage.setItem("bookea-subscription-cache", JSON.stringify(subscription));
      }

      return subscription;
    },
    enabled: !!userId,
    staleTime: 0,
    initialData: () => {
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem("bookea-subscription-cache");
        if (cached) {
          try { return JSON.parse(cached) as SubscriptionData; } catch (e) {}
        }
      }
      return undefined;
    },
  });

  return query;
}
