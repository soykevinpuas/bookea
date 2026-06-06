"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { getSellerInventory, getSellerSales, getSellerRequests, markAsSold, COST_PER_BOOK } from "@/lib/sellers";
import { receiveStockItemAction } from "@/lib/actions/sellers";
import { useUserId } from "@/hooks/useUser";
import { Store, Package, TrendingUp, Loader2, BarChart3, Truck, Check, DollarSign, Plus, Minus } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from "recharts";

type Section = "stock" | "vendidos" | "ingresos";

const sections: { key: Section; label: string; icon: any }[] = [
  { key: "stock", label: "Stock", icon: Package },
  { key: "vendidos", label: "Vendidos", icon: TrendingUp },
  { key: "ingresos", label: "Ingresos", icon: BarChart3 },
];

function DateRangePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ranges = [
    { key: "7d", label: "7d" },
    { key: "30d", label: "30d" },
    { key: "90d", label: "90d" },
    { key: "all", label: "Todo" },
  ];
  return (
    <div className="flex gap-1">
      {ranges.map((r) => (
        <button
          key={r.key}
          onClick={() => onChange(r.key)}
          className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all ${
            value === r.key
              ? "bg-amber-600/20 text-amber-400 border border-amber-500/20"
              : "text-white/40 hover:text-white/60 border border-transparent"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

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
  const [activeSection, setActiveSection] = useState<Section>("stock");
  const [dateRange, setDateRange] = useState("30d");
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

  const pendingReceipts = useMemo(() => {
    const items: { itemId: string; requestId: string; bookId: string; title: string; cover: string | null; quantity: number }[] = [];
    for (const req of requests) {
      if (req.status !== "shipped") continue;
      for (const item of (req as any).items || []) {
        if (item.received_at) continue;
        const book = item.books as any;
        items.push({
          itemId: item.id,
          requestId: req.id,
          bookId: item.book_id,
          title: book?.title || "Libro",
          cover: book?.cover_url || null,
          quantity: item.quantity,
        });
      }
    }
    return items;
  }, [requests]);

  const totalRevenue = sales.reduce((s, i) => s + i.sale_price * i.quantity, 0);
  const totalProfit = totalRevenue - sales.reduce((s, i) => s + i.quantity * COST_PER_BOOK, 0);

  const chartData = useMemo(() => {
    const cutoff = dateRange === "all" ? null : Date.now() - {
      "7d": 7, "30d": 30, "90d": 90,
    }[dateRange]! * 86400000;

    const dayMap = new Map<string, { revenue: number; cost: number; profit: number }>();

    for (const sale of sales) {
      const d = new Date(sale.sold_at);
      if (cutoff && d.getTime() < cutoff) continue;

      const key = d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
      const existing = dayMap.get(key) || { revenue: 0, cost: 0, profit: 0 };
      existing.revenue += sale.sale_price * sale.quantity;
      existing.cost += sale.quantity * COST_PER_BOOK;
      existing.profit += (sale.sale_price - COST_PER_BOOK) * sale.quantity;
      dayMap.set(key, existing);
    }

    return Array.from(dayMap.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => {
        const [da, db] = [a.date, b.date].map(d => new Date(d).getTime());
        return da - db;
      });
  }, [sales, dateRange]);

  const totalChartRevenue = chartData.reduce((s, d) => s + d.revenue, 0);
  const totalChartProfit = chartData.reduce((s, d) => s + d.profit, 0);
  const totalChartCost = chartData.reduce((s, d) => s + d.cost, 0);

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

      <div className="flex gap-1 mb-6 overflow-x-auto pb-1 md:hidden">
        {sections.map((sec) => {
          const Icon = sec.icon;
          return (
            <button
              key={sec.key}
              onClick={() => setActiveSection(sec.key)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl whitespace-nowrap transition-all ${
                activeSection === sec.key
                  ? "bg-amber-600/20 text-amber-400 border border-amber-500/20"
                  : "text-white/40 hover:text-white/60 border border-transparent"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {sec.label}
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
              {/* Pending receipts */}
              {pendingReceipts.length > 0 && (
                <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/8 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-400" />
                    <h2 className="font-semibold text-sm">En camino ({pendingReceipts.length})</h2>
                  </div>
                  <div className="divide-y divide-white/5">
                    {pendingReceipts.map((p) => (
                      <div key={p.itemId} className="px-5 py-3 flex items-center gap-3">
                        {p.cover && (
                          <img src={p.cover} alt="" className="w-7 h-10 rounded object-cover bg-white/5 shrink-0" />
                        )}
                        <span className="text-sm flex-1 truncate text-white/80">{p.title}</span>
                        <span className="text-sm font-bold text-white shrink-0">x{p.quantity}</span>
                        <button
                          onClick={() => handleReceive(p.itemId, p.requestId)}
                          disabled={receiving === p.itemId}
                          className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-all disabled:opacity-50 shrink-0"
                        >
                          {receiving === p.itemId ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          Recibir
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Current inventory */}
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
                        <div key={item.id} className="px-5 py-3 flex items-center gap-3">
                          {book?.cover_url && (
                            <img src={book.cover_url} alt="" className="w-7 h-10 rounded object-cover bg-white/5 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{book?.title || "Libro"}</p>
                            <p className="text-[10px] text-white/30">Costo: ${COST_PER_BOOK.toLocaleString("es-MX")} · {item.quantity} uds.</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
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

              <div className="flex items-center justify-between">
                <DateRangePicker value={dateRange} onChange={setDateRange} />
              </div>

              {chartData.length === 0 ? (
                <div className="text-center py-16 text-white/30 text-sm">Sin datos en este período.</div>
              ) : (
                <>
                  <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
                    <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4">Ingresos vs Ganancia</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="revenue" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={32} />
                        <Bar dataKey="profit" name="Ganancia" fill="#60a5fa" radius={[4, 4, 0, 0]} maxBarSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
                    <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4">Inversión ahorrada</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="cost" name="Inversión ahorrada" stroke="#a78bfa" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
