"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { SubscriptionData } from "@/hooks/useSubscription";

function scheduleIdle(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(callback, { timeout: 1500 });
    return () => window.cancelIdleCallback(id);
  }

  const id = globalThis.setTimeout(callback, 700);
  return () => globalThis.clearTimeout(id);
}

// Precalienta solo rutas de la bottom nav; los datos los pide cada pantalla al entrar.
export function useNavigationWarmup(userId: string | undefined, role: SubscriptionData["role"] | undefined) {
  const router = useRouter();
  const routes = useMemo(() => {
    const nextRoutes = ["/catalog", "/dashboard", "/profile"];
    if (role === "admin") nextRoutes.push("/admin", "/vendedor");
    else if (role === "vendedor") nextRoutes.push("/vendedor");
    return nextRoutes;
  }, [role]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const cancelIdle = scheduleIdle(() => {
      if (cancelled) return;

      routes.forEach((href) => router.prefetch(href));
    });

    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [router, routes, userId]);
}
