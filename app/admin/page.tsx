"use client";

import AppImage from "@/components/ui/AppImage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { fetchJsonWithSessionRetry } from "@/lib/auth-fetch";
import { updateStockRequestStatus, COST_PER_BOOK, ADMIN_COST_BOOK, markSalesAsPaid, assignStock } from "@/lib/sellers";
import { deleteStockRequestAction, deleteSaleAction, removeSellerInventoryAction } from "@/lib/actions/sellers";
import {
  applyStockMutationResult,
  refreshStockQueries,
  STOCK_QUERY_OPTIONS,
  stockMutationResultFromRealtime,
} from "@/lib/stock-cache";
import type { StockRequest } from "@/types/seller";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";

import Link from "next/link";
import {
  BarChart3, Package, TrendingUp, ShoppingCart,
  Store, ChevronLeft, ChevronRight,
  Calendar, Check, Clock, Trash2, DollarSign,
  Plus, Minus, Search, Loader2, Shield, X, List,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from "recharts";
import ErrorBoundary from "@/components/ErrorBoundary";
import StockRequestItemsModal from "@/components/StockRequestItemsModal";
import BookPreviewModal from "@/components/BookPreviewModal";
import type { StockMutationResult } from "@/types/stock";

type Section = "ingresos" | "stock" | "vendidos" | "solicitudes" | "pagos";
type SoldPanelTab = "historial" | "top";
type TopBooksPeriod = "currentMonth" | "last30Days" | "all";
type TopBooksView = "list" | "chart";

interface TopBook {
  book_id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  units: number;
  revenue: number;
  sales: number;
  lastSoldAt: string | null;
}

interface DashboardBookInfo {
  id: string;
  title: string;
  author?: string | null;
  cover_url?: string | null;
  price_physical?: number | null;
  stock_physical?: number | null;
  description?: string | null;
  category?: string | null;
}

interface AdminSeller {
  id: string;
  email: string;
  assigned_admin_id: string | null;
}

interface PhysicalBook extends DashboardBookInfo {
  author: string | null;
  cover_url: string | null;
  price_physical: number | null;
  stock_physical: number | null;
}

interface AdminInventoryItem {
  id: string;
  seller_id: string;
  book_id: string;
  quantity: number;
  updated_at: string;
  books?: DashboardBookInfo | null;
  seller?: Pick<AdminSeller, "id" | "email"> | null;
}

interface AdminSale {
  id: string;
  seller_id: string;
  book_id: string | null;
  quantity: number;
  sale_price: number;
  sold_at: string;
  paid_at?: string | null;
  admin_id?: string | null;
  books?: DashboardBookInfo | null;
  seller?: Pick<AdminSeller, "id" | "email"> | null;
  profile?: { name?: string | null } | null;
}

interface AdminStockRequestItem {
  id: string;
  request_id?: string;
  book_id: string;
  quantity: number;
  received_at: string | null;
  books?: DashboardBookInfo | null;
}

interface AdminStockRequest extends Omit<StockRequest, "items" | "seller"> {
  items?: AdminStockRequestItem[];
  seller?: Pick<AdminSeller, "id" | "email"> | null;
}

interface ChartTooltipEntry {
  color?: string;
  name?: string;
  value?: number;
  payload?: { title?: string };
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string | number;
}

const TOP_BOOK_PERIODS: { key: TopBooksPeriod; label: string }[] = [
  { key: "currentMonth", label: "Este mes" },
  { key: "last30Days", label: "30 días" },
  { key: "all", label: "Todo" },
];

const EMPTY_TOP_BOOKS: Record<TopBooksPeriod, TopBook[]> = {
  currentMonth: [],
  last30Days: [],
  all: [],
};

const sections: { key: Section; label: string; icon: LucideIcon }[] = [
  { key: "ingresos", label: "Ingresos", icon: BarChart3 },
  { key: "stock", label: "Stock", icon: Package },
  { key: "vendidos", label: "Vendidos", icon: TrendingUp },
  { key: "solicitudes", label: "Solicitudes", icon: ShoppingCart },
  { key: "pagos", label: "Pagos", icon: DollarSign },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
  shipped: { label: "Enviado", color: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
  delivered: { label: "Entregado", color: "bg-green-500/10 text-green-400 border border-green-500/20" },
  cancelled: { label: "Cancelado", color: "bg-red-500/10 text-red-400 border border-red-500/20" },
};

const ADMIN_BACKGROUND_REFRESH_MS = 10 * 1000;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function normalizeStockMutationResult(data: unknown): StockMutationResult {
  if (!data || typeof data !== "object") {
    return { success: false, error: "Respuesta inválida de stock" };
  }
  return data as StockMutationResult;
}

const ChartTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (!active || !payload?.length) return null;
  const displayLabel = payload[0]?.payload?.title ?? label;
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-white/50 mb-1">{displayLabel}</p>
      {payload.map((entry, i) => {
        const value = Number(entry.value ?? 0);
        return (
          <p key={i} className="font-medium" style={{ color: entry.color }}>
            {entry.name}: {entry.name === "Unidades"
              ? `${value.toLocaleString("es-MX")} uds.`
              : `$${value.toLocaleString("es-MX")}`}
          </p>
        );
      })}
    </div>
  );
}

