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
import { queryKeys } from "@/lib/query-keys";

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

  useEffect(() => {
    if (!isReady || !userId) return;

    // Realtime marca dominios no relacionados con stock; React Query conserva
    // la vista actual mientras refetch trae el estado confirmado por RLS.
    const refreshUserOrders = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.user(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.admin });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.purchasedBooks(userId) });
    };
    const refreshUserData = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.admin });
      void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.summary(userId) });
    };
    const refreshCoins = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.coins.all(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.coins.transactions(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.coins.redemptions(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.summary(userId) });
    };
    const refreshLibrary = () => {
      void queryClient.invalidateQueries({ queryKey: ["userBooks", userId] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.purchasedBooks(userId) });
    };

    const channel = supabase
      .channel(`global-user-data-sync-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders_physical" }, refreshUserOrders)
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, refreshUserData)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, refreshUserData)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_books", filter: `user_id=eq.${userId}` }, refreshLibrary)
      .on("postgres_changes", { event: "*", schema: "public", table: "coins", filter: `user_id=eq.${userId}` }, refreshCoins)
      .on("postgres_changes", { event: "*", schema: "public", table: "coin_transactions", filter: `user_id=eq.${userId}` }, refreshCoins)
      .on("postgres_changes", { event: "*", schema: "public", table: "coin_redemptions", filter: `user_id=eq.${userId}` }, refreshCoins)
      .on("postgres_changes", { event: "*", schema: "public", table: "referrals" }, refreshUserData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isReady, queryClient, supabase, userId]);

  return null;
}
