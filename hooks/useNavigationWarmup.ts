"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { getBooks, getUserBooks } from "@/lib/books";
import { getProfile } from "@/lib/profiles";
import type { SubscriptionData } from "@/hooks/useSubscription";

const NAV_WARM_STALE_MS = 5 * 60 * 1000;

function scheduleIdle(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(callback, { timeout: 1500 });
    return () => window.cancelIdleCallback(id);
  }

  const id = globalThis.setTimeout(callback, 700);
  return () => globalThis.clearTimeout(id);
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo precargar la ruta");
  return res.json() as Promise<T>;
}

// Precalienta rutas y datos de la bottom nav cuando el navegador esta libre.
export function useNavigationWarmup(userId: string | undefined, role: SubscriptionData["role"] | undefined) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClientClient(), []);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const cancelIdle = scheduleIdle(() => {
      if (cancelled) return;

      const routes = ["/catalog", "/dashboard", "/profile"];
      if (role === "admin") routes.push("/admin", "/vendedor");
      else if (role === "vendedor") routes.push("/vendedor");

      routes.forEach((href) => router.prefetch(href));

      void queryClient.prefetchQuery({
        queryKey: ["books", "", "all", undefined, undefined],
        queryFn: () => getBooks(supabase, { search: "", category: "all" }),
        staleTime: NAV_WARM_STALE_MS,
      });

      void queryClient.prefetchQuery({
        queryKey: ["userBooks", userId, undefined, undefined],
        queryFn: () => getUserBooks(supabase, userId),
        staleTime: NAV_WARM_STALE_MS,
      });

      void queryClient.prefetchQuery({
        queryKey: ["profile", userId],
        queryFn: () => getProfile(userId),
        staleTime: NAV_WARM_STALE_MS,
      });

      if (role === "vendedor" || role === "admin") {
        void queryClient.prefetchQuery({
          queryKey: ["vendedor-dashboard", userId],
          queryFn: () => fetchJson("/api/vendedor/dashboard"),
          staleTime: 60 * 1000,
        });
      }

      if (role === "admin") {
        void queryClient.prefetchQuery({
          queryKey: ["admin-dashboard", 1, 1, 1],
          queryFn: () => fetchJson("/api/admin/dashboard?salesPage=1&inventoryPage=1&requestsPage=1"),
          staleTime: 60 * 1000,
        });
      }
    });

    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [queryClient, role, router, supabase, userId]);
}
