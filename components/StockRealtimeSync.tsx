"use client";

import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { createClientClient } from "@/lib/supabase";
import {
  applyStockMutationResult,
  refreshStockQueries,
  stockMutationResultFromRealtime,
} from "@/lib/stock-cache";

const CATALOG_CACHE_PREFIX = "bookea-catalog-cache-";

function clearPersistedCatalogCaches() {
  if (typeof window === "undefined") return;

  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(CATALOG_CACHE_PREFIX)) localStorage.removeItem(key);
    }
    window.dispatchEvent(new Event("bookea-catalog-cache"));
  } catch {}
}

// Sync global de inventario: mantiene alineadas las pantallas aunque el cambio nazca en otra sección.
export function StockRealtimeSync() {
  const { userId, isReady } = useAuth();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClientClient(), []);

  useEffect(() => {
    const syncFromBookChange = () => {
      clearPersistedCatalogCaches();
      refreshStockQueries(queryClient);
    };

    const channel = supabase
      .channel("global-books-stock-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "books" }, syncFromBookChange)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, supabase]);

  useEffect(() => {
    if (!isReady || !userId) return;

    const syncFromStockEvent = (payload: unknown) => {
      const result = stockMutationResultFromRealtime(payload);
      if (result) {
        applyStockMutationResult(queryClient, result, { adminId: userId, sellerId: userId });
      }

      clearPersistedCatalogCaches();
      refreshStockQueries(queryClient);
    };

    const channel = supabase
      .channel(`global-stock-events-sync-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "stock_events" }, syncFromStockEvent)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isReady, queryClient, supabase, userId]);

  return null;
}
