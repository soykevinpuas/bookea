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
import {
  applyCoinBalanceRealtime,
  applyCoinHistoryRealtime,
  applyOrderRealtime,
  applyProfileRealtime,
  applyReferralRealtime,
  applyStockRequestRealtime,
  applyUserBookRealtime,
  applyUserRealtime,
} from "@/lib/realtime-cache";

// Sync global de inventario: mantiene alineadas las pantallas aunque el cambio nazca en otra sección.
export function StockRealtimeSync() {
  const { userId, isReady } = useAuth();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClientClient(), []);

  useEffect(() => {
    const syncFromBookChange = () => {
      // La cache persistida evita una pantalla vacía si Supabase está lento.
      // El hook de catálogo aplica el payload y la revalidación confirma después.
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
      // El snapshot del evento ya es transaccional y canónico. Refetchear aquí puede
      // permitir que una respuesta iniciada antes del evento pise el valor confirmado.
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

    const channel = supabase
      .channel(`global-user-data-sync-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders_physical" }, (payload) => applyOrderRealtime(queryClient, userId, payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, (payload) => applyUserRealtime(queryClient, userId, payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => applyProfileRealtime(queryClient, userId, payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "user_books", filter: `user_id=eq.${userId}` }, (payload) => applyUserBookRealtime(queryClient, userId, payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "coins", filter: `user_id=eq.${userId}` }, (payload) => applyCoinBalanceRealtime(queryClient, userId, payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "coin_transactions", filter: `user_id=eq.${userId}` }, (payload) => applyCoinHistoryRealtime(queryClient, userId, "transactions", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "coin_redemptions", filter: `user_id=eq.${userId}` }, (payload) => applyCoinHistoryRealtime(queryClient, userId, "redemptions", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "referrals" }, (payload) => applyReferralRealtime(queryClient, userId, payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_requests" }, (payload) => applyStockRequestRealtime(queryClient, payload))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isReady, queryClient, supabase, userId]);

  return null;
}
