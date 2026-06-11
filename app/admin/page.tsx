"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { updateStockRequestStatus, COST_PER_BOOK, markSalesAsPaid, assignStock, adjustInventory } from "@/lib/sellers";
import { deleteStockRequestAction, deleteSaleAction } from "@/lib/actions/sellers";
import type { StockRequest } from "@/types/seller";
import { useState, useMemo } from "react";
import Link from "next/link";
import {
  BarChart3, Package, TrendingUp, ShoppingCart,
  Store, ChevronLeft, ChevronRight,
  Calendar, Truck, Check, Clock, Trash2, DollarSign,
  Plus, Minus, Search, Loader2, Shield,
} from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

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

  interface DashboardData {
    allSales: any[];
    allInventory: any[];
    allSellers: any[];
    requests: StockRequest[];
    pendingSales: any[];
    physicalBooks: any[];
  }

  const { data: dash, isLoading } = useQuery<DashboardData>({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/admin/dashboard");
      if (!res.ok) throw new Error("Error al cargar dashboard");
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
  });

  const allSales = dash?.allSales ?? [];
  const allInventory = dash?.allInventory ?? [];
  const allSellers = dash?.allSellers ?? [];
  const requests = dash?.requests ?? [];
  const allSalesForMap = allSales.map((s: any) => ({ seller_id: s.seller_id, book_id: s.book_id, quantity: s.quantity }));
  const pendingSales = dash?.pendingSales ?? [];
  const physicalBooks = dash?.physicalBooks ?? [];

  const salesMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of allSalesForMap) {
      const key = `${s.seller_id}:${s.book_id}`;
      map.set(key, (map.get(key) || 0) + s.quantity);
    }
    return map;
  }, [allSalesForMap]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, tracking_number }: { id: string; status: StockRequest["status"]; tracking_number?: string }) => {
      await updateStockRequestStatus(supabase, id, status, tracking_number);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      toast.success("Estado actualizado");
    },
  });

  const deleteRequest = useMutation({
    mutationFn: async (requestId: string) => {
      await deleteStockRequestAction(requestId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      toast.success("Solicitud eliminada");
    },
    onError: (err: any) => toast.error(err?.message || "Error al eliminar"),
  });

  const markPaid = useMutation({
    mutationFn: async (saleIds: string[]) => {
      await markSalesAsPaid(supabase, saleIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
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
      setAssignSelfBookId("");
      setAssignSelfQty(1);
      toast.success("Stock asignado a tu perfil de vendedor");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteSale = useMutation({
    mutationFn: async (saleId: string) => {
      await deleteSaleAction(saleId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      toast.success("Venta eliminada y stock revertido");
    },
    onError: (err: any) => toast.error(err?.message || "Error al eliminar venta"),
  });

  const adjustMutation = useMutation({
    mutationFn: async ({ inventoryId, delta }: { inventoryId: string; delta: number }) => {
      await adjustInventory(supabase, inventoryId, delta);
    },
    onMutate: async ({ inventoryId, delta }) => {
      await queryClient.cancelQueries({ queryKey: ["admin-dashboard"] });
      const prev = queryClient.getQueryData<DashboardData>(["admin-dashboard"]);
      if (prev) {
        queryClient.setQueryData<DashboardData>(["admin-dashboard"], {
          ...prev,
          allInventory: prev.allInventory
            .map((item: any) =>
              item.id === inventoryId
                ? { ...item, quantity: Math.max(0, item.quantity + delta) }
                : item
            )
            .filter((item: any) => !(item.id === inventoryId && item.quantity + delta <= 0)),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["admin-dashboard"], ctx.prev);
      toast.error("Error al ajustar stock");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });

  const chartData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const dayMap = new Map<number, { venta: number; ahorro: number; ganancia: number }>();
    for (const sale of allSales) {
      const d = new Date(sale.sold_at);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      const day = d.getDate();
      const existing = dayMap.get(day) || { venta: 0, ahorro: 0, ganancia: 0 };
      existing.venta += sale.sale_price * sale.quantity;
      existing.ahorro += sale.quantity * COST_PER_BOOK;
      existing.ganancia += (sale.sale_price - COST_PER_BOOK) * sale.quantity;
      dayMap.set(day, existing);
    }
    return Array.from(dayMap.entries())
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => a.day - b.day);
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
    const map = new Map<string, { email: string; items: any[] }>();
    for (const item of allInventory) {
      const sid = (item as any).seller_id;
      if (!map.has(sid)) map.set(sid, { email: sellerLookup.get(sid) || "Desconocido", items: [] });
      map.get(sid)!.items.push(item);
    }
    return Array.from(map.entries());
  }, [allInventory, sellerLookup]);

  const pendingBySeller = useMemo(() => {
    const map = new Map<string, { email: string; total: number; sales: any[] }>();
    for (const sale of pendingSales) {
      const sid = sale.seller_id;
      const email = (sale as any).seller?.email || sellerLookup.get(sid) || "Desconocido";
      if (!map.has(sid)) map.set(sid, { email, total: 0, sales: [] });
      const entry = map.get(sid)!;
      entry.total += sale.sale_price * sale.quantity;
      entry.sales.push(sale);
    }
    return Array.from(map.entries());
  }, [pendingSales, sellerLookup]);

  const filteredSelfBooks = physicalBooks.filter(
    (b: any) =>
      b.title.toLowerCase().includes(assignSelfSearch.toLowerCase()) ||
      b.author.toLowerCase().includes(assignSelfSearch.toLowerCase())
  );

  const handleShip = (req: StockRequest) => {
    const tracking = trackingInputs[req.id]?.trim();
    if (!tracking) { toast.error("Ingresa el número de guía"); return; }
    updateStatus.mutate({ id: req.id, status: "shipped", tracking_number: tracking });
  };

  if (isLoading && allSales.length === 0) {
    return <AdminSkeleton />;
  }

  return (
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
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setActiveSection("vendidos")}
                  className="bg-white/5 border border-white/8 rounded-xl p-4 text-left hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <p className="text-lg font-bold text-green-400">${totalChartRevenue.toLocaleString("es-MX")}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Ingresos totales</p>
                </button>
                <button
                  onClick={() => setActiveSection("vendidos")}
                  className="bg-white/5 border border-white/8 rounded-xl p-4 text-left hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <p className="text-lg font-bold text-blue-400">${totalChartProfit.toLocaleString("es-MX")}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Ganancia total</p>
                </button>
                <button
                  onClick={() => setActiveSection("vendidos")}
                  className="bg-white/5 border border-white/8 rounded-xl p-4 text-left hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <p className="text-lg font-bold text-white/60">${totalChartCost.toLocaleString("es-MX")}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Inversión ahorrada</p>
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
                      <Line type="monotone" dataKey="venta" name="Venta" stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#22c55e" }} />
                      <Line type="monotone" dataKey="ganancia" name="Ganancia" stroke="#60a5fa" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#60a5fa" }} />
                      <Line type="monotone" dataKey="ahorro" name="Ahorro" stroke="#a78bfa" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#a78bfa" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ── STOCK (todos los vendedores) ── */}
          {activeSection === "stock" && (
            <div className="space-y-5">
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
                      {items.map((item: any) => (
                        <div key={item.id} className="px-5 py-3 flex items-center gap-3">
                          {item.books?.cover_url && (
                            <img src={item.books.cover_url} alt="" className="w-7 h-10 rounded object-cover bg-white/5 shrink-0" />
                          )}
                          <span className="text-sm text-white/70 flex-1 min-w-0 truncate">{item.books?.title || "Libro"}</span>
                          <span className="text-xs text-white/40 hidden sm:inline">{item.books?.author}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => adjustMutation.mutate({ inventoryId: item.id, delta: -1 })}
                              disabled={adjustMutation.isPending}
                              className="p-1 bg-white/5 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-30"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-sm font-bold text-white min-w-[2ch] text-center">{item.quantity}</span>
                            <button
                              onClick={() => adjustMutation.mutate({ inventoryId: item.id, delta: 1 })}
                              disabled={adjustMutation.isPending}
                              className="p-1 bg-white/5 hover:bg-green-500/20 rounded-lg transition-colors disabled:opacity-30"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <span className="text-[10px] text-white/40 ml-1">uds.</span>
                          </div>
                        </div>
                      ))}
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
                  <p className="text-lg font-bold text-green-400">${allSales.reduce((s, i) => s + i.sale_price * i.quantity, 0).toLocaleString("es-MX")}</p>
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
                          ${(sale.sale_price * sale.quantity).toLocaleString("es-MX")}
                        </span>
                        <button
                          onClick={() => {
                            if (window.confirm("¿Eliminar esta venta permanentemente? El stock se revertirá al vendedor.")) {
                              deleteSale.mutate(sale.id);
                            }
                          }}
                          disabled={deleteSale.isPending}
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
                            ${(sale.sale_price * sale.quantity).toLocaleString("es-MX")}
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
                            {req.items?.map((item: any) => {
                              const sellerId = (req as any).seller_id;
                              const soldQty = salesMap.get(`${sellerId}:${item.book_id}`) || 0;
                              const isReceived = !!item.received_at;
                              return (
                                <div key={item.id} className="flex items-center justify-between text-sm">
                                  <span className="text-white/70">
                                    {(item.books as any)?.title ?? "Libro"} x{item.quantity}
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
                                placeholder="Número de guía"
                                className="w-full text-xs px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 outline-none focus:border-blue-500/50 transition-colors"
                              />
                              <button
                                onClick={() => handleShip(req)}
                                disabled={updateStatus.isPending}
                                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
                              >
                                <Truck className="w-3.5 h-3.5" /> Marcar como Enviado
                              </button>
                              <button
                                onClick={() => updateStatus.mutate({ id: req.id, status: "cancelled" })}
                                disabled={updateStatus.isPending}
                                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 rounded-lg transition-colors border border-white/10"
                              >
                                <Clock className="w-3.5 h-3.5" /> Cancelar
                              </button>
                            </div>
                          )}
                          {req.status === "shipped" && (
                            <button
                              onClick={() => updateStatus.mutate({ id: req.id, status: "delivered" })}
                              disabled={updateStatus.isPending}
                              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" /> Marcar como Entregado
                            </button>
                          )}
                          <div className="w-full border-t border-white/5 pt-2 mt-1">
                            <button
                              onClick={() => {
                                if (window.confirm("¿Eliminar esta solicitud permanentemente?")) {
                                  deleteRequest.mutate(req.id);
                                }
                              }}
                              disabled={deleteRequest.isPending}
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
