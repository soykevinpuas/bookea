"use client";

import { useQuery } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";

export function useUserId() {
  const query = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const supabase = createClientClient();
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id || "";

      if (id && typeof window !== "undefined") {
        localStorage.setItem("bookea-auth-id", id);
      } else if (typeof window !== "undefined" && navigator.onLine) {
        localStorage.removeItem("bookea-auth-id");
      }

      return id;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
    initialData: () => {
      if (typeof window !== "undefined") {
        return localStorage.getItem("bookea-auth-id") || undefined;
      }
      return undefined;
    },
  });

  return {
    userId: query.data || "",
    isLoading: query.isLoading,
  };
}
