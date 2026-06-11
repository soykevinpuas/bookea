"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { createClientClient } from "@/lib/supabase";

export function useUserId() {
  const queryClient = useQueryClient();
  const supabase = createClientClient();

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: ["auth-user"] });
    });
    return () => listener?.subscription?.unsubscribe();
  }, [supabase, queryClient]);

  const query = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id || "";

      if (id && typeof window !== "undefined") {
        localStorage.setItem("bookea-auth-id", id);
      } else if (typeof window !== "undefined" && navigator.onLine) {
        localStorage.removeItem("bookea-auth-id");
      }

      return id;
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
    initialDataUpdatedAt: 0,
    initialData: () => {
      if (typeof window !== "undefined") {
        return localStorage.getItem("bookea-auth-id") || "";
      }
      return "";
    },
  });

  return {
    userId: query.data || "",
    isLoading: query.isLoading,
  };
}
