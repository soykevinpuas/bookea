"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { getSellerInventory, getSellerSales, getSellerRequests, getPhysicalBooks, markAsSold, COST_PER_BOOK } from "@/lib/sellers";
import { receiveStockItemAction, createStockRequestAction } from "@/lib/actions/sellers";
import { useUserId } from "@/hooks/useUser";
import { Store, Package, TrendingUp, Loader2, BarChart3, Truck, Check, DollarSign, Plus, Minus, ShoppingCart, Search, X } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from "recharts";

type Section = "stock" | "vendidos" | "ingresos" | "solicitudes";

const sections: { key: Section; label: string; icon: any }[] = [
  { key: "stock", label: "Stock", icon: Package },
  { key: "vendidos", label: "Vendidos", icon: TrendingUp },
  { key: "ingresos", label: "Ingresos", icon: BarChart3 },
  { key: "solicitudes", label: "Solicitudes", icon: ShoppingCart },
];

interface CartItem {
  book_id: string;
  title: string;
  quantity: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
  shipped: { label: "Enviado", color: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
  delivered: { label: "Entregado", color: "bg-green-500/10 text-green-400 border border-green-500/20" },
  cancelled: { label: "Cancelado", color: "bg-red-500/10 text-red-400 border border-red-500/20" },
};

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
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>("stock");
  const [dateRange, setDateRange] = useState("30d");
  const [salePrices, setSalePrices] = useState<Record<string, number>>({});
  const [saleQtys, setSaleQtys] = useState<Record<string, number>>({});
  const [selling, setSelling] = useState<string | null>(null);
  const [receiving, setReceiving] = useState<string | null>(null);

  // Solicitudes state
  const [showNewForm, setShowNewForm] = useState(false);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

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

  const { data: books = [], isLoading: booksLoading } = useQuery({
    queryKey: ["physical-books"],
    queryFn: () => getPhysicalBooks(supabase),
  });

  const { data: sellerInventory = [] } = useQuery({
    queryKey: ["seller-inventory", userId],
    queryFn: () => getSellerInventory(supabase, userId!),
    enabled: !!userId,
  });

  const inventoryMap = new Map(sellerInventory.map(i => [i.book_id, i.quantity]));

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

  const addToCart = (book: any) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.book_id === book.id);
      if (existing) {
        return prev.map((c) =>
          c.book_id === book.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { book_id: book.id, title: book.title, quantity: 1 }];
    });
  };

  const updateCartQty = (bookId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.book_id === bookId ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const removeFromCart = (bookId: string) => {
    setCart((prev) => prev.filter((c) => c.book_id !== bookId));
  };

  const handleCreateRequest = async () => {
    if (!userId || cart.length === 0) return;
    setCreating(true);
    try {
      const items = cart.map((c) => ({ book_id: c.book_id, quantity: c.quantity }));
      await createStockRequestAction(userId, items, notes || undefined);
      queryClient.invalidateQueries({ queryKey: ["seller-requests", userId] });
      setCart([]);
      setNotes("");
      setShowNewForm(false);
      toast.success("Solicitud creada");
    } catch (e: any) {
      toast.error(e.message || "Error al crear solicitud");
    } finally {
      setCreating(false);
    }
  };

  const filteredBooks = books.filter(
    (b: any) =>
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase())
  );

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

          {/* ── SOLICITUDES ── */}
          {activeSection === "solicitudes" && (
            <div className="space-y-5">
              {/* Nueva solicitud */}
              <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowNewForm(!showNewForm)}
                  className="w-full px-5 py-3 flex items-center justify-between gap-2 hover:bg-white/[0.02] transition-colors"
                >
                  <h2 className="font-semibold text-sm flex items-center gap-2">
                    <Plus className="w-4 h-4 text-amber-400" />
                    Nueva solicitud
                  </h2>
                  <span className="text-xs text-white/30">{showNewForm ? "Cerrar" : "Abrir"}</span>
                </button>

                {showNewForm && (
                  <div className="border-t border-white/8 p-5">
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar libros..."
                        className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 outline-none focus:border-amber-500/50 transition-colors text-sm"
                      />
                    </div>

                    <div className="flex flex-col lg:flex-row gap-4">
                      <div className="flex-1 max-h-64 overflow-y-auto space-y-1">
                        {booksLoading ? (
                          <div className="flex justify-center py-8">
                            <Loader2 className="w-5 h-5 animate-spin text-white/20" />
                          </div>
                        ) : filteredBooks.length === 0 ? (
                          <p className="text-sm text-white/30 text-center py-8">Sin resultados.</p>
                        ) : (
                          filteredBooks.map((book: any) => {
                            const inCart = cart.find((c) => c.book_id === book.id);
                            return (
                              <div
                                key={book.id}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${
                                  inCart ? "bg-amber-500/10 border border-amber-500/20" : "hover:bg-white/5 border border-transparent"
                                }`}
                              >
                                {book.cover_url && (
                                  <img src={book.cover_url} alt="" className="w-6 h-8 rounded object-cover bg-white/5 shrink-0" />
                                )}
                                <span className="flex-1 truncate text-white/70 text-xs">{book.title}</span>
                                <span className="text-[10px] text-white/30 shrink-0">stock: {book.stock_physical}</span>
                                {inCart ? (
                                  <button onClick={() => removeFromCart(book.id)} className="p-1 hover:bg-white/10 rounded-lg">
                                    <X className="w-3 h-3 text-white/40" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => addToCart(book)}
                                    disabled={book.stock_physical <= 0}
                                    className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-all disabled:opacity-30"
                                  >
                                    + Agregar
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="lg:w-64 space-y-3">
                        {cart.length === 0 ? (
                          <p className="text-xs text-white/30">Selecciona libros.</p>
                        ) : (
                          <div className="space-y-1">
                            {cart.map((item) => (
                              <div key={item.book_id} className="flex items-center justify-between text-xs">
                                <span className="text-white/60 truncate flex-1">{item.title}</span>
                                <div className="flex items-center gap-1 ml-2">
                                  <button onClick={() => updateCartQty(item.book_id, -1)} className="p-0.5 hover:bg-white/10 rounded">
                                    <Minus className="w-2.5 h-2.5" />
                                  </button>
                                  <span className="w-4 text-center font-bold text-white">{item.quantity}</span>
                                  <button onClick={() => updateCartQty(item.book_id, 1)} className="p-0.5 hover:bg-white/10 rounded">
                                    <Plus className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Notas opcionales..."
                          className="w-full text-xs px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 outline-none focus:border-amber-500/50 transition-colors resize-none h-16"
                        />

                        <button
                          onClick={handleCreateRequest}
                          disabled={cart.length === 0 || creating}
                          className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors"
                        >
                          {creating ? (
                            <span className="flex items-center justify-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Enviando...
                            </span>
                          ) : (
                            `Enviar (${cart.reduce((s, i) => s + i.quantity, 0)} uds.)`
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

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
