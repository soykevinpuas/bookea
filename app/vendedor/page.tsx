"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { getSellerInventory, getSellerSales, getSellerRequests, markAsSold, COST_PER_BOOK, getSellerPendingTotal } from "@/lib/sellers";
import { receiveStockItemAction } from "@/lib/actions/sellers";
import { useUserId } from "@/hooks/useUser";
import { Store, Package, TrendingUp, Loader2, BarChart3, Truck, Check, DollarSign, Plus, Minus, ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type Section = "stock" | "vendidos" | "ingresos" | "solicitudes";

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
  const [activeSection, setActiveSection] = useState<Section>("ingresos");
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [salePrices, setSalePrices] = useState<Record<string, number>>({});
  const [saleQtys, setSaleQtys] = useState<Record<string, number>>({});
  const [selling, setSelling] = useState<string | null>(null);
  const [receiving, setReceiving] = useState<string | null>(null);

  const { data: inventory = [], isLoading: invLoading } = useQuery({
    queryKey: ["seller-inventory", userId],
    queryFn: () => getSellerInventory(supabase, userId!),
    enabled: !!userId,
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["seller-sales", userId],
    queryFn: () => getSellerSales(supabase, userId!),
    enabled: !!userId,
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["seller-requests", userId],
    queryFn: () => getSellerRequests(supabase, userId!),
    enabled: !!userId,
  });

  const { data: pendingPayment = 0 } = useQuery({
    queryKey: ["seller-pending-payment", userId],
    queryFn: () => getSellerPendingTotal(supabase, userId!),
    enabled: !!userId,
  });

  const { data: userRole } = useQuery({
    queryKey: ["vendedor-page-role"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_my_role");
      return data as string;
    },
  });

  const isAdmin = userRole === "admin";

  const totalRevenue = sales.reduce((s, i) => s + i.sale_price * i.quantity, 0);
  const totalProfit = totalRevenue - sales.reduce((s, i) => s + i.quantity * COST_PER_BOOK, 0);

  const chartData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const dayMap = new Map<number, { venta: number; ahorro: number; ganancia: number }>();

    for (const sale of sales) {
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
  }, [sales, currentMonth]);

  const totalChartRevenue = chartData.reduce((s, d) => s + d.venta, 0);
  const totalChartProfit = chartData.reduce((s, d) => s + d.ganancia, 0);
  const totalChartCost = chartData.reduce((s, d) => s + d.ahorro, 0);

  const activeInventory = inventory.filter(i => i.quantity > 0);

  const handleSell = async (bookId: string, currentQty: number) => {
    const qty = saleQtys[bookId] || 1;
    const price = salePrices[bookId];
    if (!price || price <= 0) { toast.error("Agrega un precio de venta"); return; }
    if (qty < 1) { toast.error("Cantidad inválida"); return; }
    if (qty > currentQty) { toast.error("Stock insuficiente"); return; }

    setSelling(bookId);
    try {
      await markAsSold(supabase, userId!, bookId, qty, price);
      toast.success(`Vendido${qty > 1 ? `s ${qty}` : ""} por $${(price * qty).toLocaleString("es-MX")}`);
      queryClient.invalidateQueries({ queryKey: ["seller-inventory", userId] });
      queryClient.invalidateQueries({ queryKey: ["seller-sales", userId] });
      setSaleQtys(prev => ({ ...prev, [bookId]: 1 }));
      setSalePrices(prev => { const copy = { ...prev }; delete copy[bookId]; return copy; });
    } catch (e: any) {
      toast.error(e.message || "Error al registrar venta");
    } finally {
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
    } catch (e: any) {
      toast.error(e.message || "Error al recibir");
    } finally {
      setReceiving(null);
    }
  };

  if (invLoading && inventory.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Store className="w-6 h-6 text-amber-400" />
          Mi Tienda
        </h1>
      </div>

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
                            <p className="text-[10px] text-white/30">Costo: ${COST_PER_BOOK.toLocaleString("es-MX")} · {item.quantity} uds.</p>
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
                  {sales.map((sale) => {
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
                    <p className="text-xs text-white/40">Adeudo con el admin</p>
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

              {/* Mis solicitudes */}
              <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-white/8">
                  <h2 className="font-semibold text-sm flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-amber-400" />
                    Mis solicitudes ({requests.length})
                  </h2>
                </div>
                {requests.length === 0 ? (
                  <div className="text-center py-8 text-white/30 text-sm">Aún no hay solicitudes.</div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {requests.map((req) => {
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
                            {((req as any).items || []).map((item: any) => {
                              const book = item.books as any;
                              const isReceived = !!item.received_at;
                              return (
                                <div key={item.id} className="flex items-center gap-2 text-xs">
                                  {book?.cover_url && (
                                    <img src={book.cover_url} alt="" className="w-5 h-7 rounded object-cover bg-white/5 shrink-0" />
                                  )}
                                  <span className="text-white/60 flex-1 truncate">{book?.title || "Libro"}</span>
                                  <span className="text-white font-medium shrink-0">x{item.quantity}</span>

                                  {req.status === "shipped" && !isReceived && (
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
                                    <span className="text-[10px] text-green-400 font-medium flex items-center gap-1 shrink-0">
                                      <Check className="w-2.5 h-2.5" />
                                      Recibido
                                    </span>
                                  )}
                                </div>
                              );
                            })}
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
    </div>
  );
}
