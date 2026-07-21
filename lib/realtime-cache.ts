import type { QueryClient } from "@tanstack/react-query";
import type { Book } from "@/types/book";
import type { CoinBalance, CoinRedemption, CoinTransaction, CoinType } from "@/types/coins";
import { queryKeys } from "@/lib/query-keys";

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE";
type RealtimePayload<Row> = {
  eventType: RealtimeEvent;
  new: Row;
  old: Row;
};

type IdentifiedRow = Record<string, unknown> & { id: string };
type ProfileSummary = { coins: CoinBalance; streak: number; referralCount: number };
type DashboardWithRequests = {
  requests?: IdentifiedRow[] | { data: IdentifiedRow[]; total: number };
};

function eventRow<Row>(payload: RealtimePayload<Row>) {
  return payload.eventType === "DELETE" ? payload.old : payload.new;
}

function mergeRealtimeList<Row extends { id: string }>(old: Row[] | undefined, payload: RealtimePayload<Row>) {
  if (!old) return old;
  const row = eventRow(payload);
  if (!row?.id) return old;
  if (payload.eventType === "DELETE") return old.filter((item) => item.id !== row.id);

  const index = old.findIndex((item) => item.id === row.id);
  if (index < 0) return [row, ...old];
  return old.map((item, itemIndex) => itemIndex === index ? { ...item, ...row } : item);
}

function parsePayload(payload: unknown): RealtimePayload<IdentifiedRow> | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as { eventType?: string; new?: unknown; old?: unknown };
  if (candidate.eventType !== "INSERT" && candidate.eventType !== "UPDATE" && candidate.eventType !== "DELETE") return null;
  const row = candidate.eventType === "DELETE" ? candidate.old : candidate.new;
  if (!row || typeof row !== "object" || typeof (row as { id?: unknown }).id !== "string") return null;
  return candidate as RealtimePayload<IdentifiedRow>;
}

function silentlyConfirm(queryClient: QueryClient, queryKey: readonly unknown[]) {
  void queryClient.invalidateQueries({ queryKey, refetchType: "none" });
  void queryClient.refetchQueries({ queryKey, type: "active" });
}

