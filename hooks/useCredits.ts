import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";

export function useCredits(userId: string | undefined) {
  const supabase = createClientClient();
  const queryClient = useQueryClient();

  const { data: credits, isLoading } = useQuery({
    queryKey: ["user-credits", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("subscription_credits")
        .select("credits_remaining")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return data?.credits_remaining ?? 0;
    },
    enabled: !!userId,
  });

  const redeemCredit = useMutation({
    mutationFn: async (bookId: string) => {
      const response = await fetch("/api/credits/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error al canjear crédito");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-credits", userId] });
      queryClient.invalidateQueries({ queryKey: ["user-books", userId] });
    },
  });

  return { credits, isLoading, redeemCredit };
}
