"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { getSellerInventory, getSellerSales, markAsSold, COST_PER_BOOK } from "@/lib/sellers";
import { useUserId } from "@/hooks/useUser";
import { Store, Package, TrendingUp, DollarSign, Loader2, Minus, Plus, ChevronDown, ChevronUp, LayoutDashboard, BarChart3 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Section = "dashboard" | "inventario" | "ventas";

const sections: { key: Section; label: string; icon: any }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "inventario", label: "Inventario", icon: Package },
  { key: "ventas", label: "Ventas", icon: BarChart3 },
];

export default function VendedorDashboard() {
  const supabase = createClientClient();
  const queryClient = useQueryClient();
  const { userId } = useUserId();
  const [activeSection, setActiveSection] = useState<Section>("dashboard");

  const [salePrices, setSalePrices] = useState<Record<string, number>>({});
  const [saleQtys, setSaleQtys] = useState<Record<string, number>>({});
  const [selling, setSelling] = useState<string | null>(null);
  const [expandedBook, setExpandedBook] = useState<string | null>(null);
  const [showSold, setShowSold] = useState(false);

  const { data: inventory = [], isLoading: invLoading } = useQuery({
    queryKey: ["seller-inventory", userId],
    queryFn: () => getSellerInventory(supabase, userId!),
    enabled: !!userId,
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ["seller-sales", userId],
    queryFn: () => getSellerSales(supabase, userId!),
    enabled: !!userId,
  });

  const totalStock = inventory.reduce((s, i) => s + i.quantity, 0);
  const totalSold = sales.reduce((s, i) => s + i.quantity, 0);
  const totalInvestment = inventory.reduce((s, i) => s + i.quantity * COST_PER_BOOK, 0) + sales.reduce((s, i) => s + i.quantity * COST_PER_BOOK, 0);
  const totalRevenue = sales.reduce((s, i) => s + i.sale_price * i.quantity, 0);
  const totalProfit = totalRevenue - (sales.reduce((s, i) => s + i.quantity * COST_PER_BOOK, 0));

  const handleSell = async (bookId: string, currentQty: number) => {
    const qty = saleQtys[bookId] || 1;
    const price = salePrices[bookId] || COST_PER_BOOK;

    if (qty < 1) { toast.error("Cantidad inválida"); return; }
    if (qty > currentQty) { toast.error("Stock insuficiente"); return; }
    if (price <= 0) { toast.error("El precio debe ser mayor a $0"); return; }

    setSelling(bookId);
    try {
      await markAsSold(supabase, userId!, bookId, qty, price);
      toast.success(`Vendido${qty > 1 ? `s ${qty}` : ""} por $${(price * qty).toLocaleString("es-MX")}`);
      queryClient.invalidateQueries({ queryKey: ["seller-inventory", userId] });
      queryClient.invalidateQueries({ queryKey: ["seller-sales", userId] });
      setSaleQtys(prev => ({ ...prev, [bookId]: 1 }));
    } catch (e: any) {
      toast.error(e.message || "Error al registrar venta");
    } finally {
      setSelling(null);
    }
  };

  const activeInventory = inventory.filter(i => i.quantity > 0);
  const zeroStockInventory = inventory.filter(i => i.quantity === 0);

  if (invLoading && inventory.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Store className="w-6 h-6 text-amber-400" />
          Mi Tienda
        </h1>
        <p className="text-white/40 text-sm mt-1">Gestiona tu inventario, precios y ventas</p>
      </div>

      {/* Mobile: horizontal tab bar */}
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

      {/* Desktop: sidebar + content */}
      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col gap-1 w-44 shrink-0">
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

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeSection === "dashboard" && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="bg-white/5 border border-white/8 rounded-xl p-4">
                <p className="text-2xl font-bold text-white">{totalStock}</p>
                <p className="text-xs text-white/40 mt-0.5">En stock</p>
              </div>
              <div className="bg-white/5 border border-white/8 rounded-xl p-4">
                <p className="text-2xl font-bold text-amber-400">{totalSold}</p>
                <p className="text-xs text-white/40 mt-0.5">Vendidos</p>
              </div>
              <div className="bg-white/5 border border-white/8 rounded-xl p-4">
                <p className="text-2xl font-bold text-green-400">${totalRevenue.toLocaleString("es-MX")}</p>
                <p className="text-xs text-white/40 mt-0.5">Ingresos</p>
              </div>
              <div className="bg-white/5 border border-white/8 rounded-xl p-4">
                <p className="text-2xl font-bold text-blue-400">${totalProfit.toLocaleString("es-MX")}</p>
                <p className="text-xs text-white/40 mt-0.5">Ganancia</p>
              </div>
              <div className="bg-white/5 border border-white/8 rounded-xl p-4">
                <p className="text-2xl font-bold text-white/50">${totalInvestment.toLocaleString("es-MX")}</p>
                <p className="text-xs text-white/40 mt-0.5">Inversión ahorrada</p>
              </div>
            </div>
          )}

          {activeSection === "inventario" && (
            <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-400" />
                  Inventario ({activeInventory.length + zeroStockInventory.length} títulos)
                </h2>
                <span className="text-xs text-white/30">{totalStock} uds.</span>
              </div>

              {activeInventory.length === 0 && zeroStockInventory.length === 0 ? (
                <div className="text-center py-12 text-white/30 text-sm">
                  No tienes libros en inventario. Solicita stock al administrador para comenzar.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {activeInventory.map((item) => {
                    const book = item.books;
                    const qty = saleQtys[item.book_id] || 1;
                    const price = salePrices[item.book_id] || 0;
                    const isExpanded = expandedBook === item.id;
                    const isSelling = selling === item.book_id;

                    return (
                      <div key={item.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-start gap-3">
                          {book?.cover_url && (
                            <img src={book.cover_url} alt="" className="w-10 h-14 rounded-lg object-cover bg-white/5 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{book?.title || "Libro"}</p>
                            <p className="text-xs text-white/40 truncate">{book?.author || ""}</p>
                            <p className="text-[10px] text-white/20 mt-0.5">Costo: ${COST_PER_BOOK.toLocaleString("es-MX")} c/u</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold">{item.quantity}</p>
                            <p className="text-[10px] text-white/30">en stock</p>
                          </div>
                          <button
                            onClick={() => setExpandedBook(isExpanded ? null : item.id)}
                            className="p-1.5 text-white/30 hover:text-white/60 transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 pl-[52px] flex flex-wrap items-end gap-3">
                            <div>
                              <label className="text-[10px] text-white/30 block mb-1">Cantidad</label>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setSaleQtys(prev => ({ ...prev, [item.book_id]: Math.max(1, (prev[item.book_id] || 1) - 1) }))}
                                  className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="w-8 text-center text-sm font-bold">{qty}</span>
                                <button
                                  onClick={() => setSaleQtys(prev => ({ ...prev, [item.book_id]: Math.min(item.quantity, (prev[item.book_id] || 1) + 1) }))}
                                  className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] text-white/30 block mb-1">Precio de venta</label>
                              <div className="flex items-center gap-1">
                                <span className="text-sm text-white/40">$</span>
                                <input
                                  type="number"
                                  value={price || ""}
                                  onChange={(e) => setSalePrices(prev => ({ ...prev, [item.book_id]: Number(e.target.value) || 0 }))}
                                  className="w-24 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-amber-500/50 transition-colors placeholder:text-white/20"
                                  placeholder="Agrega tu precio"
                                  min={1}
                                />
                              </div>
                            </div>

                            <div className="text-xs text-white/40 pb-1.5">
                              Total: <span className="font-bold text-green-400">${(price * qty).toLocaleString("es-MX")}</span>
                              <span className="text-white/20 ml-1">
                                (ganancia: ${((price - COST_PER_BOOK) * qty).toLocaleString("es-MX")})
                              </span>
                            </div>

                            <button
                              onClick={() => handleSell(item.book_id, item.quantity)}
                              disabled={isSelling}
                              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                            >
                              {isSelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
                              Vender
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {zeroStockInventory.length > 0 && (
                    <button
                      onClick={() => setShowSold(!showSold)}
                      className="w-full px-5 py-3 text-xs text-white/30 hover:text-white/50 flex items-center justify-between gap-2 transition-colors"
                    >
                      <span>{zeroStockInventory.length} título{zeroStockInventory.length > 1 ? "s" : ""} sin stock</span>
                      {showSold ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  {showSold && zeroStockInventory.map((item) => (
                    <div key={item.id} className="px-5 py-3 flex items-center gap-3 opacity-50">
                      {item.books?.cover_url && (
                        <img src={item.books.cover_url} alt="" className="w-8 h-10 rounded object-cover bg-white/5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{item.books?.title}</p>
                      </div>
                      <span className="text-xs text-white/30">Agotado</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSection === "ventas" && (
            <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/8">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-green-400" />
                  Últimas ventas
                </h2>
              </div>
              {sales.length === 0 ? (
                <div className="text-center py-8 text-white/30 text-sm">Aún no has registrado ventas.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {sales.slice(0, 10).map((sale) => {
                    const book = sale.books;
                    const profitPerUnit = sale.sale_price - COST_PER_BOOK;
                    return (
                      <div key={sale.id} className="px-5 py-3 flex items-center gap-3">
                        {book?.cover_url && (
                          <img src={book.cover_url} alt="" className="w-8 h-10 rounded object-cover bg-white/5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{book?.title || "Libro"}</p>
                          <p className="text-[10px] text-white/30">
                            {new Date(sale.sold_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                            {" · "}{sale.quantity} uds.
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">${(sale.sale_price * sale.quantity).toLocaleString("es-MX")}</p>
                          <p className={`text-[10px] ${profitPerUnit >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {profitPerUnit >= 0 ? "+" : ""}${(profitPerUnit * sale.quantity).toLocaleString("es-MX")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
