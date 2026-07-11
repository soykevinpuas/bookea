"use client";

import AppImage from "@/components/ui/AppImage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { fetchJsonWithSessionRetry } from "@/lib/auth-fetch";
import { markAsSold, COST_PER_BOOK, ADMIN_COST_BOOK } from "@/lib/sellers";
import { createStockRequestAction, receiveStockItemAction } from "@/lib/actions/sellers";
import { useAuth } from "@/lib/auth-provider";
import { Package, TrendingUp, Loader2, BarChart3, Check, DollarSign, Plus, Minus, ShoppingCart, ChevronLeft, ChevronRight, X, Search, Store, Info, Send, LayoutGrid, List, type LucideIcon } from "lucide-react";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from "recharts";
import StockRequestItemsModal from "@/components/StockRequestItemsModal";
import BookPreviewModal from "@/components/BookPreviewModal";
import type { SellerInventory, SellerSale, StockRequest } from "@/types/seller";

type Section = "stock" | "vendidos" | "ingresos" | "solicitudes";

interface DashboardData {
  inventory: SellerInventory[];
  sales: SellerSale[];
  requests: StockRequest[];
  pendingPayment: number;
  role: string;
}

type StockTab = "inventory" | "available";
type RequestViewMode = "grid" | "list";

interface RequestCartItem {
  book_id: string;
  title: string;
  quantity: number;
  max_stock: number;
}

interface RequestableBook {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  price_physical: number | null;
  stock_physical: number;
}

interface RequestableBooksResponse {
  books: RequestableBook[];
  reason: "ok" | "no_admin" | "no_stock";
}

const sections: { key: Section; label: string; icon: LucideIcon }[] = [
  { key: "ingresos", label: "Ingresos", icon: BarChart3 },
  { key: "stock", label: "Stock", icon: Package },
  { key: "vendidos", label: "Vendidos", icon: TrendingUp },
  { key: "solicitudes", label: "Solicitudes", icon: ShoppingCart },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
  shipped: { label: "Enviado", color: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
  delivered: { label: "Entregado", color: "bg-green-500/10 text-green-400 border border-green-500/20" },
  cancelled: { label: "Cancelado", color: "bg-red-500/10 text-red-400 border border-red-500/20" },
};

const STATUS_TABS = [
  { key: "all", label: "Todas" },
  { key: "pending", label: "Pendientes" },
  { key: "delivered", label: "Entregadas" },
  { key: "cancelled", label: "Canceladas" },
];

const STOCK_EXIT_ANIMATION_MS = 320;
const VENDEDOR_DASHBOARD_STALE_MS = 60 * 1000;
const VENDEDOR_BACKGROUND_REFRESH_MS = 60 * 1000;

const ChartTooltip = ({ active, payload, label }: UntypedValue) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-white/50 mb-1">{label}</p>
      {payload.map((entry: UntypedValue, i: number) => (
        <p key={i} className="font-medium" style={{ color: entry.color }}>
          {entry.name}: ${entry.value.toLocaleString("es-MX")}
        </p>
      ))}
    </div>
  );
};

