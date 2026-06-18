"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { createClientClient } from "@/lib/supabase";

export function useUserId() {
  const queryClient = useQueryClient();
  const supabase = createClientClient();
  const debounceRef = useRef(0);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["auth-user"] });
      }, 100);
    });
    return () => {
      window.clearTimeout(debounceRef.current);
      listener?.subscription?.unsubscribe();
    };
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
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: false,
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
