"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { getAllStockRequests, updateStockRequestStatus, COST_PER_BOOK } from "@/lib/sellers";
import { deleteStockRequestAction } from "@/lib/actions/sellers";
import type { StockRequest } from "@/types/seller";
import { useState, useMemo } from "react";
import {
  BarChart3, Package, TrendingUp, ShoppingCart,
  Store, ChevronLeft, ChevronRight,
  Calendar, Truck, Check, Clock, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type Section = "ingresos" | "stock" | "vendidos" | "solicitudes";

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

export default function AdminDashboard() {
  const supabase = createClientClient();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<Section>("ingresos");
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});

  const { data: allSales = [] } = useQuery({
    queryKey: ["admin-all-sales"],
    queryFn: async () => {
      const { data } = await supabase.from("seller_sales").select("*, books(id, title, cover_url)").order("sold_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: allInventory = [] } = useQuery({
    queryKey: ["admin-all-inventory"],
    queryFn: async () => {
      const { data } = await supabase.from("seller_inventory").select("*, books(id, title, cover_url, author)").order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: allSellers = [] } = useQuery({
    queryKey: ["admin-all-sellers-list"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, email").eq("role", "vendedor");
      return data ?? [];
    },
  });

  const { data: requests = [] } = useQuery<StockRequest[]>({
    queryKey: ["admin-stock-requests"],
    queryFn: () => getAllStockRequests(supabase),
  });

  const { data: allSalesForMap = [] } = useQuery({
    queryKey: ["admin-all-seller-sales-map"],
    queryFn: async () => {
      const { data } = await supabase.from("seller_sales").select("seller_id, book_id, quantity");
      return data ?? [];
    },
  });

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-stock-requests"] }),
  });

  const deleteRequest = useMutation({
    mutationFn: async (requestId: string) => {
      await deleteStockRequestAction(requestId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-stock-requests"] });
      toast.success("Solicitud eliminada");
    },
    onError: (err: any) => toast.error(err?.message || "Error al eliminar"),
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

  const handleShip = (req: StockRequest) => {
    const tracking = trackingInputs[req.id]?.trim();
    if (!tracking) { toast.error("Ingresa el número de guía"); return; }
    updateStatus.mutate({ id: req.id, status: "shipped", tracking_number: tracking });
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <div className="flex items-center gap-2 text-xs text-white/30 bg-white/5 px-3 py-1.5 rounded-lg">
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
                <div className="bg-white/5 border border-white/8 rounded-xl p-4">
                  <p className="text-lg font-bold text-green-400">${totalChartRevenue.toLocaleString("es-MX")}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Ingresos totales</p>
                </div>
                <div className="bg-white/5 border border-white/8 rounded-xl p-4">
                  <p className="text-lg font-bold text-blue-400">${totalChartProfit.toLocaleString("es-MX")}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Ganancia total</p>
                </div>
                <div className="bg-white/5 border border-white/8 rounded-xl p-4">
                  <p className="text-lg font-bold text-white/60">${totalChartCost.toLocaleString("es-MX")}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Inversión ahorrada</p>
                </div>
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
                          <span className="text-xs text-white/40">{item.books?.author}</span>
                          <span className="text-sm font-bold text-white shrink-0">{item.quantity} uds.</span>
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
                <div className="bg-white/5 border border-white/8 rounded-xl p-4">
                  <p className="text-lg font-bold text-white">{allSales.reduce((s, i) => s + i.quantity, 0)}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Total unidades</p>
                </div>
                <div className="bg-white/5 border border-white/8 rounded-xl p-4">
                  <p className="text-lg font-bold text-green-400">${allSales.reduce((s, i) => s + i.sale_price * i.quantity, 0).toLocaleString("es-MX")}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Ingresos totales</p>
                </div>
                <div className="bg-white/5 border border-white/8 rounded-xl p-4">
                  <p className="text-lg font-bold text-amber-400">{allSellers.length}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Vendedores activos</p>
                </div>
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
                </div>
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