export default function VendedorDashboard() {
  const supabase = useMemo(() => createClientClient(), []);
  const queryClient = useQueryClient();
  const { userId, isLoading: authLoading, isReady: authReady } = useAuth();
  const searchParams = useSearchParams();
  const [activeSection, setActiveSection] = useState<Section>("ingresos");
  const [stockTab, setStockTab] = useState<StockTab>("inventory");
  const [requestViewMode, setRequestViewMode] = useState<RequestViewMode>("grid");
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [previewBook, setPreviewBook] = useState<UntypedValue>(null);
  const stockWriteInFlight = useRef(false);

  useEffect(() => {
    const seccion = searchParams?.get("seccion");
    if (seccion === "solicitudes" || seccion === "stock" || seccion === "vendidos" || seccion === "ingresos") {
      setActiveSection(seccion);
    }
  }, [searchParams]);

  useEffect(() => {
    const channel = supabase
      .channel("vendedor-dashboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_requests" }, () => {
        if (stockWriteInFlight.current) return;
        queryClient.invalidateQueries({ queryKey: ["vendedor-dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["seller-requests", userId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "seller_sales" }, () => {
        if (stockWriteInFlight.current) return;
        queryClient.invalidateQueries({ queryKey: ["vendedor-dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["seller-sales", userId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "seller_inventory" }, () => {
        if (stockWriteInFlight.current) return;
        queryClient.invalidateQueries({ queryKey: ["vendedor-dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["seller-inventory", userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, queryClient, userId]);

  useEffect(() => {
    const refetch = () => {
      if (stockWriteInFlight.current) return;
      queryClient.invalidateQueries({ queryKey: ["vendedor-dashboard"], refetchType: "all" });
    };
    const interval = setInterval(refetch, VENDEDOR_BACKGROUND_REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === "visible") refetch(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [queryClient]);

  const [salePrices, setSalePrices] = useState<Record<string, number>>({});
  const [saleQtys, setSaleQtys] = useState<Record<string, number>>({});
  const [selling, setSelling] = useState<string | null>(null);
  const [exitingSoldBooks, setExitingSoldBooks] = useState<Set<string>>(() => new Set());
  const [receiving, setReceiving] = useState<string | null>(null);
  const [modalItems, setModalItems] = useState<UntypedValue[] | null>(null);
  const [solicitudFilter, setSolicitudFilter] = useState("all");
  const [requestSearch, setRequestSearch] = useState("");
  const [requestCart, setRequestCart] = useState<RequestCartItem[]>([]);
  const [requestNotes, setRequestNotes] = useState("");
  const dashboardQueryKey = useMemo(() => ["vendedor-dashboard", userId] as const, [userId]);
  const fetchVendedorJson = useCallback(
    <T,>(url: string, fallbackError: string) =>
      fetchJsonWithSessionRetry<T>(supabase, url, { cache: "no-store" }, fallbackError),
    [supabase]
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<DashboardData, Error>({
    queryKey: dashboardQueryKey,
    queryFn: () => fetchVendedorJson<DashboardData>("/api/vendedor/dashboard", "Error al cargar dashboard"),
    enabled: authReady && !!userId,
    staleTime: VENDEDOR_DASHBOARD_STALE_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });

  const { data: requestableData, isLoading: requestableLoading } = useQuery<RequestableBooksResponse>({
    queryKey: ["requestable-books", userId],
    queryFn: () => fetchVendedorJson<RequestableBooksResponse>("/api/vendedor/requestable-books", "No se pudieron cargar los libros"),
    enabled: authReady && !!userId && activeSection === "stock",
    staleTime: VENDEDOR_DASHBOARD_STALE_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });

  const inventory = useMemo(() => data?.inventory ?? [], [data?.inventory]);
  const sales = useMemo(() => data?.sales ?? [], [data?.sales]);
  const requests = useMemo(() => data?.requests ?? [], [data?.requests]);
  const userRole = data?.role as string | undefined;
  const isAdmin = userRole === "admin";
  const pendingPayment = isAdmin ? 0 : (data?.pendingPayment ?? 0);

  const filteredRequests = solicitudFilter === "all"
    ? requests
    : requests.filter((r) => r.status === solicitudFilter);

  const effectiveCost = isAdmin ? ADMIN_COST_BOOK : COST_PER_BOOK;
  const chartData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const dayMap = new Map<number, { venta: number; ahorro: number; ganancia: number }>();

    for (const sale of sales) {
      const d = new Date(sale.sold_at);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;

      const day = d.getDate();
      const existing = dayMap.get(day) || { venta: 0, ahorro: 0, ganancia: 0 };
      const cost = isAdmin ? ADMIN_COST_BOOK : COST_PER_BOOK;
      existing.venta += sale.sale_price * sale.quantity;
      existing.ahorro += sale.quantity * cost;
      existing.ganancia += (sale.sale_price - cost) * sale.quantity;
      dayMap.set(day, existing);
    }

    return Array.from(dayMap.entries())
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => a.day - b.day);
  }, [sales, currentMonth, isAdmin]);

  const totalChartRevenue = chartData.reduce((s, d) => s + d.venta, 0);
  const totalChartProfit = chartData.reduce((s, d) => s + d.ganancia, 0);
  const totalChartCost = chartData.reduce((s, d) => s + d.ahorro, 0);

  const activeInventory = inventory.filter((i) => i.quantity > 0);

  const inventoryByBookId = new Map(inventory.map((i) => [i.book_id, i.quantity]));
  const requestableBooks = useMemo(
    () => (requestableData?.books ?? []).filter((book) => book.stock_physical >= 1),
    [requestableData?.books]
  );
  const filteredRequestableBooks = useMemo(() => {
    const term = requestSearch.trim().toLowerCase();
    if (!term) return requestableBooks;

    return requestableBooks.filter((book) =>
      book.title?.toLowerCase().includes(term) ||
      book.author?.toLowerCase().includes(term)
    );
  }, [requestSearch, requestableBooks]);
  const requestBooksMap = useMemo(
    () => new Map(requestableBooks.map((book) => [book.id, book])),
    [requestableBooks]
  );
  const requestCartTotal = requestCart.reduce((sum, item) => sum + item.quantity, 0);

  const soldByBook = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sales) {
      map.set(s.book_id, (map.get(s.book_id) || 0) + s.quantity);
    }
    return map;
  }, [sales]);

  const addToRequestCart = (book: RequestableBook) => {
    setRequestCart((prev) => {
      const existing = prev.find((item) => item.book_id === book.id);
      if (existing) {
        return prev.map((item) =>
          item.book_id === book.id
            ? { ...item, quantity: Math.min(item.max_stock, item.quantity + 1) }
            : item
        );
      }

      return [
        ...prev,
        {
          book_id: book.id,
          title: book.title,
          quantity: 1,
          max_stock: book.stock_physical,
        },
      ];
    });
  };

  const updateRequestQty = (bookId: string, delta: number) => {
    setRequestCart((prev) =>
      prev.map((item) => {
        if (item.book_id !== bookId) return item;
        const book = requestBooksMap.get(bookId);
        const maxAllowed = book?.stock_physical ?? item.max_stock;
        return {
          ...item,
          max_stock: maxAllowed,
          quantity: Math.max(1, Math.min(maxAllowed, item.quantity + delta)),
        };
      })
    );
  };

  const removeFromRequestCart = (bookId: string) => {
    setRequestCart((prev) => prev.filter((item) => item.book_id !== bookId));
  };

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("No autenticado");
      const items = requestCart.map((item) => ({
        book_id: item.book_id,
        quantity: item.quantity,
      }));

      return createStockRequestAction(userId, items, requestNotes || undefined);
    },
    onSuccess: () => {
      setRequestCart([]);
      setRequestNotes("");
      toast.success("Solicitud creada correctamente");
      queryClient.invalidateQueries({ queryKey: ["requestable-books", userId] });
      queryClient.invalidateQueries({ queryKey: ["seller-requests", userId] });
      queryClient.invalidateQueries({ queryKey: ["vendedor-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al crear solicitud");
    },
  });

  const playSoldOutExit = useCallback(async (bookId: string) => {
    setExitingSoldBooks((prev) => {
      const next = new Set(prev);
      next.add(bookId);
      return next;
    });
    await new Promise<void>((resolve) => setTimeout(resolve, STOCK_EXIT_ANIMATION_MS));
  }, []);

  const handleSell = async (bookId: string, currentQty: number) => {
    if (!userId) { toast.error("Sesion no lista. Espera unos segundos e intenta de nuevo."); return; }
    if (stockWriteInFlight.current) return;
    const qty = saleQtys[bookId] || 1;
    const price = salePrices[bookId];
    if (!price || price <= 0) { toast.error("Agrega un precio de venta"); return; }
    if (qty < 1) { toast.error("Cantidad inválida"); return; }
    if (qty > currentQty) { toast.error("Stock insuficiente"); return; }

    stockWriteInFlight.current = true;
    setSelling(bookId);
    const saleData = {
      id: `local-${Date.now()}`,
      seller_id: userId,
      book_id: bookId,
      quantity: qty,
      sale_price: price,
      sold_at: new Date().toISOString(),
      books: inventory.find((i) => i.book_id === bookId)?.books ?? null,
      paid_at: null,
    };

    try {
      await markAsSold(supabase, userId, bookId, qty, price);
      toast.success(`Vendido${qty > 1 ? `s ${qty}` : ""} por $${(price * qty).toLocaleString("es-MX")}`);
      if (qty >= currentQty) await playSoldOutExit(bookId);
      queryClient.setQueryData<DashboardData>(dashboardQueryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          sales: [{ ...saleData }, ...old.sales],
          inventory: old.inventory.map((i) =>
            i.book_id === bookId
              ? { ...i, quantity: Math.max(0, i.quantity - qty) }
              : i
          ),
          pendingPayment: old.pendingPayment + price * qty,
        };
      });
      setSaleQtys(prev => ({ ...prev, [bookId]: 1 }));
      setSalePrices(prev => { const copy = { ...prev }; delete copy[bookId]; return copy; });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al registrar venta");
    } finally {
      setExitingSoldBooks((prev) => {
        const next = new Set(prev);
        next.delete(bookId);
        return next;
      });
      setSelling(null);
      stockWriteInFlight.current = false;
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["seller-inventory", userId] });
        queryClient.invalidateQueries({ queryKey: ["seller-sales", userId] });
        queryClient.invalidateQueries({ queryKey: ["vendedor-dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      }, 400);
    }
  };

  const handleReceive = async (itemId: string) => {
    setReceiving(itemId);
    try {
      await receiveStockItemAction(itemId);
      toast.success("Libro recibido");
      queryClient.invalidateQueries({ queryKey: ["seller-requests", userId] });
      queryClient.invalidateQueries({ queryKey: ["seller-inventory", userId] });
      queryClient.invalidateQueries({ queryKey: ["vendedor-dashboard"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al recibir");
    } finally {
      setReceiving(null);
    }
  };

  const initialDashboardLoading = authLoading || !authReady || !userId || (isLoading && inventory.length === 0);

  if (initialDashboardLoading) {
    return <VendedorSkeleton />;
  }

  if (isError && inventory.length === 0) {
    return (
      <VendedorLoadError
        message={error.message}
        isFetching={isFetching}
        onRetry={() => { void refetch(); }}
      />
    );
  }

  return (
    <div>
      <div className="flex gap-0 mb-6 md:hidden">
        {sections.map((sec) => {
          const Icon = sec.icon;
          return (
            <button
              key={sec.key}
              onClick={() => setActiveSection(sec.key)}
              className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-bold px-1 py-2.5 rounded-xl transition-all ${
                activeSection === sec.key
                  ? "bg-amber-600/20 text-amber-400 border border-amber-500/20"
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
        <aside className="hidden md:flex flex-col gap-1 w-36 shrink-0">
          {sections.map((sec) => {
            const Icon = sec.icon;
            return (
              <button
                key={sec.key}
                onClick={() => setActiveSection(sec.key)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                  activeSection === sec.key
                    ? "bg-amber-600/10 text-amber-400 border border-amber-500/10"
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
          {/* ── STOCK ── */}
          {activeSection === "stock" && (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  <button
                    onClick={() => setStockTab("inventory")}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${
                      stockTab === "inventory"
                        ? "bg-amber-600/20 text-amber-400 border border-amber-500/20"
                        : "text-white/40 hover:text-white/60 border border-transparent"
                    }`}
                  >
                    <Package className="w-3.5 h-3.5 shrink-0" />
                    Mi inventario
                  </button>
                  <button
                    onClick={() => setStockTab("available")}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${
                      stockTab === "available"
                        ? "bg-amber-600/20 text-amber-400 border border-amber-500/20"
                        : "text-white/40 hover:text-white/60 border border-transparent"
                    }`}
                  >
                    <Store className="w-3.5 h-3.5 shrink-0" />
                    Disponibles
                  </button>
                </div>

                {stockTab === "available" && (
                  <div className="text-xs font-semibold text-white/40">
                    {requestableBooks.length} físicos con stock
                  </div>
                )}
              </div>

              {stockTab === "inventory" && (
                <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/8 flex items-center justify-between">
                    <h2 className="font-semibold text-sm flex items-center gap-2">
                      <Package className="w-4 h-4 text-amber-400" />
                      En inventario ({activeInventory.length} títulos)
                    </h2>
                  </div>
                  {activeInventory.length === 0 ? (
                    <div className="text-center py-12 text-white/30 text-sm">
                      No tienes libros en inventario.
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {activeInventory.map((item) => {
                        const book = item.books;
                        const price = salePrices[item.book_id] || 0;
                        const qty = saleQtys[item.book_id] || 1;
                        const isSelling = selling === item.book_id;
                        const isExiting = exitingSoldBooks.has(item.book_id);
                        const saleControlsLocked = Boolean(selling);
                        return (
                          <div
                            key={item.id}
                            className={`relative overflow-hidden px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 transition-all duration-300 ease-out ${
                              isExiting
                                ? "translate-x-8 opacity-0"
                                : isSelling
                                  ? "translate-x-0 opacity-100 bg-green-500/[0.04]"
                                  : "translate-x-0 opacity-100"
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {book?.cover_url && (
                                <button onClick={() => setPreviewBook(book)} className="shrink-0 p-0 border-0 bg-transparent cursor-pointer">
                                  <AppImage src={book.cover_url} alt="" className="w-7 h-10 rounded object-cover bg-white/5 hover:ring-2 hover:ring-blue-500/50 transition-all" />
                                </button>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-white/90 break-words">{book?.title || "Libro"}</p>
                                <p className="text-[10px] text-white/30">Costo: ${effectiveCost.toLocaleString("es-MX")} · {item.quantity} uds.{isAdmin ? " (eres administrador)" : ""}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap sm:shrink-0 ml-10 sm:ml-0">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setSaleQtys(prev => ({ ...prev, [item.book_id]: Math.max(1, (prev[item.book_id] || 1) - 1) }))}
                                  disabled={saleControlsLocked}
                                  className="p-1 bg-white/5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-6 text-center text-xs font-bold">{qty}</span>
                                <button
                                  onClick={() => setSaleQtys(prev => ({ ...prev, [item.book_id]: Math.min(item.quantity, (prev[item.book_id] || 1) + 1) }))}
                                  disabled={saleControlsLocked}
                                  className="p-1 bg-white/5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-white/40">$</span>
                                <input
                                  type="number"
                                  value={price || ""}
                                  onChange={(e) => setSalePrices(prev => ({ ...prev, [item.book_id]: Number(e.target.value) || 0 }))}
                                  className="w-16 bg-white/5 border border-white/10 rounded-lg px-1.5 py-1 text-xs text-white outline-none focus:border-amber-500/50 transition-colors placeholder:text-white/20"
                                  placeholder="precio"
                                  min={1}
                                  disabled={saleControlsLocked}
                                />
                              </div>
                              <button
                                onClick={() => handleSell(item.book_id, item.quantity)}
                                disabled={saleControlsLocked}
                                className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-all disabled:opacity-50"
                              >
                                {isSelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />}
                                {isSelling ? "Vendiendo..." : "Vender"}
                              </button>
                            </div>
                            {(isSelling || isExiting) && <div className="stock-progress-line" aria-hidden="true" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {stockTab === "available" && (
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                          value={requestSearch}
                          onChange={(e) => setRequestSearch(e.target.value)}
                          placeholder="Buscar físico disponible..."
                          className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 outline-none focus:border-amber-500/50 transition-colors text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-1 self-start rounded-full border border-white/10 bg-white/5 p-1">
                        <button
                          type="button"
                          title="Vista de tarjetas"
                          aria-label="Vista de tarjetas"
                          onClick={() => setRequestViewMode("grid")}
                          className={`p-1.5 rounded-full transition-all ${
                            requestViewMode === "grid"
                              ? "bg-amber-600/20 text-amber-400"
                              : "text-white/40 hover:text-white/70"
                          }`}
                        >
                          <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="Vista de lista"
                          aria-label="Vista de lista"
                          onClick={() => setRequestViewMode("list")}
                          className={`p-1.5 rounded-full transition-all ${
                            requestViewMode === "list"
                              ? "bg-amber-600/20 text-amber-400"
                              : "text-white/40 hover:text-white/70"
                          }`}
                        >
                          <List className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {requestableLoading ? (
                      <div className="flex items-center justify-center py-20 bg-white/5 border border-white/8 rounded-2xl">
                        <Loader2 className="w-8 h-8 animate-spin text-white/20" />
                      </div>
                    ) : requestableData?.reason === "no_admin" ? (
                      <div className="text-center py-20 text-white/30 bg-white/5 border border-white/8 rounded-2xl">
                        <Info className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p>Este vendedor no está asignado a un administrador.</p>
                      </div>
                    ) : filteredRequestableBooks.length === 0 ? (
                      <div className="text-center py-20 text-white/30 bg-white/5 border border-white/8 rounded-2xl">
                        <Store className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p>
                          {requestableData?.reason === "no_stock"
                            ? "No hay stock físico disponible."
                            : "No encontramos libros disponibles."}
                        </p>
                      </div>
                    ) : requestViewMode === "grid" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
                        {filteredRequestableBooks.map((book) => {
                          const inCart = requestCart.find((item) => item.book_id === book.id);
                          const ownedQty = inventoryByBookId.get(book.id) || 0;
                          return (
                            <div
                              key={book.id}
                              className={`border rounded-2xl bg-white/5 p-3 transition-all ${
                                inCart ? "border-amber-500/35 bg-amber-500/8" : "border-white/8 hover:border-white/15"
                              }`}
                            >
                              <div className="flex gap-3">
                                <button
                                  onClick={() => setPreviewBook(book)}
                                  className="h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-white/5 border border-white/8"
                                >
                                  {book.cover_url ? (
                                    <Image
                                      src={book.cover_url}
                                      alt=""
                                      width={80}
                                      height={112}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center text-white/20">
                                      <Package className="w-6 h-6" />
                                    </div>
                                  )}
                                </button>

                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-white/90 leading-snug line-clamp-2">{book.title}</p>
                                  <p className="text-xs text-white/40 mt-1 truncate">{book.author}</p>
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                                      {book.stock_physical} disp.
                                    </span>
                                    {ownedQty > 0 && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10">
                                        Tienes {ownedQty}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 flex items-center justify-between gap-2">
                                {inCart ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => updateRequestQty(book.id, -1)}
                                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="w-8 text-center text-sm font-black text-white">{inCart.quantity}</span>
                                    <button
                                      onClick={() => updateRequestQty(book.id, 1)}
                                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
                                      disabled={inCart.quantity >= inCart.max_stock}
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-white/30">
                                    ${Number(book.price_physical || 0).toLocaleString("es-MX")}
                                  </span>
                                )}

                                {inCart ? (
                                  <button
                                    onClick={() => removeFromRequestCart(book.id)}
                                    className="flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    Quitar
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => addToRequestCart(book)}
                                    className="flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    Solicitar
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/5 divide-y divide-white/5">
                        {filteredRequestableBooks.map((book) => {
                          const inCart = requestCart.find((item) => item.book_id === book.id);
                          const ownedQty = inventoryByBookId.get(book.id) || 0;
                          return (
                            <div
                              key={book.id}
                              className={`p-3 flex flex-col gap-3 sm:flex-row sm:items-center transition-all ${
                                inCart ? "bg-amber-500/8" : "hover:bg-white/[0.03]"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <button
                                  onClick={() => setPreviewBook(book)}
                                  className="h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-white/5 border border-white/8"
                                >
                                  {book.cover_url ? (
                                    <Image
                                      src={book.cover_url}
                                      alt=""
                                      width={40}
                                      height={56}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center text-white/20">
                                      <Package className="w-4 h-4" />
                                    </div>
                                  )}
                                </button>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-white/90 truncate">{book.title}</p>
                                  <p className="text-xs text-white/40 truncate">{book.author}</p>
                                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                                      {book.stock_physical} disp.
                                    </span>
                                    {ownedQty > 0 && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10">
                                        Tienes {ownedQty}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-3 sm:justify-end sm:shrink-0">
                                {inCart ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => updateRequestQty(book.id, -1)}
                                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="w-8 text-center text-sm font-black text-white">{inCart.quantity}</span>
                                    <button
                                      onClick={() => updateRequestQty(book.id, 1)}
                                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
                                      disabled={inCart.quantity >= inCart.max_stock}
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-white/30">
                                    ${Number(book.price_physical || 0).toLocaleString("es-MX")}
                                  </span>
                                )}

                                {inCart ? (
                                  <button
                                    onClick={() => removeFromRequestCart(book.id)}
                                    className="flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    Quitar
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => addToRequestCart(book)}
                                    className="flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    Solicitar
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="bg-white/5 border border-white/8 rounded-2xl p-5 h-fit xl:sticky xl:top-24">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-amber-400" />
                      Solicitud ({requestCartTotal})
                    </h3>

                    {requestCart.length === 0 ? (
                      <p className="text-sm text-white/30">Selecciona libros disponibles.</p>
                    ) : (
                      <div className="space-y-2 mb-4">
                        {requestCart.map((item) => (
                          <div key={item.book_id} className="flex items-center gap-2 text-sm">
                            <span className="text-white/70 truncate flex-1">{item.title}</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => updateRequestQty(item.book_id, -1)}
                                className="p-0.5 hover:bg-white/10 rounded"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-5 text-center font-medium text-xs">{item.quantity}</span>
                              <button
                                onClick={() => updateRequestQty(item.book_id, 1)}
                                disabled={item.quantity >= item.max_stock}
                                className="p-0.5 hover:bg-white/10 rounded disabled:opacity-35 disabled:cursor-not-allowed"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <textarea
                      value={requestNotes}
                      onChange={(e) => setRequestNotes(e.target.value)}
                      placeholder="Notas opcionales..."
                      className="w-full text-xs px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 outline-none focus:border-amber-500/50 transition-colors mb-4 resize-none h-20"
                    />

                    <button
                      onClick={() => createRequestMutation.mutate()}
                      disabled={requestCart.length === 0 || createRequestMutation.isPending}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                    >
                      {createRequestMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Enviar solicitud
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── VENDIDOS ── */}
          {activeSection === "vendidos" && (
            <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/8">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  Vendidos ({sales.length} ventas)
                </h2>
              </div>
              {sales.length === 0 ? (
                <div className="text-center py-8 text-white/30 text-sm">Aún no hay ventas.</div>
              ) : (
                <div className="divide-y divide-white/5">
                   {sales.map((sale: UntypedValue) => {
                    const book = sale.books;
                    return (
                      <div key={sale.id} className="px-5 py-3 flex items-center gap-3">
                        {book?.cover_url && (
                          <button onClick={() => setPreviewBook(book)} className="shrink-0 p-0 border-0 bg-transparent cursor-pointer">
                            <AppImage src={book.cover_url} alt="" className="w-7 h-10 rounded object-cover bg-white/5 hover:ring-2 hover:ring-blue-500/50 transition-all" />
                          </button>
                        )}
                        <span className="text-sm flex-1 min-w-0 truncate text-white/80">
                          {book?.title || "Libro"}
                        </span>
                        <span className="text-[10px] text-white/30 shrink-0">
                          {new Date(sale.sold_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                        </span>
                        <span className="text-sm font-bold text-white shrink-0">
                          x{sale.quantity}
                        </span>
                        <span className="text-xs font-bold text-green-400 shrink-0">
                          ${(sale.sale_price * sale.quantity).toLocaleString("es-MX")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── INGRESOS (gráficas) ── */}
          {activeSection === "ingresos" && (
            <div className="space-y-5">
              {pendingPayment > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-400">Pendiente de pago</p>
                    <p className="text-xs text-white/40">Pago pendiente</p>
                  </div>
                  <p className="text-lg font-bold text-amber-400">${pendingPayment.toLocaleString("es-MX")}</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 border border-white/8 rounded-xl p-4">
                  <p className="text-lg font-bold text-green-400">${totalChartRevenue.toLocaleString("es-MX")}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Ingresos</p>
                </div>
                <div className="bg-white/5 border border-white/8 rounded-xl p-4">
                  <p className="text-lg font-bold text-blue-400">${totalChartProfit.toLocaleString("es-MX")}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Ganancia</p>
                </div>
                <div className="bg-white/5 border border-white/8 rounded-xl p-4">
                  <p className="text-lg font-bold text-white/60">${totalChartCost.toLocaleString("es-MX")}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Inversión ahorrada</p>
                </div>
              </div>

              {/* Month selector */}
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
                      <Bar dataKey="venta" name="Venta" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={20}>
                        <LabelList dataKey="venta" position="top" fill="#22c55e" fontSize={10} fontWeight={700} formatter={(v: UntypedValue) => `$${(v || 0).toLocaleString("es-MX")}`} />
                      </Bar>
                      <Bar dataKey="ganancia" name="Ganancia" fill="#60a5fa" radius={[4, 4, 0, 0]} maxBarSize={20}>
                        <LabelList dataKey="ganancia" position="top" fill="#60a5fa" fontSize={10} fontWeight={600} formatter={(v: UntypedValue) => `$${(v || 0).toLocaleString("es-MX")}`} />
                      </Bar>
                      <Bar dataKey="ahorro" name="Inversión ahorrada" fill="#a78bfa" radius={[4, 4, 0, 0]} maxBarSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ── SOLICITUDES ── */}
          {activeSection === "solicitudes" && (
            <div className="space-y-5">
              {!isAdmin && (
                <button
                  onClick={() => {
                    setActiveSection("stock");
                    setStockTab("available");
                  }}
                  className="w-full flex items-center justify-between bg-amber-600 hover:bg-amber-500 rounded-2xl px-5 py-4 transition-colors group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <Plus className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-white">Nueva solicitud</p>
                      <p className="text-xs text-white/60">Solicita libros físicos para tu inventario</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-white/60 transition-colors" />
                </button>
              )}

              {/* Status filter tabs */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setSolicitudFilter(tab.key)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${
                      solicitudFilter === tab.key
                        ? "bg-amber-600/20 text-amber-400 border border-amber-500/20"
                        : "text-white/40 hover:text-white/60 border border-transparent"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Mis solicitudes */}
              <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-white/8">
                  <h2 className="font-semibold text-sm flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-amber-400" />
                    Mis solicitudes ({filteredRequests.length})
                  </h2>
                </div>
                {filteredRequests.length === 0 ? (
                  <div className="text-center py-8 text-white/30 text-sm">
                    {solicitudFilter === "all" ? "Aún no hay solicitudes." : `No hay solicitudes ${STATUS_TABS.find(t => t.key === solicitudFilter)?.label.toLowerCase()}.`}
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {filteredRequests.map((req: UntypedValue) => {
                      const statusInfo = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
                      const totalItems = (req as UntypedValue).items?.reduce((s: number, i: UntypedValue) => s + i.quantity, 0) ?? 0;
                      return (
                        <div key={req.id} className="px-5 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                                {statusInfo.label}
                              </span>
                              <span className="text-[10px] text-white/30">
                                {new Date(req.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                              </span>
                            </div>
                            <span className="text-[10px] text-white/40">{totalItems} uds.</span>
                          </div>

                          <div className="space-y-1">
                            {((req as UntypedValue).items || []).slice(0, 3).map((item: UntypedValue) => {
                              const book = item.books as UntypedValue;
                              const isReceived = !!item.received_at;
                              const soldQty = soldByBook.get(item.book_id) || 0;
                              return (
                                <div key={item.id} className="flex items-center gap-2 text-xs">
                                  {book?.cover_url && (
                                    <button onClick={() => setPreviewBook(book)} className="shrink-0 p-0 border-0 bg-transparent cursor-pointer">
                                      <AppImage src={book.cover_url} alt="" className="w-5 h-7 rounded object-cover bg-white/5 hover:ring-2 hover:ring-blue-500/50 transition-all" />
                                    </button>
                                  )}
                                  <span className="text-white/60 flex-1 truncate">{book?.title || "Libro"}</span>
                                  <span className="text-white font-medium shrink-0">x{item.quantity}</span>

                                  {!isReceived && req.status === "delivered" && (
                                    <button
                                      onClick={() => handleReceive(item.id)}
                                      disabled={receiving === item.id}
                                      className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-all disabled:opacity-50 shrink-0"
                                    >
                                      {receiving === item.id ? (
                                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                      ) : (
                                        <Check className="w-2.5 h-2.5" />
                                      )}
                                      Recibir
                                    </button>
                                  )}

                                  {isReceived && (
                                    <span className={`text-[10px] font-medium flex items-center gap-1 shrink-0 ${
                                      !inventoryByBookId.has(item.book_id)
                                        ? "text-red-400"
                                        : soldQty >= item.quantity
                                          ? "text-blue-400"
                                          : soldQty > 0
                                            ? "text-purple-400"
                                            : "text-green-400"
                                    }`}>
                                      {!inventoryByBookId.has(item.book_id) ? (
                                        <X className="w-2.5 h-2.5" />
                                      ) : (
                                        <Check className="w-2.5 h-2.5" />
                                      )}
                                      {!inventoryByBookId.has(item.book_id)
                                        ? "Eliminado por admin"
                                        : soldQty >= item.quantity
                                          ? "Vendido"
                                          : soldQty > 0
                                            ? `Vendido ${soldQty}/${item.quantity}`
                                            : "En stock"}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                            {((req as UntypedValue).items?.length ?? 0) > 3 && (
                              <button
                                onClick={() => setModalItems((req as UntypedValue).items ?? [])}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1"
                              >
                                +{(req as UntypedValue).items!.length - 3} libros más
                              </button>
                            )}
                          </div>

                          {req.notes && (
                            <p className="text-[10px] text-white/20 italic mt-1">&quot;{req.notes}&quot;</p>
                          )}
                          {req.tracking_number && (
                            <p className="text-[10px] text-blue-400 mt-1">Guía: {req.tracking_number}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <StockRequestItemsModal
        isOpen={!!modalItems}
        onClose={() => setModalItems(null)}
        items={modalItems ?? []}
        title="Libros en solicitud"
      >
        {(item: UntypedValue) => {
          const soldQty = soldByBook.get(item.book_id) || 0;
          return (
            <div key={item.id} className="flex items-center gap-3">
              {item.books?.cover_url && (
                <button onClick={() => setPreviewBook(item.books)} className="shrink-0 p-0 border-0 bg-transparent cursor-pointer">
                  <AppImage src={item.books.cover_url} alt="" className="w-8 h-12 rounded object-cover bg-white/5 hover:ring-2 hover:ring-blue-500/50 transition-all" />
                </button>
              )}
              <span className="text-white/80 text-sm flex-1 min-w-0 truncate">
                {item.books?.title ?? "Libro"}
              </span>
              <span className="text-white font-medium text-sm shrink-0">x{item.quantity}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                item.received_at
                  ? soldQty >= item.quantity
                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    : soldQty > 0
                      ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                      : "bg-green-500/10 text-green-400 border border-green-500/20"
                  : "bg-white/5 text-white/30 border border-white/10"
              }`}>
                {item.received_at
                  ? soldQty >= item.quantity
                    ? "Vendido"
                    : soldQty > 0
                      ? `Vendido ${soldQty}/${item.quantity}`
                      : "En stock"
                  : "No recibido"}
              </span>
            </div>
          );
        }}
      </StockRequestItemsModal>

      {previewBook && (
        <BookPreviewModal book={previewBook} onClose={() => setPreviewBook(null)} />
      )}
    </div>
  );
}

function VendedorSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="h-8 w-32 bg-white/10 rounded-lg" />
      </div>
      <div className="flex gap-6">
        <aside className="hidden md:flex flex-col gap-1 w-36 shrink-0">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-11 bg-white/10 rounded-xl" />
          ))}
        </aside>
        <div className="flex-1 min-w-0 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-white/10 border border-white/8 rounded-xl" />
            ))}
          </div>
          <div className="h-8 w-48 bg-white/10 rounded-lg" />
          <div className="h-[300px] bg-white/10 border border-white/8 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

function VendedorLoadError({
  message,
  isFetching,
  onRetry,
}: {
  message: string;
  isFetching: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center">
        <Info className="mx-auto mb-3 h-8 w-8 text-red-300" />
        <h2 className="text-sm font-bold text-white">No se pudo cargar tu tienda</h2>
        <p className="mt-2 text-sm text-white/50">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          disabled={isFetching}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
        >
          {isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
          Reintentar
        </button>
      </div>
    </div>
  );
}