function writeLocalCache(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/** Aplica una orden confirmada por Realtime antes de revalidar sus joins en segundo plano. */
export function applyOrderRealtime(queryClient: QueryClient, userId: string, rawPayload: unknown) {
  const payload = parsePayload(rawPayload);
  if (!payload) return;
  queryClient.setQueryData<IdentifiedRow[]>(queryKeys.orders.admin, (old) => mergeRealtimeList(old, payload));

  const row = eventRow(payload);
  if (row.user_id === userId) {
    queryClient.setQueryData<IdentifiedRow[]>(queryKeys.orders.user(userId), (old) => mergeRealtimeList(old, payload));
  }

  silentlyConfirm(queryClient, queryKeys.orders.admin);
  silentlyConfirm(queryClient, queryKeys.orders.user(userId));
  silentlyConfirm(queryClient, queryKeys.profile.purchasedBooks(userId));
}

/** Mantiene las listas administrativas, el perfil y la suscripcion alineados con public.users. */
export function applyUserRealtime(queryClient: QueryClient, userId: string, rawPayload: unknown) {
  const payload = parsePayload(rawPayload);
  if (!payload) return;
  queryClient.setQueryData<IdentifiedRow[]>(queryKeys.users.admin, (old) => mergeRealtimeList(old, payload));
  const row = eventRow(payload);
  if (row.id === userId && payload.eventType !== "DELETE") {
    queryClient.setQueryData(["user-subscription", userId], (old: Record<string, unknown> | null | undefined) =>
      old ? { ...old, ...row } : old
    );
  }
  silentlyConfirm(queryClient, queryKeys.users.admin);
}

/** Propaga cambios del perfil a todas sus representaciones en memoria. */
export function applyProfileRealtime(queryClient: QueryClient, userId: string, rawPayload: unknown) {
  const payload = parsePayload(rawPayload);
  if (!payload) return;
  const row = eventRow(payload);
  const profileUserId = typeof row.user_id === "string" ? row.user_id : userId;
  queryClient.setQueryData(["profile", profileUserId], (old: Record<string, unknown> | null | undefined) =>
    old && payload.eventType !== "DELETE"
      ? (() => {
          const next = { ...old, ...row };
          writeLocalCache(`profile-${profileUserId}`, next);
          return next;
        })()
      : old
  );
  if (profileUserId === userId && typeof row.reading_streak === "number") {
    queryClient.setQueryData<ProfileSummary>(queryKeys.profile.summary(userId), (old) =>
      old ? { ...old, streak: row.reading_streak as number } : old
    );
    queryClient.setQueryData(["user-streak", userId], row.reading_streak);
  }
  silentlyConfirm(queryClient, ["profile", profileUserId]);
}

/** Sustituye el saldo concreto recibido de public.coins sin esperar otra consulta. */
export function applyCoinBalanceRealtime(queryClient: QueryClient, userId: string, rawPayload: unknown) {
  const payload = parsePayload(rawPayload);
  if (!payload) return;
  const row = eventRow(payload);
  const coinType = row.coin_type as CoinType | undefined;
  if (!coinType) return;
  const amount = payload.eventType === "DELETE" ? 0 : Number(row.amount ?? 0);
  queryClient.setQueryData<CoinBalance>(queryKeys.coins.all(userId), (old) => old ? { ...old, [coinType]: amount } : old);
  queryClient.setQueryData<ProfileSummary>(queryKeys.profile.summary(userId), (old) =>
    old ? { ...old, coins: { ...old.coins, [coinType]: amount } } : old
  );
  silentlyConfirm(queryClient, queryKeys.coins.all(userId));
}

/** Inserta o retira movimientos/canjes en sus historiales locales inmediatamente. */
export function applyCoinHistoryRealtime(
  queryClient: QueryClient,
  userId: string,
  domain: "transactions" | "redemptions",
  rawPayload: unknown
) {
  const payload = parsePayload(rawPayload);
  if (!payload) return;
  const key = domain === "transactions"
    ? queryKeys.coins.transactions(userId)
    : queryKeys.coins.redemptions(userId);
  if (domain === "transactions") {
    queryClient.setQueryData<CoinTransaction[]>(key, (old) => mergeRealtimeList(old, payload as unknown as RealtimePayload<CoinTransaction>));
  } else {
    queryClient.setQueryData<CoinRedemption[]>(key, (old) => mergeRealtimeList(old, payload as unknown as RealtimePayload<CoinRedemption>));
  }
  silentlyConfirm(queryClient, key);
}

/** Retira accesos al instante; para altas reutiliza el libro ya presente en cualquier cache de catalogo. */
export function applyUserBookRealtime(queryClient: QueryClient, userId: string, rawPayload: unknown) {
  const payload = parsePayload(rawPayload);
  if (!payload) return;
  const row = eventRow(payload);
  const bookId = typeof row.book_id === "string" ? row.book_id : null;
  if (!bookId) return;

  queryClient.setQueriesData<Book[]>({ queryKey: ["userBooks", userId] }, (old) => {
    if (!old) return old;
    if (payload.eventType === "DELETE") {
      const next = old.filter((book) => book.id !== bookId);
      writeLocalCache(`bookea-library-${userId}`, next);
      return next;
    }
    if (old.some((book) => book.id === bookId)) return old;
    const catalogBook = queryClient.getQueriesData<Book[]>({ queryKey: ["books"] })
      .flatMap(([, books]) => books ?? [])
      .find((book) => book.id === bookId);
    if (!catalogBook) return old;
    const next = [catalogBook, ...old];
    writeLocalCache(`bookea-library-${userId}`, next);
    return next;
  });
  silentlyConfirm(queryClient, ["userBooks", userId]);
  silentlyConfirm(queryClient, queryKeys.profile.purchasedBooks(userId));
}

/** Actualiza el contador propio de referidos usando el evento confirmado. */
export function applyReferralRealtime(queryClient: QueryClient, userId: string, rawPayload: unknown) {
  const payload = parsePayload(rawPayload);
  if (!payload) return;
  const row = eventRow(payload);
  if (row.referrer_id !== userId) return;
  const delta = payload.eventType === "DELETE" ? -1 : payload.eventType === "INSERT" ? 1 : 0;
  if (!delta) return;
  queryClient.setQueryData<number>(["user-referral-count", userId], (old = 0) => Math.max(0, old + delta));
  queryClient.setQueryData<ProfileSummary>(queryKeys.profile.summary(userId), (old) =>
    old ? { ...old, referralCount: Math.max(0, old.referralCount + delta) } : old
  );
}

/** Sincroniza solicitudes en paneles admin/vendedor conservando los joins ya cargados. */
export function applyStockRequestRealtime(queryClient: QueryClient, rawPayload: unknown) {
  const payload = parsePayload(rawPayload);
  if (!payload) return;
  queryClient.setQueriesData<DashboardWithRequests>({ queryKey: ["vendedor-dashboard"] }, (old) => {
    if (!old || !Array.isArray(old.requests)) return old;
    return { ...old, requests: mergeRealtimeList(old.requests, payload) };
  });
  queryClient.setQueriesData<DashboardWithRequests>({ queryKey: ["admin-dashboard"] }, (old) => {
    if (!old?.requests || Array.isArray(old.requests)) return old;
    const previousLength = old.requests.data.length;
    const data = mergeRealtimeList(old.requests.data, payload) ?? old.requests.data;
    return {
      ...old,
      requests: {
        ...old.requests,
        data,
        total: Math.max(0, old.requests.total + data.length - previousLength),
      },
    };
  });
  silentlyConfirm(queryClient, ["vendedor-dashboard"]);
  silentlyConfirm(queryClient, ["admin-dashboard"]);
}
