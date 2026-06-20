"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { markAsSold, COST_PER_BOOK, ADMIN_COST_BOOK } from "@/lib/sellers";
import { receiveStockItemAction } from "@/lib/actions/sellers";
import { useUserId } from "@/hooks/useUser";
import { Store, Package, TrendingUp, Loader2, BarChart3, Check, DollarSign, Plus, Minus, ShoppingCart, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from "recharts";
import StockRequestItemsModal from "@/components/StockRequestItemsModal";

type Section = "stock" | "vendidos" | "ingresos" | "solicitudes";

interface DashboardData {
  inventory: any[];
  sales: any[];
  requests: any[];
  pendingPayment: number;
  role: string;
}

const sections: { key: Section; label: string; icon: any }[] = [
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
};

export default function VendedorDashboard() {
  const supabase = createClientClient();
  const queryClient = useQueryClient();
  const { userId } = useUserId();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeSection, setActiveSection] = useState<Section>("ingresos");
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

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
        queryClient.invalidateQueries({ queryKey: ["vendedor-dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["seller-requests", userId] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "seller_sales" }, () => {
        queryClient.invalidateQueries({ queryKey: ["vendedor-dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["seller-sales", userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, queryClient, userId]);

  useEffect(() => {
    const refetch = () => queryClient.invalidateQueries({ queryKey: ["vendedor-dashboard"], refetchType: "all" });
    const interval = setInterval(refetch, 5000);
    const onVisible = () => { if (document.visibilityState === "visible") refetch(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [queryClient]);

  const [salePrices, setSalePrices] = useState<Record<string, number>>({});
  const [saleQtys, setSaleQtys] = useState<Record<string, number>>({});
  const [selling, setSelling] = useState<string | null>(null);
  const [receiving, setReceiving] = useState<string | null>(null);
  const [modalItems, setModalItems] = useState<any[] | null>(null);
  const [solicitudFilter, setSolicitudFilter] = useState("all");

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["vendedor-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/vendedor/dashboard");
      if (!res.ok) throw new Error("Error al cargar dashboard");
      return res.json();
    },
    staleTime: 0,
  });

  const inventory = data?.inventory ?? ([] as any[]);
  const sales = data?.sales ?? ([] as any[]);
  const requests = data?.requests ?? ([] as any[]);
  const userRole = data?.role as string | undefined;
  const isAdmin = userRole === "admin";
  const pendingPayment = isAdmin ? 0 : (data?.pendingPayment ?? 0);

  const filteredRequests = solicitudFilter === "all"
    ? requests
    : requests.filter((r: any) => r.status === solicitudFilter);

  const effectiveCost = isAdmin ? ADMIN_COST_BOOK : COST_PER_BOOK;
  const totalRevenue = sales.reduce((s: number, i: any) => s + i.sale_price * i.quantity, 0);
  const totalProfit = totalRevenue - sales.reduce((s: number, i: any) => s + i.quantity * effectiveCost, 0);

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

  const activeInventory = inventory.filter((i: any) => i.quantity > 0);

  const inventoryByBookId = new Map(inventory.map((i: any) => [i.book_id, i.quantity]));

  const soldByBook = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sales) {
      map.set(s.book_id, (map.get(s.book_id) || 0) + s.quantity);
    }
    return map;
  }, [sales]);

  const handleSell = async (bookId: string, currentQty: number) => {
    const qty = saleQtys[bookId] || 1;
    const price = salePrices[bookId];
    if (!price || price <= 0) { toast.error("Agrega un precio de venta"); return; }
    if (qty < 1) { toast.error("Cantidad inválida"); return; }
    if (qty > currentQty) { toast.error("Stock insuficiente"); return; }

    setSelling(bookId);
    const saleData = { id: `optimistic-${Date.now()}`, seller_id: userId!, book_id: bookId, quantity: qty, sale_price: price, sold_at: new Date().toISOString(), books: inventory.find(i => i.book_id === bookId)?.books ?? null, paid_at: null };
    const prevDashboard = queryClient.getQueryData<DashboardData>(["vendedor-dashboard"]);
    queryClient.setQueryData<DashboardData>(["vendedor-dashboard"], (old) => {
      if (!old) return old;
      return {
        ...old,
        sales: [{ ...saleData }, ...old.sales],
        inventory: old.inventory.map((i: any) => i.book_id === bookId ? { ...i, quantity: i.quantity - qty } : i),
        pendingPayment: old.pendingPayment + price * qty,
      };
    });
    try {
      await markAsSold(supabase, userId!, bookId, qty, price);
      toast.success(`Vendido${qty > 1 ? `s ${qty}` : ""} por $${(price * qty).toLocaleString("es-MX")}`);
      setSaleQtys(prev => ({ ...prev, [bookId]: 1 }));
      setSalePrices(prev => { const copy = { ...prev }; delete copy[bookId]; return copy; });
    } catch (e: any) {
      queryClient.setQueryData<DashboardData>(["vendedor-dashboard"], prevDashboard);
      toast.error(e.message || "Error al registrar venta");
    } finally {
      queryClient.invalidateQueries({ queryKey: ["seller-inventory", userId] });
      queryClient.invalidateQueries({ queryKey: ["seller-sales", userId] });
      queryClient.invalidateQueries({ queryKey: ["vendedor-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      setSelling(null);
    }
  };

  const handleReceive = async (itemId: string, requestId: string) => {
    setReceiving(itemId);
    try {
      await receiveStockItemAction(itemId, requestId);
      toast.success("Libro recibido");
      queryClient.invalidateQueries({ queryKey: ["seller-requests", userId] });
      queryClient.invalidateQueries({ queryKey: ["seller-inventory", userId] });
      queryClient.invalidateQueries({ queryKey: ["vendedor-dashboard"] });
    } catch (e: any) {
      toast.error(e.message || "Error al recibir");
    } finally {
      setReceiving(null);
    }
  };

  if (isLoading && inventory.length === 0) {
    return <VendedorSkeleton />;
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
                    return (
                      <div key={item.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {book?.cover_url && (
                            <img src={book.cover_url} alt="" className="w-7 h-10 rounded object-cover bg-white/5 shrink-0" />
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
                              className="p-1 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center text-xs font-bold">{qty}</span>
                            <button
                              onClick={() => setSaleQtys(prev => ({ ...prev, [item.book_id]: Math.min(item.quantity, (prev[item.book_id] || 1) + 1) }))}
                              className="p-1 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
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
                            />
                          </div>
                          <button
                            onClick={() => handleSell(item.book_id, item.quantity)}
                            disabled={isSelling}
                            className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-all disabled:opacity-50"
                          >
                            {isSelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />}
                            Vender
                          </button>
                        </div>
                      </div>
                    );
                  })}
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
                   {sales.map((sale: any) => {
                    const book = sale.books;
                    return (
                      <div key={sale.id} className="px-5 py-3 flex items-center gap-3">
                        {book?.cover_url && (
                          <img src={book.cover_url} alt="" className="w-7 h-10 rounded object-cover bg-white/5 shrink-0" />
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
                        <LabelList dataKey="venta" position="top" fill="#22c55e" fontSize={10} fontWeight={700} formatter={(v: any) => `$${(v || 0).toLocaleString("es-MX")}`} />
                      </Bar>
                      <Bar dataKey="ganancia" name="Ganancia" fill="#60a5fa" radius={[4, 4, 0, 0]} maxBarSize={20}>
                        <LabelList dataKey="ganancia" position="top" fill="#60a5fa" fontSize={10} fontWeight={600} formatter={(v: any) => `$${(v || 0).toLocaleString("es-MX")}`} />
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
                <Link
                  href="/vendedor/solicitudes/nueva"
                  className="flex items-center justify-between bg-amber-600 hover:bg-amber-500 rounded-2xl px-5 py-4 transition-colors group"
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
                </Link>
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
                    {filteredRequests.map((req: any) => {
                      const statusInfo = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
                      const totalItems = (req as any).items?.reduce((s: number, i: any) => s + i.quantity, 0) ?? 0;
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
                            {((req as any).items || []).slice(0, 3).map((item: any) => {
                              const book = item.books as any;
                              const isReceived = !!item.received_at;
                              const soldQty = soldByBook.get(item.book_id) || 0;
                              return (
                                <div key={item.id} className="flex items-center gap-2 text-xs">
                                  {book?.cover_url && (
                                    <img src={book.cover_url} alt="" className="w-5 h-7 rounded object-cover bg-white/5 shrink-0" />
                                  )}
                                  <span className="text-white/60 flex-1 truncate">{book?.title || "Libro"}</span>
                                  <span className="text-white font-medium shrink-0">x{item.quantity}</span>

                                  {!isReceived && req.status === "delivered" && (
                                    <button
                                      onClick={() => handleReceive(item.id, req.id)}
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
                            {((req as any).items?.length ?? 0) > 3 && (
                              <button
                                onClick={() => setModalItems((req as any).items ?? [])}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1"
                              >
                                +{(req as any).items!.length - 3} libros más
                              </button>
                            )}
                          </div>

                          {req.notes && (
                            <p className="text-[10px] text-white/20 italic mt-1">"{req.notes}"</p>
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
        {(item: any) => {
          const soldQty = soldByBook.get(item.book_id) || 0;
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