export default function AdminDashboard() {
  const supabase = createClientClient();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<Section>("ingresos");
  const [soldTab, setSoldTab] = useState<SoldPanelTab>("historial");
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [topBooksPeriod, setTopBooksPeriod] = useState<TopBooksPeriod>("currentMonth");
  const [topBooksView, setTopBooksView] = useState<TopBooksView>("list");

  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [assignSelfBookId, setAssignSelfBookId] = useState("");
  const [assignSelfQty, setAssignSelfQty] = useState(1);
  const [assignSelfSearch, setAssignSelfSearch] = useState("");
  const [assignSellerId, setAssignSellerId] = useState("");
  const [assignSellerQtys, setAssignSellerQtys] = useState<Record<string, number>>({});
  const [assignSellerSearch, setAssignSellerSearch] = useState("");
  const [pendingOps, setPendingOps] = useState<Set<string>>(new Set());
  const [modalItems, setModalItems] = useState<{ sellerId: string; items: AdminStockRequestItem[] } | null>(null);
  const [stockModalSeller, setStockModalSeller] = useState<{sellerId: string; email: string; items: AdminInventoryItem[]} | null>(null);
  const [previewBook, setPreviewBook] = useState<DashboardBookInfo | null>(null);
  const stockWriteInFlight = useRef(false);
  const realtimeRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deletedSaleIds = useRef(new Set<string>());
  const deletedSaleTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    perPage: number;
  }

  interface DashboardData {
    adminUserId: string;
    sales: PaginatedResponse<AdminSale>;
    inventory: PaginatedResponse<AdminInventoryItem>;
    sellers: AdminSeller[];
    requests: PaginatedResponse<AdminStockRequest>;
    pendingSales: AdminSale[];
    physicalBooks: PhysicalBook[];
    salesMap: Record<string, number>;
    adminStock: { book_id: string; quantity: number }[];
    topBooks: Record<TopBooksPeriod, TopBook[]>;
  }

  const [salesPage, setSalesPage] = useState(1);
  const [inventoryPage] = useState(1);
  const [requestsPage, setRequestsPage] = useState(1);

  const { data: dash, isLoading } = useQuery<DashboardData>({
    queryKey: ["admin-dashboard", salesPage, inventoryPage, requestsPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        salesPage: String(salesPage),
        inventoryPage: String(inventoryPage),
        requestsPage: String(requestsPage),
      });
      const data = await fetchJsonWithSessionRetry<DashboardData>(
        supabase,
        `/api/admin/dashboard?${params}`,
        { cache: "no-store" },
        "Error al cargar dashboard"
      );
      // Una respuesta iniciada antes del DELETE no puede revivir ventas con borrado confirmado.
      const tombstones = deletedSaleIds.current;
      if (tombstones.size === 0) return data;
      const visibleSales = data.sales.data.filter((sale) => !tombstones.has(sale.id));
      return {
        ...data,
        sales: {
          ...data.sales,
          data: visibleSales,
          total: Math.max(0, data.sales.total - (data.sales.data.length - visibleSales.length)),
        },
        pendingSales: data.pendingSales.filter((sale) => !tombstones.has(sale.id)),
      };
    },
    ...STOCK_QUERY_OPTIONS,
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => () => {
    for (const timer of deletedSaleTimers.current.values()) clearTimeout(timer);
    deletedSaleTimers.current.clear();
  }, []);

  const allSales = useMemo(() => dash?.sales?.data ?? [], [dash?.sales?.data]);
  const salesTotal = dash?.sales?.total ?? 0;
  const salesPerPage = dash?.sales?.perPage ?? 100;
  const allInventory = useMemo(() => dash?.inventory?.data ?? [], [dash?.inventory?.data]);
  const allSellers = useMemo(() => dash?.sellers ?? [], [dash?.sellers]);
  const requests = useMemo(() => dash?.requests?.data ?? [], [dash?.requests?.data]);
  const requestsTotal = dash?.requests?.total ?? 0;
  const requestsPerPage = dash?.requests?.perPage ?? 50;
  const pendingSales = useMemo(() => dash?.pendingSales ?? [], [dash?.pendingSales]);
  const physicalBooks = useMemo(() => dash?.physicalBooks ?? [], [dash?.physicalBooks]);
  const salesMap = dash?.salesMap ?? {};
  const adminUserId = dash?.adminUserId ?? "";
  const adminStock = useMemo(() => dash?.adminStock ?? [], [dash?.adminStock]);
  const topBooks = dash?.topBooks ?? EMPTY_TOP_BOOKS;
  const currentTopBooks = topBooks[topBooksPeriod] ?? EMPTY_TOP_BOOKS[topBooksPeriod];
  const bestSellingBook = currentTopBooks[0] ?? null;
  const topBooksChartData = useMemo(
    () => currentTopBooks.slice(0, 8).map((book, index) => ({
      ...book,
      rank: index + 1,
      shortTitle: book.title.length > 18 ? `${book.title.slice(0, 18)}...` : book.title,
    })),
    [currentTopBooks]
  );
  const adminStockMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of adminStock) m.set(s.book_id, s.quantity);
    return m;
  }, [adminStock]);

  const assignSellerEntries = useMemo(
    () => Object.entries(assignSellerQtys)
      .map(([bookId, qty]) => [bookId, Math.min(qty, adminStockMap.get(bookId) || 0)] as [string, number])
      .filter(([, qty]) => qty > 0),
    [adminStockMap, assignSellerQtys]
  );
  const assignSellerUnits = useMemo(
    () => assignSellerEntries.reduce((sum, [, qty]) => sum + qty, 0),
    [assignSellerEntries]
  );
  const assignSelfAvailableStock = adminStockMap.get(assignSelfBookId) || 0;
  const assignSelfEffectiveQty = assignSelfBookId
    ? Math.min(Math.max(1, assignSelfQty), Math.max(1, assignSelfAvailableStock))
    : assignSelfQty;
  const openPreviewBook = useCallback((book: DashboardBookInfo | null | undefined) => {
    if (book) setPreviewBook(book);
  }, []);

  const scheduleAdminRefresh = useCallback(() => {
    if (stockWriteInFlight.current) return;
    if (realtimeRefreshTimer.current) clearTimeout(realtimeRefreshTimer.current);

    realtimeRefreshTimer.current = setTimeout(() => {
      refreshStockQueries(queryClient);
    }, 120);
  }, [queryClient]);

  const applyAssignedStockToDashboard = useCallback((
    sellerId: string,
    items: { book_id: string; quantity: number }[]
  ) => {
    const seller = allSellers.find((s) => s.id === sellerId);
    const sellerEmail = seller?.email || (sellerId === adminUserId ? "Tú" : "Desconocido");

    queryClient.setQueriesData<DashboardData>({ queryKey: ["admin-dashboard"] }, (old) => {
      if (!old) return old;

      const assigned = new Map(items.map((item) => [item.book_id, item.quantity]));
      const touchedBooks = new Set<string>();
      const now = new Date().toISOString();
      let addedRows = 0;

      const nextAdminStock = old.adminStock.map((stockItem) => {
        const qty = assigned.get(stockItem.book_id);
        if (!qty) return stockItem;
        return { ...stockItem, quantity: Math.max(0, stockItem.quantity - qty) };
      });

      const nextInventory = old.inventory.data.map((item) => {
        const qty = assigned.get(item.book_id);
        if (!qty || item.seller_id !== sellerId) return item;

        touchedBooks.add(item.book_id);
        return {
          ...item,
          quantity: (item.quantity || 0) + qty,
          updated_at: now,
        };
      });

      for (const item of items) {
        if (touchedBooks.has(item.book_id)) continue;
        const book = old.physicalBooks.find((b) => b.id === item.book_id);
        nextInventory.unshift({
          id: `local-${sellerId}-${item.book_id}`,
          seller_id: sellerId,
          book_id: item.book_id,
          quantity: item.quantity,
          updated_at: now,
          books: book
            ? { id: book.id, title: book.title, author: book.author, cover_url: book.cover_url }
            : null,
          seller: { id: sellerId, email: sellerEmail },
        });
        addedRows += 1;
      }

      return {
        ...old,
        adminStock: nextAdminStock,
        inventory: {
          ...old.inventory,
          data: nextInventory,
          total: old.inventory.total + addedRows,
        },
      };
    });
  }, [adminUserId, allSellers, queryClient]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-dashboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "seller_sales" }, () => {
        scheduleAdminRefresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "seller_inventory" }, () => {
        scheduleAdminRefresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_stock" }, () => {
        scheduleAdminRefresh();
      })
      .subscribe();
    return () => {
      if (realtimeRefreshTimer.current) clearTimeout(realtimeRefreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [scheduleAdminRefresh, supabase]);

  useEffect(() => {
    if (!adminUserId) return;

    const channel = supabase
      .channel(`admin-stock-events-${adminUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stock_events", filter: `admin_id=eq.${adminUserId}` },
        (payload) => {
          const result = stockMutationResultFromRealtime(payload);
          if (result) applyStockMutationResult(queryClient, result, { adminId: adminUserId });
          scheduleAdminRefresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [adminUserId, queryClient, scheduleAdminRefresh, supabase]);

  useEffect(() => {
    const refetch = () => {
      if (stockWriteInFlight.current) return;
      refreshStockQueries(queryClient);
    };
    const interval = setInterval(refetch, ADMIN_BACKGROUND_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [queryClient]);

  const updateStatus = useMutation({
    mutationFn: ({ id, status, tracking_number }: { id: string; status: StockRequest["status"]; tracking_number?: string }) =>
      updateStockRequestStatus(supabase, id, status, tracking_number),
    onMutate: async ({ id, status }) => {
      setPendingOps(prev => new Set(prev).add(`status-${id}`));
      await queryClient.cancelQueries({ queryKey: ["admin-dashboard"] });
      const previous = queryClient.getQueryData<DashboardData>(["admin-dashboard"]);
      queryClient.setQueryData<DashboardData>(["admin-dashboard"], (old) => {
        if (!old) return old;
        return { ...old, requests: { ...old.requests, data: old.requests.data.map((r) => r.id === id ? { ...r, status, updated_at: new Date().toISOString() } : r) } };
      });
      return { previous };
    },
    onError: (err: unknown, variables, context) => {
      if (context?.previous) queryClient.setQueryData(["admin-dashboard"], context.previous);
      toast.error(getErrorMessage(err, "Error al actualizar estado"));
    },
    onSuccess: () => { toast.success("Estado actualizado"); },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["seller-requests"] });
      queryClient.invalidateQueries({ queryKey: ["vendedor-dashboard"] });
      setPendingOps(prev => { const next = new Set(prev); next.delete(`status-${variables.id}`); return next; });
    },
  });

  const deleteRequest = useMutation({
    mutationFn: (requestId: string) => deleteStockRequestAction(requestId),
    onMutate: (requestId) => {
      setPendingOps(prev => new Set(prev).add(`del-req-${requestId}`));
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["admin-dashboard"] });
      queryClient.refetchQueries({ queryKey: ["admin-sellers"] });
      toast.success("Solicitud eliminada");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err, "Error al eliminar")),
    onSettled: (data, error, requestId) => {
      setPendingOps(prev => { const next = new Set(prev); next.delete(`del-req-${requestId}`); return next; });
    },
  });

  const markPaid = useMutation({
    mutationFn: async (saleIds: string[]) => {
      await markSalesAsPaid(supabase, saleIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      toast.success("Venta(s) marcada(s) como pagada(s)");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err, "Error al marcar pago")),
  });

  const assignSelfMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const available = adminStockMap.get(assignSelfBookId) || 0;
      if (available <= 0) throw new Error("Este libro no tiene stock disponible");
      if (assignSelfEffectiveQty > available) throw new Error("La cantidad supera el stock disponible");
      return assignStock(supabase, user.id, assignSelfBookId, assignSelfEffectiveQty);
    },
    onMutate: () => {
      stockWriteInFlight.current = true;
      if (adminUserId && assignSelfBookId && assignSelfEffectiveQty > 0) {
        applyAssignedStockToDashboard(adminUserId, [{ book_id: assignSelfBookId, quantity: assignSelfEffectiveQty }]);
      }
    },
    onSuccess: (result) => {
      applyStockMutationResult(queryClient, result, { sellerId: adminUserId, adminId: adminUserId });
      refreshStockQueries(queryClient);
      setAssignSelfBookId("");
      setAssignSelfQty(1);
      toast.success("Stock asignado a tu perfil de vendedor");
    },
    onError: (err: unknown) => {
      queryClient.refetchQueries({ queryKey: ["admin-dashboard"], type: "active" });
      toast.error(getErrorMessage(err, "Error al asignarte stock"));
    },
    onSettled: () => {
      stockWriteInFlight.current = false;
    },
  });

  const assignSellerMutation = useMutation({
    mutationFn: async () => {
      if (!assignSellerId) throw new Error("Selecciona un vendedor");
      const entries = assignSellerEntries;
      if (entries.length === 0) throw new Error("No hay cantidades asignadas");
      for (const [bookId, qty] of entries) {
        const available = adminStockMap.get(bookId) || 0;
        if (available <= 0 || qty > available) {
          throw new Error("Una cantidad seleccionada supera el stock disponible");
        }
      }
      const items = entries.map(([bookId, qty]) => ({ book_id: bookId, quantity: qty }));
      const { data, error } = await supabase.rpc("assign_stock_batch", {
        p_seller_id: assignSellerId,
        p_items: items,
      });
      if (error) throw new Error(error.message);
      const result = normalizeStockMutationResult(data);
      if (!result.success) throw new Error(result.error || "Error al asignar stock");
      return result;
    },
    onMutate: () => {
      stockWriteInFlight.current = true;
      if (assignSellerId) {
        applyAssignedStockToDashboard(
          assignSellerId,
          assignSellerEntries.map(([bookId, qty]) => ({ book_id: bookId, quantity: qty }))
        );
      }
    },
    onSuccess: (result) => {
      applyStockMutationResult(queryClient, result, { sellerId: assignSellerId, adminId: adminUserId });
      refreshStockQueries(queryClient);
      setAssignSellerQtys({});
      toast.success("Stock asignado al vendedor");
    },
    onError: (err: unknown) => {
      queryClient.refetchQueries({ queryKey: ["admin-dashboard"], type: "active" });
      toast.error(getErrorMessage(err, "Error al asignar stock"));
    },
    onSettled: () => {
      stockWriteInFlight.current = false;
    },
  });

  const removeInventory = useMutation({
    mutationFn: ({ sellerId, bookId }: { sellerId: string; bookId: string }) =>
      removeSellerInventoryAction(sellerId, bookId),
    onMutate: ({ sellerId, bookId }) => {
      setPendingOps(prev => new Set(prev).add(`del-inv-${sellerId}-${bookId}`));
    },
    onSuccess: (result) => {
      applyStockMutationResult(queryClient, result, { adminId: adminUserId });
      refreshStockQueries(queryClient);
      toast.success("Stock removido del vendedor");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err, "Error al remover stock")),
    onSettled: (data, error, { sellerId, bookId }) => {
      setPendingOps(prev => { const next = new Set(prev); next.delete(`del-inv-${sellerId}-${bookId}`); return next; });
    },
  });

  const deleteSale = useMutation({
    mutationFn: (saleId: string) => deleteSaleAction(saleId),
    onMutate: async (saleId) => {
      stockWriteInFlight.current = true;
      deletedSaleIds.current.add(saleId);
      await queryClient.cancelQueries({ queryKey: ["admin-dashboard"] });
      const previousDashboards = queryClient.getQueriesData<DashboardData>({ queryKey: ["admin-dashboard"] });
      queryClient.setQueriesData<DashboardData>({ queryKey: ["admin-dashboard"] }, (old) => {
        if (!old) return old;
        const existed = old.sales.data.some((sale) => sale.id === saleId);
        return {
          ...old,
          pendingSales: old.pendingSales.filter((sale) => sale.id !== saleId),
          sales: {
            ...old.sales,
            data: old.sales.data.filter((sale) => sale.id !== saleId),
            total: Math.max(0, old.sales.total - (existed ? 1 : 0)),
          },
        };
      });
      setPendingOps(prev => new Set(prev).add(`del-sale-${saleId}`));
      return { previousDashboards };
    },
    onSuccess: (result, saleId) => {
      applyStockMutationResult(queryClient, result, { adminId: adminUserId });
      const previousTimer = deletedSaleTimers.current.get(saleId);
      if (previousTimer) clearTimeout(previousTimer);
      deletedSaleTimers.current.set(saleId, setTimeout(() => {
        deletedSaleIds.current.delete(saleId);
        deletedSaleTimers.current.delete(saleId);
        refreshStockQueries(queryClient);
      }, 30_000));
      setTimeout(() => refreshStockQueries(queryClient), 2_500);
      toast.success("Venta eliminada y stock revertido");
    },
    onError: (err: unknown, saleId, context) => {
      deletedSaleIds.current.delete(saleId);
      for (const [queryKey, data] of context?.previousDashboards ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
      toast.error(getErrorMessage(err, "Error al eliminar venta"));
    },
    onSettled: (_data, _error, saleId) => {
      stockWriteInFlight.current = false;
      setPendingOps(prev => { const next = new Set(prev); next.delete(`del-sale-${saleId}`); return next; });
    },
  });

  const chartData = useMemo(() => {
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const dayMap = new Map<number, { inversion: number; ganancia: number }>();
      for (const sale of allSales) {
        const d = new Date(sale.sold_at);
        if (isNaN(d.getTime()) || d.getFullYear() !== year || d.getMonth() !== month) continue;
        const day = d.getDate();
        const qty = sale.quantity || 0;
        const existing = dayMap.get(day) || { inversion: 0, ganancia: 0 };
        const isSelfSale = sale.seller_id === adminUserId;
        existing.inversion += qty * ADMIN_COST_BOOK;
        existing.ganancia += isSelfSale
          ? qty * ((sale.sale_price || 0) - ADMIN_COST_BOOK)
          : qty * (COST_PER_BOOK - ADMIN_COST_BOOK);
        dayMap.set(day, existing);
      }
      return Array.from(dayMap.entries())
        .map(([day, v]) => ({ day, ...v }))
        .sort((a, b) => a.day - b.day);
    } catch (e) {
      console.error("[chartData] error:", e);
      return [];
    }
  }, [allSales, currentMonth, adminUserId]);

  const totalChartInversion = chartData.reduce((s, d) => s + d.inversion, 0);
  const totalChartGanancia = chartData.reduce((s, d) => s + d.ganancia, 0);

  const sellerLookup = useMemo(() => {
    const map = new Map<string, string>();
    if (adminUserId) map.set(adminUserId, "Tú");
    for (const s of allSellers) map.set(s.id, s.email);
    return map;
  }, [allSellers, adminUserId]);

  const inventoryBySeller = useMemo(() => {
    try {
      const map = new Map<string, { email: string; items: AdminInventoryItem[] }>();
      for (const item of allInventory) {
        if (item.quantity <= 0) continue;
        const sid = item.seller_id;
        if (!sid) continue;
        if (!map.has(sid)) map.set(sid, { email: sellerLookup.get(sid) || "Desconocido", items: [] });
        map.get(sid)!.items.push(item);
      }
      return Array.from(map.entries());
    } catch (e) {
      console.error("[inventoryBySeller] error:", e);
      return [];
    }
  }, [allInventory, sellerLookup]);

  const pendingBySeller = useMemo(() => {
    try {
      const map = new Map<string, { email: string; total: number; sales: AdminSale[] }>();
      for (const sale of pendingSales) {
        if (sale.seller_id === adminUserId) continue;
        const sid = sale.seller_id;
        if (!sid) continue;
        const email = sale.seller?.email || sellerLookup.get(sid) || "Desconocido";
        if (!map.has(sid)) map.set(sid, { email, total: 0, sales: [] });
        const entry = map.get(sid)!;
        entry.total += (sale.quantity || 0) * COST_PER_BOOK;
        entry.sales.push(sale);
      }
      return Array.from(map.entries());
    } catch (e) {
      console.error("[pendingBySeller] error:", e);
      return [];
    }
  }, [pendingSales, sellerLookup, adminUserId]);

  const filteredSelfBooks = physicalBooks.filter(
    (b) =>
      (b.title.toLowerCase().includes(assignSelfSearch.toLowerCase()) ||
      (b.author ?? "").toLowerCase().includes(assignSelfSearch.toLowerCase()))
  );

  if (isLoading && allSales.length === 0) {
    return <AdminSkeleton />;
  }

  return (
    <ErrorBoundary>
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 pl-10 md:pl-0">
          <Shield className="w-6 h-6 text-blue-500 dark:text-blue-400" />
          <span>Admin</span>
        </h1>
        <div className="flex items-center gap-2 text-xs text-white/30 bg-white/5 px-3 py-1.5 rounded-lg" suppressHydrationWarning>
          <Calendar className="w-3.5 h-3.5" />
          {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="flex gap-0 mb-6 md:hidden overflow-x-auto">
        {sections.map((sec) => {
          const Icon = sec.icon;
          return (
            <button
              key={sec.key}
              onClick={() => setActiveSection(sec.key)}
              className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-bold px-1 py-2.5 rounded-xl transition-all whitespace-nowrap ${
                activeSection === sec.key
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/20"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{sec.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-6">
        {/* Desktop sidebar tabs */}
        <aside className="hidden md:flex flex-col gap-1 w-40 shrink-0">
          {sections.map((sec) => {
            const Icon = sec.icon;
            return (
              <button
                key={sec.key}
                onClick={() => setActiveSection(sec.key)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                  activeSection === sec.key
                    ? "bg-blue-600/10 text-blue-400 border border-blue-500/10"
                    : "text-white/40 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4" />
                {sec.label}
              </button>
            );
          })}
        </aside>

        <div className="flex-1 min-w-0">
          {/* ── INGRESOS ── */}
          {activeSection === "ingresos" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={() => setActiveSection("vendidos")}
                  className="bg-white/5 border border-white/8 rounded-xl p-4 text-left hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <p className="text-lg font-bold text-green-400">${totalChartGanancia.toLocaleString("es-MX")}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Ganancia total</p>
                </button>
                <button
                  onClick={() => setActiveSection("vendidos")}
                  className="bg-white/5 border border-white/8 rounded-xl p-4 text-left hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <p className="text-lg font-bold text-blue-400">${totalChartInversion.toLocaleString("es-MX")}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Inversión total</p>
                </button>
                <button
                  onClick={() => setActiveSection("vendidos")}
                  className="bg-white/5 border border-white/8 rounded-xl p-4 text-left hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <p className="text-lg font-bold text-white/60">{allSales.reduce((s, i) => s + i.quantity, 0)}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Unidades vendidas</p>
                </button>
                <button
                  onClick={() => setActiveSection("pagos")}
                  className="bg-white/5 border border-amber-500/20 rounded-xl p-4 text-left hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <p className="text-lg font-bold text-amber-400">${pendingSales.filter((i) => i.seller_id !== adminUserId).reduce((s, i) => s + (i.quantity || 0) * COST_PER_BOOK, 0).toLocaleString("es-MX")}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Pagos pendientes</p>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                    className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-white/60" />
                  </button>
                  <span className="text-sm font-bold text-white/80 min-w-[140px] text-center">
                    {currentMonth.toLocaleDateString("es-MX", { month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase())}
                  </span>
                  <button
                    onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                    disabled={currentMonth >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)}
                    className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4 text-white/60" />
                  </button>
                </div>
              </div>

              {chartData.length === 0 ? (
                <div className="text-center py-16 text-white/30 text-sm">Sin ventas en este mes.</div>
              ) : (
                <div className="bg-[#111] border border-white/8 rounded-2xl p-5">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData} margin={{ top: 28, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 'auto']} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toLocaleString("es-MX")}`} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                      <Bar dataKey="ganancia" name="Ganancia" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={24}>
                        <LabelList dataKey="ganancia" position="top" fill="#22c55e" fontSize={10} fontWeight={700} formatter={(v) => `$${Number(v || 0).toLocaleString("es-MX")}`} />
                      </Bar>
                      <Bar dataKey="inversion" name="Inversión" fill="#60a5fa" radius={[4, 4, 0, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* ── PENDIENTES DE PAGO ── */}
              {pendingBySeller.length > 0 && (
                <div className="bg-white/5 border border-amber-500/20 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-amber-500/10 flex items-center justify-between">
                    <h2 className="font-semibold text-sm flex items-center gap-2 text-amber-400">
                      <DollarSign className="w-4 h-4" />
                      Pendientes de pago
                    </h2>
                    <button
                      onClick={() => setActiveSection("pagos")}
                      className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Ver todos
                    </button>
                  </div>
                  <div className="divide-y divide-amber-500/5">
                    {pendingBySeller.map(([sellerId, { email, total }]) => (
                      <div key={sellerId} className="px-5 py-3 flex items-center justify-between">
                        <span className="text-sm text-white/70">{email}</span>
                        <span className="text-sm font-bold text-amber-400">${total.toLocaleString("es-MX")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STOCK (todos los vendedores) ── */}
          {activeSection === "stock" && (
            <div className="space-y-5">
              {/* Asignacion de stock a vendedor */}
              <details className="bg-white/5 border border-amber-500/20 rounded-2xl overflow-hidden group">
                <summary className="px-5 py-3 bg-amber-600/5 cursor-pointer flex items-center justify-between hover:bg-amber-600/10 transition-colors">
                  <span className="font-semibold text-sm flex items-center gap-2 text-amber-400">
                    <Store className="w-4 h-4" />
                    Asignar stock a vendedor
                  </span>
                  <ChevronRight className="w-4 h-4 text-amber-400/50 group-open:rotate-90 transition-transform" />
                </summary>
                <div className="p-5 border-t border-amber-500/10 space-y-3">
                  {/* Seller selector */}
                  <select
                    value={assignSellerId}
                    onChange={(e) => {
                      setAssignSellerId(e.target.value);
                      setAssignSellerQtys({});
                    }}
                    disabled={assignSellerMutation.isPending}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="">Seleccionar vendedor...</option>
                    {allSellers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.email}{!s.assigned_admin_id ? " (demo/sin asignar)" : ""}
                      </option>
                    ))}
                  </select>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      value={assignSellerSearch}
                      onChange={(e) => setAssignSellerSearch(e.target.value)}
                      placeholder="Buscar libro..."
                      disabled={assignSellerMutation.isPending}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 outline-none focus:border-amber-500/50"
                    />
                  </div>

                  {/* Books list */}
                  {!assignSellerId ? (
                    <p className="text-sm text-white/30 py-4 text-center">Selecciona un vendedor primero</p>
                  ) : (
                    <>
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {physicalBooks
                          .filter((b) =>
                            b.title.toLowerCase().includes(assignSellerSearch.toLowerCase()) ||
                            (b.author ?? "").toLowerCase().includes(assignSellerSearch.toLowerCase())
                          )
                          .map((book) => {
                            const myStock = adminStockMap.get(book.id) || 0;
                            const qty = Math.min(assignSellerQtys[book.id] || 0, myStock);
                            const lowStock = myStock > 0 && myStock <= 3;
                            const outOfStock = myStock <= 0;
                            const isAssigningSelected = assignSellerMutation.isPending && qty > 0;
                            return (
                              <div
                                key={book.id}
                                className={`relative overflow-hidden flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                                  isAssigningSelected
                                    ? "bg-green-500/10 border border-green-500/30"
                                    : qty > 0
                                      ? "bg-amber-500/5 border border-amber-500/20"
                                    : "bg-white/5 border border-white/8 hover:bg-white/10"
                                }`}
                              >
                                {book.cover_url && (
                                  <AppImage src={book.cover_url} alt="" className="w-7 h-10 rounded object-cover bg-white/5 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{book.title}</p>
                                  <p className="text-xs text-white/40 truncate">{book.author}</p>
                                  <p className={`text-xs ${outOfStock ? "text-red-400" : lowStock ? "text-amber-400 font-medium" : "text-white/30"}`}>
                                    {outOfStock ? "Agotado" : `Stock: ${myStock} ${lowStock ? "⚠️" : ""}`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {qty > 0 ? (
                                    <>
                                      <button
                                        onClick={() =>
                                          setAssignSellerQtys((prev) => {
                                            const current = Math.min(prev[book.id] || 0, myStock);
                                            const next = Math.max(0, current - 1);
                                            const copy = { ...prev };
                                            if (next <= 0) delete copy[book.id];
                                            else copy[book.id] = next;
                                            return copy;
                                          })
                                        }
                                        disabled={assignSellerMutation.isPending}
                                        className="p-1 bg-white/5 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none"
                                      >
                                        <Minus className="w-3.5 h-3.5" />
                                      </button>
                                      <span className="text-sm font-bold text-amber-400 min-w-[2ch] text-center">{qty}</span>
                                      <button
                                        onClick={() =>
                                          setAssignSellerQtys((prev) => ({
                                            ...prev,
                                            [book.id]: Math.min(myStock, Math.min(prev[book.id] || 0, myStock) + 1),
                                          }))
                                        }
                                        disabled={assignSellerMutation.isPending || qty >= myStock}
                                        className="p-1 bg-white/5 hover:bg-green-500/20 rounded-lg transition-colors disabled:opacity-20 disabled:pointer-events-none"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        setAssignSellerQtys((prev) => ({
                                          ...prev,
                                          [book.id]: 1,
                                        }))
                                      }
                                      disabled={assignSellerMutation.isPending || outOfStock}
                                      className="text-xs font-medium px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none"
                                    >
                                      + Asignar
                                    </button>
                                  )}
                                </div>
                                {isAssigningSelected && <div className="stock-progress-line" aria-hidden="true" />}
                              </div>
                                );
                              })}
                            </div>
                            <div className="sticky bottom-0 -mx-1 pt-3 bg-[#0a0a0a]/95 backdrop-blur border-t border-amber-500/10">
                              <div className="relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-amber-500/5 border border-amber-500/15 p-3">
                                <div>
                                  <p className="text-sm font-semibold text-white">
                                    {assignSellerEntries.length > 0
                                      ? `${assignSellerUnits} unidades seleccionadas`
                                      : "Selecciona cantidades para asignar"}
                                  </p>
                                  <p className="text-xs text-white/40">
                                    El stock se moverá de tu almacén al vendedor seleccionado.
                                  </p>
                                </div>
                                <button
                                  onClick={() => assignSellerMutation.mutate()}
                                  disabled={!assignSellerId || assignSellerEntries.length === 0 || assignSellerMutation.isPending}
                                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                  {assignSellerMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                  {assignSellerMutation.isPending ? "Asignando..." : "Asignar stock"}
                                </button>
                                {assignSellerMutation.isPending && <div className="stock-progress-line" aria-hidden="true" />}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </details>

              {/* Self-assign for admin */}
              <details className="bg-white/5 border border-blue-500/20 rounded-2xl overflow-hidden group">
                <summary className="px-5 py-3 bg-blue-600/5 cursor-pointer flex items-center justify-between hover:bg-blue-600/10 transition-colors">
                  <span className="font-semibold text-sm flex items-center gap-2 text-blue-400">
                    <Plus className="w-4 h-4" />
                    Asignarme stock a mí (Admin)
                  </span>
                  <ChevronRight className="w-4 h-4 text-blue-400/50 group-open:rotate-90 transition-transform" />
                </summary>
                <div className="p-5 border-t border-blue-500/10">
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      value={assignSelfSearch}
                      onChange={(e) => setAssignSelfSearch(e.target.value)}
                      placeholder="Buscar libro físico..."
                      disabled={assignSelfMutation.isPending}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 outline-none focus:border-blue-500/50"
                    />
                  </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                    {filteredSelfBooks.map((book) => {
                      const myStock = adminStockMap.get(book.id) || 0;
                      const outOfStock = myStock <= 0;
                      const isSelfAssigningBook = assignSelfMutation.isPending && assignSelfBookId === book.id;
                      return (
                      <button
                        key={book.id}
                        onClick={() => { if (!outOfStock && !assignSelfMutation.isPending) { setAssignSelfBookId(book.id); setAssignSelfQty(Math.min(1, myStock)); } }}
                        disabled={outOfStock || assignSelfMutation.isPending}
                        className={`relative overflow-hidden w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                          isSelfAssigningBook
                            ? "bg-green-500/10 text-green-300 border border-green-500/30"
                            : outOfStock
                            ? "text-red-400/50 cursor-not-allowed"
                            : assignSelfBookId === book.id
                              ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                              : "text-white/60 hover:bg-white/5 border border-transparent"
                        }`}
                      >
                        {book.cover_url && (
                          <AppImage src={book.cover_url} alt="" className="w-6 h-9 rounded object-cover bg-white/5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-medium truncate">{book.title}</p>
                          <p className="text-xs text-white/30 truncate">{outOfStock ? "Agotado" : `Stock: ${myStock}`}</p>
                        </div>
                        {isSelfAssigningBook && <div className="stock-progress-line" aria-hidden="true" />}
                      </button>
                      );
                    })}
                    {filteredSelfBooks.length === 0 && (
                      <p className="text-sm text-white/30 py-2 text-center">Sin resultados</p>
                    )}
                  </div>
                  <div className="relative overflow-hidden flex items-center gap-3 rounded-xl">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAssignSelfQty(Math.max(1, assignSelfEffectiveQty - 1))}
                        disabled={assignSelfMutation.isPending}
                        className="p-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center font-medium">{assignSelfEffectiveQty}</span>
                      <button
                        onClick={() => setAssignSelfQty(Math.min(assignSelfEffectiveQty + 1, assignSelfAvailableStock || 1))}
                        disabled={
                          assignSelfMutation.isPending ||
                          !assignSelfBookId ||
                          assignSelfEffectiveQty >= assignSelfAvailableStock
                        }
                        className="p-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => assignSelfMutation.mutate()}
                      disabled={
                        !assignSelfBookId ||
                        assignSelfMutation.isPending ||
                        assignSelfAvailableStock <= 0 ||
                        assignSelfEffectiveQty > assignSelfAvailableStock
                      }
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {assignSelfMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {assignSelfMutation.isPending ? "Asignando..." : "Asignarme"}
                    </button>
                    {assignSelfMutation.isPending && <div className="stock-progress-line" aria-hidden="true" />}
                  </div>
                </div>
              </details>

              {inventoryBySeller.length === 0 ? (
                <div className="text-center py-16 text-white/30 text-sm">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No hay stock asignado a ningún vendedor.</p>
                </div>
              ) : (
                inventoryBySeller.map(([sellerId, { email, items }]) => (
                  <div key={sellerId} className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/8 flex items-center justify-between">
                      <h2 className="font-semibold text-sm flex items-center gap-2">
                        <Store className="w-4 h-4 text-amber-400" />
                        {email}
                      </h2>
                      <span className="text-[10px] text-white/40">{items.reduce((s, i) => s + i.quantity, 0)} uds.</span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {items.slice(0, 3).map((item) => {
                        const isRemoving = pendingOps.has(`del-inv-${sellerId}-${item.book_id}`);
                        return (
                          <div key={item.id} className="px-5 py-3 flex items-center gap-3">
                            {item.books?.cover_url && (
                              <AppImage src={item.books.cover_url} alt="" className="w-7 h-10 rounded object-cover bg-white/5 shrink-0" />
                            )}
                            <span className="text-sm text-white/70 flex-1 min-w-0 truncate">{item.books?.title || "Libro"}</span>
                            <span className="text-xs text-white/40 hidden sm:inline">{item.books?.author}</span>
                            <span className="text-sm font-bold text-white shrink-0">{item.quantity} uds.</span>
                            <button
                              onClick={() => {
                                if (window.confirm("¿Remover este stock del vendedor? El inventario regresará al almacén general.")) {
                                  removeInventory.mutate({ sellerId, bookId: item.book_id });
                                }
                              }}
                              disabled={isRemoving}
                              className="p-1.5 bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-400 rounded-lg transition-colors border border-white/10 disabled:opacity-50 shrink-0"
                            >
                              {isRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        );
                      })}
                      {items.length > 3 && (
                        <button
                          onClick={() => setStockModalSeller({ sellerId, email, items })}
                          className="w-full px-5 py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-white/5 transition-colors text-left"
                        >
                          +{items.length - 3} libros más
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── VENDIDOS (todos los vendedores) ── */}
          {activeSection === "vendidos" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={() => setActiveSection("ingresos")}
                  className="bg-white/5 border border-white/8 rounded-xl p-4 text-left hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <p className="text-lg font-bold text-white">{allSales.reduce((s, i) => s + i.quantity, 0)}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Total unidades</p>
                </button>
                <button
                  onClick={() => setActiveSection("ingresos")}
                  className="bg-white/5 border border-white/8 rounded-xl p-4 text-left hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <p className="text-lg font-bold text-green-400">${allSales.reduce((s, i) => s + (i.sale_price || 0) * (i.quantity || 0), 0).toLocaleString("es-MX")}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Ingresos totales</p>
                </button>
                <Link
                  href="/admin/vendedores"
                  className="bg-white/5 border border-white/8 rounded-xl p-4 block hover:bg-white/10 transition-colors"
                >
                  <p className="text-lg font-bold text-amber-400">{allSellers.length}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Vendedores activos</p>
                </Link>
                <button
                  onClick={() => {
                    setSoldTab("top");
                    setTopBooksView("list");
                  }}
                  className="bg-white/5 border border-blue-500/15 rounded-xl p-4 text-left hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <p className="text-lg font-bold text-blue-400">
                    {bestSellingBook ? `${bestSellingBook.units} uds.` : "0"}
                  </p>
                  <p className="text-[10px] text-white/40 mt-0.5 truncate">
                    {bestSellingBook?.title || "Libro top"}
                  </p>
                </button>
              </div>

              <div className="flex rounded-xl bg-white/5 p-1 border border-white/10 w-fit">
                <button
                  onClick={() => setSoldTab("historial")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    soldTab === "historial" ? "bg-white text-gray-950" : "text-white/50 hover:text-white"
                  }`}
                >
                  Historial
                </button>
                <button
                  onClick={() => setSoldTab("top")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    soldTab === "top" ? "bg-white text-gray-950" : "text-white/50 hover:text-white"
                  }`}
                >
                  Más vendidos
                </button>
              </div>

              {soldTab === "top" ? (
              <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="font-semibold text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      Libros más vendidos
                    </h2>
                    <p className="text-xs text-white/35 mt-1">Ranking por unidades vendidas.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex rounded-lg bg-white/5 p-0.5 border border-white/10">
                      {TOP_BOOK_PERIODS.map((period) => (
                        <button
                          key={period.key}
                          onClick={() => setTopBooksPeriod(period.key)}
                          className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition-colors ${
                            topBooksPeriod === period.key
                              ? "bg-white text-gray-950"
                              : "text-white/50 hover:text-white"
                          }`}
                        >
                          {period.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex rounded-lg bg-white/5 p-0.5 border border-white/10">
                      <button
                        onClick={() => setTopBooksView("list")}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition-colors ${
                          topBooksView === "list"
                            ? "bg-green-500 text-white"
                            : "text-white/50 hover:text-white"
                        }`}
                      >
                        <List className="w-3.5 h-3.5" />
                        Lista
                      </button>
                      <button
                        onClick={() => setTopBooksView("chart")}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition-colors ${
                          topBooksView === "chart"
                            ? "bg-green-500 text-white"
                            : "text-white/50 hover:text-white"
                        }`}
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        Gráfica
                      </button>
                    </div>
                  </div>
                </div>

                {currentTopBooks.length === 0 ? (
                  <div className="text-center py-12 text-white/30 text-sm">Sin ventas en este periodo.</div>
                ) : topBooksView === "chart" ? (
                  <div className="h-72 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={topBooksChartData}
                        layout="vertical"
                        margin={{ top: 8, right: 28, bottom: 8, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="shortTitle"
                          width={126}
                          tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                        <Bar dataKey="units" name="Unidades" fill="#22c55e" radius={[0, 4, 4, 0]} maxBarSize={24}>
                          <LabelList dataKey="units" position="right" fill="#22c55e" fontSize={11} fontWeight={700} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {currentTopBooks.map((book, index) => (
                      <div key={book.book_id} className="px-5 py-3 flex items-center gap-3">
                        <span className="w-7 text-xs font-black text-white/30 shrink-0">#{index + 1}</span>
                        {book.cover_url ? (
                          <button
                            onClick={() => setPreviewBook({
                              id: book.book_id,
                              title: book.title,
                              author: book.author,
                              cover_url: book.cover_url,
                            })}
                            className="shrink-0 p-0 border-0 bg-transparent cursor-pointer"
                          >
                            <AppImage
                              src={book.cover_url}
                              alt=""
                              className="w-9 h-12 rounded object-cover bg-white/5 hover:ring-2 hover:ring-blue-500/50 transition-all"
                            />
                          </button>
                        ) : (
                          <div className="w-9 h-12 rounded bg-white/5 border border-white/8 flex items-center justify-center text-xs font-bold text-white/30 shrink-0">
                            {book.title.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white/80 truncate">{book.title}</p>
                          <p className="text-xs text-white/35 truncate">{book.author || "Autor no registrado"}</p>
                          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-white/35">
                            <span className="rounded-full bg-white/5 px-2 py-0.5 border border-white/8">{book.sales} ventas</span>
                            {book.lastSoldAt && (
                              <span className="rounded-full bg-white/5 px-2 py-0.5 border border-white/8">
                                Última {new Date(book.lastSoldAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black text-green-400">{book.units} uds.</p>
                          <p className="text-[10px] font-semibold text-white/35">${book.revenue.toLocaleString("es-MX")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              ) : (
              allSales.length === 0 ? (
                <div className="text-center py-12 text-white/30 text-sm">Aún no hay ventas.</div>
              ) : (
                <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
                  <div className="divide-y divide-white/5">
                    {allSales.map((sale) => {
                      const isDeletingSale = pendingOps.has(`del-sale-${sale.id}`);
                      return (
                        <div key={sale.id} className="px-5 py-3 flex items-center gap-3">
                          {sale.books?.cover_url && (
                            <button onClick={() => openPreviewBook(sale.books)} className="shrink-0 p-0 border-0 bg-transparent cursor-pointer">
                              <AppImage src={sale.books.cover_url} alt="" className="w-7 h-10 rounded object-cover bg-white/5 hover:ring-2 hover:ring-blue-500/50 transition-all" />
                            </button>
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-white/70 block truncate">{sale.books?.title || "Libro"}</span>
                            <span className="text-[10px] text-white/30 block truncate">
                              {sellerLookup.get(sale.seller_id) || sale.seller?.email || "Desconocido"}
                              {sale.profile?.name ? ` · ${sale.profile.name}` : ""}
                            </span>
                          </div>
                          <span className="text-[10px] text-white/30 shrink-0">
                            {new Date(sale.sold_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                          </span>
                          <span className="text-sm font-bold text-white shrink-0">x{sale.quantity}</span>
                          <span className="text-xs font-bold text-green-400 shrink-0">
                            ${((sale.sale_price || 0) * (sale.quantity || 0)).toLocaleString("es-MX")}
                          </span>
                          <button
                            onClick={() => {
                              if (window.confirm("¿Eliminar esta venta permanentemente? El stock se revertirá al vendedor.")) {
                                deleteSale.mutate(sale.id);
                              }
                            }}
                            disabled={isDeletingSale}
                            className="p-1.5 bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-400 rounded-lg transition-colors border border-white/10 disabled:opacity-50 shrink-0"
                          >
                            {isDeletingSale ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      );
                    })}
                    </div>
                    <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between text-xs text-white/40">
                    <span>
                      Mostrando {Math.min(allSales.length, salesPerPage)} de {salesTotal} ventas
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSalesPage(p => Math.max(1, p - 1))}
                        disabled={salesPage <= 1}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-white/60">Pág. {salesPage}</span>
                      <button
                        onClick={() => setSalesPage(p => p + 1)}
                        disabled={salesPage * salesPerPage >= salesTotal}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
              )}
            </div>
          )}

          {/* ── PAGOS PENDIENTES ── */}
          {activeSection === "pagos" && (
            <div className="space-y-5">
              {pendingBySeller.length === 0 ? (
                <div className="text-center py-16 text-white/30 text-sm">
                  <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No hay pagos pendientes.</p>
                </div>
              ) : (
                pendingBySeller.map(([sellerId, { email, total, sales }]) => (
                  <div key={sellerId} className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/8 flex items-center justify-between">
                      <h2 className="font-semibold text-sm flex items-center gap-2">
                        <Store className="w-4 h-4 text-amber-400" />
                        {email}
                      </h2>
                      <span className="text-sm font-bold text-amber-400">${total.toLocaleString("es-MX")}</span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {sales.map((sale) => (
                        <div key={sale.id} className="px-5 py-3 flex items-center gap-3">
                          {sale.books?.cover_url && (
                            <button onClick={() => openPreviewBook(sale.books)} className="shrink-0 p-0 border-0 bg-transparent cursor-pointer">
                              <AppImage src={sale.books.cover_url} alt="" className="w-7 h-10 rounded object-cover bg-white/5 hover:ring-2 hover:ring-blue-500/50 transition-all" />
                            </button>
                          )}
                          <span className="text-sm text-white/70 flex-1 min-w-0 truncate">{sale.books?.title || "Libro"}</span>
                          <span className="text-[10px] text-white/30 shrink-0">
                            {new Date(sale.sold_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                          </span>
                          <span className="text-sm font-bold text-white shrink-0">x{sale.quantity}</span>
                          <span className="text-xs font-bold text-green-400 shrink-0">
                            ${((sale.quantity || 0) * COST_PER_BOOK).toLocaleString("es-MX")}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="px-5 py-3 border-t border-white/5 bg-white/[0.02]">
                      <button
                        onClick={() => markPaid.mutate(sales.map((s) => s.id))}
                        disabled={markPaid.isPending}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {markPaid.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {markPaid.isPending ? "Procesando..." : "Marcar todo como Pagado"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── SOLICITUDES ── */}
          {activeSection === "solicitudes" && (
            <div className="space-y-5">
              {requests.length === 0 ? (
                <div className="text-center py-12 text-white/30 text-sm">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No hay solicitudes de stock.</p>
            </div>
          ) : (
            <>
              {requests.map((req) => {
                  const statusInfo = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
                  const isStatusPending = pendingOps.has(`status-${req.id}`);
                  const isDeletePending = pendingOps.has(`del-req-${req.id}`);
                  return (
                    <div key={req.id} className="bg-white/5 border border-white/8 rounded-2xl p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                            <span className="text-xs text-white/30">
                              {new Date(req.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          </div>
                          <p className="text-sm text-white/50 mb-2">
                            <span className="text-white/70 font-medium">Vendedor:</span>{" "}
                            {sellerLookup.get(req.seller_id) || req.seller?.email || "Desconocido"}
                          </p>
                          <div className="space-y-0.5">
                            {(req.items ?? []).slice(0, 3).map((item) => {
                              const sellerId = req.seller_id;
                              const soldQty = salesMap[`${sellerId}:${item.book_id}`] || 0;
                              const isReceived = !!item.received_at;
                              return (
                                <div key={item.id} className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-2 min-w-0 flex-1">
                                      {item.books?.cover_url && (
                                        <button onClick={() => openPreviewBook(item.books)} className="shrink-0 p-0 border-0 bg-transparent cursor-pointer">
                                          <AppImage src={item.books.cover_url} alt="" className="w-5 h-7 rounded object-cover bg-white/5 hover:ring-2 hover:ring-blue-500/50 transition-all" />
                                        </button>
                                      )}
                                      <span className="text-white/70 truncate">{item.books?.title ?? "Libro"}</span>
                                    <span className="text-white/50 shrink-0">x{item.quantity}</span>
                                  </span>
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                                    isReceived
                                      ? soldQty >= item.quantity
                                        ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                        : soldQty > 0
                                          ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                          : "bg-green-500/10 text-green-400 border border-green-500/20"
                                      : "bg-white/5 text-white/30 border border-white/10"
                                  }`}>
                                    {isReceived
                                      ? soldQty >= item.quantity
                                        ? "Vendido"
                                        : soldQty > 0
                                          ? `Vendido ${soldQty}/${item.quantity}`
                                          : "Recibido"
                                      : "No recibido"}
                                  </span>
                                </div>
                              );
                            })}
                            {(req.items?.length ?? 0) > 3 && (
                              <button
                                onClick={() => setModalItems({ sellerId: req.seller_id, items: req.items ?? [] })}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1"
                              >
                                +{req.items!.length - 3} libros más
                              </button>
                            )}
                          </div>
                          {req.notes && <p className="text-xs text-white/30 mt-2 italic">&quot;{req.notes}&quot;</p>}
                          {req.tracking_number && (
                            <p className="text-xs text-blue-400 mt-2 flex items-center gap-1">
                              <Package className="w-3 h-3" /> Guía: {req.tracking_number}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-3">
                          {req.status === "pending" && (
                            <div className="flex flex-col items-end gap-2">
                              <input
                                value={trackingInputs[req.id] || ""}
                                onChange={(e) => setTrackingInputs(prev => ({ ...prev, [req.id]: e.target.value }))}
                                placeholder="Número de guía (opcional)"
                                className="w-full text-xs px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 outline-none focus:border-green-500/50 transition-colors"
                              />
                              <button
                                onClick={() => updateStatus.mutate({ id: req.id, status: "delivered", tracking_number: trackingInputs[req.id]?.trim() || undefined })}
                                disabled={isStatusPending}
                                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
                              >
                                {isStatusPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                {isStatusPending ? "Actualizando..." : "Marcar como Entregado"}
                              </button>
                              <button
                                onClick={() => updateStatus.mutate({ id: req.id, status: "cancelled" })}
                                disabled={isStatusPending}
                                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 rounded-lg transition-colors border border-white/10"
                              >
                                {isStatusPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                                {isStatusPending ? "Cancelando..." : "Cancelar"}
                              </button>
                            </div>
                          )}
                          <div className="w-full border-t border-white/5 pt-2 mt-1">
                            <button
                              onClick={() => {
                                if (window.confirm("¿Eliminar esta solicitud permanentemente?")) {
                                  deleteRequest.mutate(req.id);
                                }
                              }}
                              disabled={isDeletePending}
                              className="flex items-center justify-center gap-1.5 text-xs font-medium w-full px-3 py-1.5 bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-400 rounded-lg transition-colors border border-white/10 disabled:opacity-50"
                            >
                              {isDeletePending ? <Loader2 className="w-3 h-3 animate-spin text-red-400" /> : <Trash2 className="w-3 h-3" />}
                              {isDeletePending ? "Eliminando..." : "Eliminar"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              <div className="flex items-center justify-between text-xs text-white/40 pt-2">
                <span>
                  Mostrando {Math.min(requests.length, requestsPerPage)} de {requestsTotal} solicitudes
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRequestsPage(p => Math.max(1, p - 1))}
                    disabled={requestsPage <= 1}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-white/60">Pág. {requestsPage}</span>
                  <button
                    onClick={() => setRequestsPage(p => p + 1)}
                    disabled={requestsPage * requestsPerPage >= requestsTotal}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

        </div>
      </div>
    </div>
      <StockRequestItemsModal
        isOpen={!!modalItems}
        onClose={() => setModalItems(null)}
        items={modalItems?.items ?? []}
        title="Libros en solicitud"
      >
        {(item) => {
          const sellerId = modalItems?.sellerId ?? '';
          const soldQty = salesMap[`${sellerId}:${item.book_id}`] || 0;
          const isReceived = !!item.received_at;
          return (
            <div key={item.id} className="flex items-center gap-3">
              {item.books?.cover_url && (
                <button onClick={() => openPreviewBook(item.books)} className="shrink-0 p-0 border-0 bg-transparent cursor-pointer">
                  <AppImage src={item.books.cover_url} alt="" className="w-8 h-12 rounded object-cover bg-white/5 hover:ring-2 hover:ring-blue-500/50 transition-all" />
                </button>
              )}
              <span className="text-white/80 text-sm flex-1 min-w-0 truncate">
                {item.books?.title ?? "Libro"}
              </span>
              <span className="text-white font-medium text-sm shrink-0">x{item.quantity}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                isReceived
                  ? soldQty >= item.quantity
                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    : soldQty > 0
                      ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                      : "bg-green-500/10 text-green-400 border border-green-500/20"
                  : "bg-white/5 text-white/30 border border-white/10"
              }`}>
                {isReceived
                  ? soldQty >= item.quantity
                    ? "Vendido"
                    : soldQty > 0
                      ? `Vendido ${soldQty}/${item.quantity}`
                      : "Recibido"
                  : "No recibido"}
              </span>
            </div>
          );
        }}
      </StockRequestItemsModal>

      {/* Modal: stock completo por vendedor */}
      {stockModalSeller && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setStockModalSeller(null)} />
          <div className="relative bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="sticky top-0 z-10 bg-[#1a1a1a] flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Stock de {stockModalSeller.email}</h3>
              <button onClick={() => setStockModalSeller(null)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3">
              {stockModalSeller.items.map((item) => {
                const { sellerId } = stockModalSeller;
                const isRemoving = pendingOps.has(`del-inv-${sellerId}-${item.book_id}`);
                return (
                  <div key={item.id} className="flex items-center gap-3">
                    {item.books?.cover_url && (
                      <button onClick={() => openPreviewBook(item.books)} className="shrink-0 p-0 border-0 bg-transparent cursor-pointer">
                        <AppImage src={item.books.cover_url} alt="" className="w-8 h-12 rounded object-cover bg-white/5 hover:ring-2 hover:ring-blue-500/50 transition-all" />
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 text-sm truncate">{item.books?.title ?? "Libro"}</p>
                      <p className="text-white/40 text-xs truncate">{item.books?.author}</p>
                    </div>
                    <span className="text-white font-medium text-sm shrink-0">{item.quantity} uds.</span>
                    <button
                      onClick={() => {
                        if (window.confirm("¿Remover este stock del vendedor? El inventario regresará al almacén general.")) {
                          removeInventory.mutate({ sellerId, bookId: item.book_id });
                        }
                      }}
                      disabled={isRemoving}
                      className="p-1.5 bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-400 rounded-lg transition-colors border border-white/10 disabled:opacity-50 shrink-0"
                    >
                      {isRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {previewBook && (
        <BookPreviewModal book={previewBook} onClose={() => setPreviewBook(null)} />
      )}
    </ErrorBoundary>
  );
}

function AdminSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-24 bg-white/10 rounded-lg" />
        <div className="h-5 w-40 bg-white/10 rounded-lg" />
      </div>
      <div className="md:hidden flex gap-1 mb-6">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex-1 h-10 bg-white/10 rounded-xl" />
        ))}
      </div>
      <div className="flex gap-6">
        <aside className="hidden md:flex flex-col gap-1 w-40 shrink-0">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-11 bg-white/10 rounded-xl" />
          ))}
        </aside>
        <div className="flex-1 min-w-0 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-white/5 border border-white/8 rounded-xl" />
            ))}
          </div>
          <div className="h-[300px] bg-white/5 border border-white/8 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
