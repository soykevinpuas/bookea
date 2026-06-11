"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { updateStockRequestStatus, COST_PER_BOOK, markSalesAsPaid, assignStock } from "@/lib/sellers";
import { deleteStockRequestAction, deleteSaleAction } from "@/lib/actions/sellers";
import type { StockRequest } from "@/types/seller";
import { useState, useMemo, useEffect } from "react";

const ADMIN_COST_BOOK = 100;
import Link from "next/link";
import {
  BarChart3, Package, TrendingUp, ShoppingCart,
  Store, ChevronLeft, ChevronRight,
  Calendar, Truck, Check, Clock, Trash2, DollarSign,
  Plus, Minus, Search, Loader2, Shield, AlertTriangle, X,
} from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import ErrorBoundary from "@/components/ErrorBoundary";
import StockRequestItemsModal from "@/components/StockRequestItemsModal";

type Section = "ingresos" | "stock" | "vendidos" | "solicitudes" | "pagos";

const sections: { key: Section; label: string; icon: any }[] = [
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

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-white/50 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="font-medium" style={{ color: entry.color }}>
          {entry.name}: ${entry.value.toLocaleString("es-MX")}
        </p>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const supabase = createClientClient();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<Section>("ingresos");
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [assignSelfBookId, setAssignSelfBookId] = useState("");
  const [assignSelfQty, setAssignSelfQty] = useState(1);
  const [assignSelfSearch, setAssignSelfSearch] = useState("");
  const [assignSellerId, setAssignSellerId] = useState("");
  const [assignSellerQtys, setAssignSellerQtys] = useState<Record<string, number>>({});
  const [assignSellerSearch, setAssignSellerSearch] = useState("");
  const [pendingOps, setPendingOps] = useState<Set<string>>(new Set());
  const [modalItems, setModalItems] = useState<any[] | null>(null);
  const [stockModalSeller, setStockModalSeller] = useState<{email: string; items: any[]} | null>(null);
  interface DashboardData {
    allSales: any[];
    allInventory: any[];
    allSellers: any[];
    requests: StockRequest[];
    pendingSales: any[];
    physicalBooks: any[];
  }

  const { data: dash, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/admin/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error("Error al cargar dashboard");
      const data = await res.json();
      console.log("ADMIN DASHBOARD RAW RESPONSE:", data);
      return data;
    },
    staleTime: 0,
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-dashboard-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "seller_sales" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "seller_inventory" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, queryClient]);

  useEffect(() => {
    const interval = setInterval(() => { refetch(); }, 5000);
    const onVisible = () => { if (document.visibilityState === "visible") refetch(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [refetch]);

  const allSales = dash?.allSales ?? [];
  const allInventory = dash?.allInventory ?? [];
  const allSellers = dash?.allSellers ?? [];
  const requests = dash?.requests ?? [];
  const pendingSales = dash?.pendingSales ?? [];
  const physicalBooks = dash?.physicalBooks ?? [];
  const salesMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of allSales) {
      const key = `${s.seller_id}:${s.book_id}`;
      map.set(key, (map.get(key) || 0) + (s.quantity || 0));
    }
    return map;
  }, [allSales]);

  const updateStatus = useMutation({
    mutationFn: ({ id, status, tracking_number }: { id: string; status: StockRequest["status"]; tracking_number?: string }) =>
      updateStockRequestStatus(supabase, id, status, tracking_number),
    onMutate: async ({ id, status }) => {
      setPendingOps(prev => new Set(prev).add(`status-${id}`));
      await queryClient.cancelQueries({ queryKey: ["admin-dashboard"] });
      const previous = queryClient.getQueryData<DashboardData>(["admin-dashboard"]);
      queryClient.setQueryData<DashboardData>(["admin-dashboard"], (old) => {
        if (!old) return old;
        return { ...old, requests: old.requests.map((r) => r.id === id ? { ...r, status, updated_at: new Date().toISOString() } : r) };
      });
      return { previous };
    },
    onError: (err: any, variables, context) => {
      if (context?.previous) queryClient.setQueryData(["admin-dashboard"], context.previous);
      toast.error(err?.message || "Error al actualizar estado");
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
    mutationFn: async (requestId: string) => {
      setPendingOps(prev => new Set(prev).add(`del-req-${requestId}`));
      await deleteStockRequestAction(requestId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      toast.success("Solicitud eliminada");
    },
    onError: (err: any) => toast.error(err?.message || "Error al eliminar"),
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
    onError: (err: any) => toast.error(err?.message || "Error al marcar pago"),
  });

  const assignSelfMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      await assignStock(supabase, user.id, assignSelfBookId, assignSelfQty);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      setAssignSelfBookId("");
      setAssignSelfQty(1);
      toast.success("Stock asignado a tu perfil de vendedor");
    },
    onError: (err) => toast.error(err.message),
  });

  const assignSellerMutation = useMutation({
    mutationFn: async () => {
      if (!assignSellerId) throw new Error("Selecciona un vendedor");
      const entries = Object.entries(assignSellerQtys).filter(([, qty]) => qty > 0);
      if (entries.length === 0) throw new Error("No hay cantidades asignadas");
      await Promise.all(
        entries.map(([bookId, qty]) =>
          assignStock(supabase, assignSellerId, bookId, qty)
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      setAssignSellerQtys({});
      toast.success("Stock asignado al vendedor");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteSale = useMutation({
    mutationFn: async (saleId: string) => {
      setPendingOps(prev => new Set(prev).add(`del-sale-${saleId}`));
      await deleteSaleAction(saleId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      toast.success("Venta eliminada y stock revertido");
    },
    onError: (err: any) => toast.error(err?.message || "Error al eliminar venta"),
    onSettled: (data, error, saleId) => {
      setPendingOps(prev => { const next = new Set(prev); next.delete(`del-sale-${saleId}`); return next; });
    },
  });

  const chartData = useMemo(() => {
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const dayMap = new Map<number, { venta: number; ahorro: number; ganancia: number }>();
      for (const sale of allSales) {
        const d = new Date(sale.sold_at);
        if (isNaN(d.getTime()) || d.getFullYear() !== year || d.getMonth() !== month) continue;
        const day = d.getDate();
        const qty = sale.quantity || 0;
        const existing = dayMap.get(day) || { venta: 0, ahorro: 0, ganancia: 0 };
        existing.venta += qty * COST_PER_BOOK;
        existing.ahorro += qty * ADMIN_COST_BOOK;
        existing.ganancia += qty * (COST_PER_BOOK - ADMIN_COST_BOOK);
        dayMap.set(day, existing);
      }
      return Array.from(dayMap.entries())
        .map(([day, v]) => ({ day, ...v }))
        .sort((a, b) => a.day - b.day);
    } catch (e) {
      console.error("[chartData] error:", e);
      return [];
    }
  }, [allSales, currentMonth]);

  const totalChartRevenue = chartData.reduce((s, d) => s + d.venta, 0);
  const totalChartProfit = chartData.reduce((s, d) => s + d.ganancia, 0);
  const totalChartCost = chartData.reduce((s, d) => s + d.ahorro, 0);

  const sellerLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of allSellers) map.set(s.id, s.email);
    return map;
  }, [allSellers]);

  const inventoryBySeller = useMemo(() => {
    try {
      const map = new Map<string, { email: string; items: any[] }>();
      for (const item of allInventory) {
        if (item.quantity <= 0) continue;
        const sid = (item as any).seller_id;
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
      const map = new Map<string, { email: string; total: number; sales: any[] }>();
      for (const sale of pendingSales) {
        const sid = sale.seller_id;
        if (!sid) continue;
        const email = (sale as any).seller?.email || sellerLookup.get(sid) || "Desconocido";
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
  }, [pendingSales, sellerLookup]);

  const filteredSelfBooks = physicalBooks.filter(
    (b: any) =>
      b.title.toLowerCase().includes(assignSelfSearch.toLowerCase()) ||
      b.author.toLowerCase().includes(assignSelfSearch.toLowerCase())
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
                  <p className="text-lg font-bold text-green-400">${totalChartRevenue.toLocaleString("es-MX")}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Ingresos de vendedores</p>
                </button>
                <button
                  onClick={() => setActiveSection("vendidos")}
                  className="bg-white/5 border border-white/8 rounded-xl p-4 text-left hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <p className="text-lg font-bold text-blue-400">${totalChartProfit.toLocaleString("es-MX")}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Ganancia de admin</p>
                </button>
                <button
                  onClick={() => setActiveSection("vendidos")}
                  className="bg-white/5 border border-white/8 rounded-xl p-4 text-left hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <p className="text-lg font-bold text-white/60">${totalChartCost.toLocaleString("es-MX")}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Pagos de vendedores</p>
                </button>
                <button
                  onClick={() => setActiveSection("pagos")}
                  className="bg-white/5 border border-amber-500/20 rounded-xl p-4 text-left hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <p className="text-lg font-bold text-amber-400">${pendingSales.reduce((s: number, i: any) => s + (i.quantity || 0) * COST_PER_BOOK, 0).toLocaleString("es-MX")}</p>
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
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toLocaleString("es-MX")}`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line type="monotone" dataKey="venta" name="Ingresos vendedores" stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#22c55e" }} />
                      <Line type="monotone" dataKey="ganancia" name="Ganancia admin" stroke="#60a5fa" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#60a5fa" }} />
                      <Line type="monotone" dataKey="ahorro" name="Pagos vendedores" stroke="#a78bfa" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#a78bfa" }} />
                    </LineChart>
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
                    {pendingBySeller.map(([sellerId, { email, total, sales }]) => (
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
              {/* Assign to any seller */}
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
                    onChange={(e) => setAssignSellerId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="">Seleccionar vendedor...</option>
                    {allSellers.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.email}</option>
                    ))}
                  </select>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      value={assignSellerSearch}
                      onChange={(e) => setAssignSellerSearch(e.target.value)}
                      placeholder="Buscar libro..."
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 outline-none focus:border-amber-500/50"
                    />
                  </div>

                  {/* Books table */}
                  {!assignSellerId ? (
                    <p className="text-sm text-white/30 py-4 text-center">Selecciona un vendedor primero</p>
                  ) : (
                    <>
                      <div className="divide-y divide-white/5 max-h-80 overflow-y-auto border border-white/8 rounded-xl">
                        {physicalBooks
                          .filter((b: any) => b.stock_physical > 0)
                          .filter((b: any) =>
                            b.title.toLowerCase().includes(assignSellerSearch.toLowerCase()) ||
                            b.author.toLowerCase().includes(assignSellerSearch.toLowerCase())
                          )
                          .map((book: any) => {
                            const qty = assignSellerQtys[book.id] || 0;
                            const lowStock = book.stock_physical <= 3;
                            return (
                              <div key={book.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/3 transition-colors">
                                {book.cover_url && (
                                  <img src={book.cover_url} alt="" className="w-6 h-9 rounded object-cover bg-white/5 shrink-0" />
                                )}
                                <span className="text-sm text-white/70 flex-1 min-w-0 truncate">{book.title}</span>
                                <span className={`text-xs shrink-0 ${lowStock ? "text-red-400 font-medium" : "text-white/30"}`}>
                                  {book.stock_physical} uds.{lowStock ? " ⚠️" : ""}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() =>
                                      setAssignSellerQtys((prev) => {
                                        const current = prev[book.id] || 0;
                                        const next = Math.max(0, current - 1);
                                        const copy = { ...prev };
                                        if (next <= 0) delete copy[book.id];
                                        else copy[book.id] = next;
                                        return copy;
                                      })
                                    }
                                    className="p-0.5 bg-white/5 hover:bg-red-500/20 rounded transition-colors"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="text-sm font-bold text-white min-w-[2ch] text-center">{qty}</span>
                                  <button
                                    onClick={() =>
                                      setAssignSellerQtys((prev) => ({
                                        ...prev,
                                        [book.id]: Math.min(book.stock_physical, (prev[book.id] || 0) + 1),
                                      }))
                                    }
                                    disabled={qty >= book.stock_physical}
                                    className="p-0.5 bg-white/5 hover:bg-green-500/20 rounded transition-colors disabled:opacity-20 disabled:pointer-events-none"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      {/* Summary + Assign button */}
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-white/40">
                          {Object.values(assignSellerQtys).reduce((s, q) => s + q, 0)} uds. por asignar
                        </span>
                        <button
                          onClick={() => assignSellerMutation.mutate()}
                          disabled={
                            !assignSellerId ||
                            Object.values(assignSellerQtys).reduce((s, q) => s + q, 0) === 0 ||
                            assignSellerMutation.isPending
                          }
                          className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                        >
                          {assignSellerMutation.isPending ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Asignando...
                            </span>
                          ) : (
                            `Asignar todo (${Object.values(assignSellerQtys).reduce((s, q) => s + q, 0)} uds.)`
                          )}
                        </button>
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
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto mb-3 space-y-1">
                    {filteredSelfBooks.map((book: any) => (
                      <button
                        key={book.id}
                        onClick={() => setAssignSelfBookId(book.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          assignSelfBookId === book.id
                            ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                            : "text-white/60 hover:bg-white/5 border border-transparent"
                        }`}
                      >
                        <span className="font-medium">{book.title}</span>
                        <span className="text-white/30 ml-2">({book.author})</span>
                        <span className="text-white/20 text-xs ml-2">Stock: {book.stock_physical}</span>
                      </button>
                    ))}
                    {filteredSelfBooks.length === 0 && (
                      <p className="text-sm text-white/30 py-2 text-center">Sin resultados</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAssignSelfQty(Math.max(1, assignSelfQty - 1))}
                        className="p-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center font-medium">{assignSelfQty}</span>
                      <button
                        onClick={() => setAssignSelfQty(assignSelfQty + 1)}
                        className="p-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => assignSelfMutation.mutate()}
                      disabled={!assignSelfBookId || assignSelfMutation.isPending}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {assignSelfMutation.isPending ? "Asignando..." : "Asignarme"}
                    </button>
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
                      {items.slice(0, 3).map((item: any) => (
                        <div key={item.id} className="px-5 py-3 flex items-center gap-3">
                          {item.books?.cover_url && (
                            <img src={item.books.cover_url} alt="" className="w-7 h-10 rounded object-cover bg-white/5 shrink-0" />
                          )}
                          <span className="text-sm text-white/70 flex-1 min-w-0 truncate">{item.books?.title || "Libro"}</span>
                          <span className="text-xs text-white/40 hidden sm:inline">{item.books?.author}</span>
                          <span className="text-sm font-bold text-white shrink-0">{item.quantity} uds.</span>
                        </div>
                      ))}
                      {items.length > 3 && (
                        <button
                          onClick={() => setStockModalSeller({ email, items })}
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
              <div className="grid grid-cols-3 gap-3">
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
              </div>

              {allSales.length === 0 ? (
                <div className="text-center py-12 text-white/30 text-sm">Aún no hay ventas.</div>
              ) : (
                <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
                  <div className="divide-y divide-white/5">
                    {allSales.slice(0, 100).map((sale: any) => (
                      <div key={sale.id} className="px-5 py-3 flex items-center gap-3">
                        {sale.books?.cover_url && (
                          <img src={sale.books.cover_url} alt="" className="w-7 h-10 rounded object-cover bg-white/5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-white/70 block truncate">{sale.books?.title || "Libro"}</span>
                          <span className="text-[10px] text-white/30 block truncate">
                            {(sale as any).seller?.email ?? "Desconocido"}
                            {(sale as any).profile?.name ? ` · ${(sale as any).profile.name}` : ""}
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
                          disabled={pendingOps.has(`del-sale-${sale.id}`)}
                          className="p-1.5 bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-400 rounded-lg transition-colors border border-white/10 disabled:opacity-50 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
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
                      {sales.map((sale: any) => (
                        <div key={sale.id} className="px-5 py-3 flex items-center gap-3">
                          {sale.books?.cover_url && (
                            <img src={sale.books.cover_url} alt="" className="w-7 h-10 rounded object-cover bg-white/5 shrink-0" />
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
                        onClick={() => markPaid.mutate(sales.map((s: any) => s.id))}
                        disabled={markPaid.isPending}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
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
                requests.map((req) => {
                  const statusInfo = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
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
                            {(req.seller as any)?.email ?? "Desconocido"}
                          </p>
                          <div className="space-y-0.5">
                            {(req.items ?? []).slice(0, 3).map((item: any) => {
                              const sellerId = (req as any).seller_id;
                              const soldQty = salesMap.get(`${sellerId}:${item.book_id}`) || 0;
                              const isReceived = !!item.received_at;
                              return (
                                <div key={item.id} className="flex items-center justify-between text-sm">
                                  <span className="flex items-center gap-2 min-w-0 flex-1">
                                    {(item.books as any)?.cover_url && (
                                      <img src={(item.books as any).cover_url} alt="" className="w-5 h-7 rounded object-cover bg-white/5 shrink-0" />
                                    )}
                                    <span className="text-white/70 truncate">{(item.books as any)?.title ?? "Libro"}</span>
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
                                onClick={() => setModalItems(req.items ?? [])}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1"
                              >
                                +{req.items!.length - 3} libros más
                              </button>
                            )}
                          </div>
                          {req.notes && <p className="text-xs text-white/30 mt-2 italic">"{req.notes}"</p>}
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
                                disabled={pendingOps.has(`status-${req.id}`)}
                                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" /> Marcar como Entregado
                              </button>
                              <button
                                onClick={() => {
                                  setPendingOps(prev => new Set(prev).add(`status-${req.id}`));
                                  updateStatus.mutate({ id: req.id, status: "cancelled" });
                                }}
                                disabled={pendingOps.has(`status-${req.id}`)}
                                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 rounded-lg transition-colors border border-white/10"
                              >
                                <Clock className="w-3.5 h-3.5" /> Cancelar
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
                              disabled={pendingOps.has(`del-req-${req.id}`)}
                              className="flex items-center justify-center gap-1.5 text-xs font-medium w-full px-3 py-1.5 bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-400 rounded-lg transition-colors border border-white/10 disabled:opacity-50"
                            >
                              <Trash2 className="w-3 h-3" /> Eliminar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
      <StockRequestItemsModal
        isOpen={!!modalItems}
        onClose={() => setModalItems(null)}
        items={modalItems ?? []}
        title="Libros en solicitud"
      >
        {(item: any) => {
          const sellerId = (item as any).seller_id ?? (item as any).request_seller_id;
          const soldQty = salesMap.get(`${sellerId}:${item.book_id}`) || 0;
          const isReceived = !!item.received_at;
          return (
            <div key={item.id} className="flex items-center gap-3">
              {item.books?.cover_url && (
                <img src={item.books.cover_url} alt="" className="w-8 h-12 rounded object-cover bg-white/5 shrink-0" />
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
              {stockModalSeller.items.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3">
                  {item.books?.cover_url && (
                    <img src={item.books.cover_url} alt="" className="w-8 h-12 rounded object-cover bg-white/5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-sm truncate">{item.books?.title ?? "Libro"}</p>
                    <p className="text-white/40 text-xs truncate">{item.books?.author}</p>
                  </div>
                  <span className="text-white font-medium text-sm shrink-0">{item.quantity} uds.</span>
                </div>
              ))}
            </div>
          </div>
        </div>
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
