"use client";

import { useQuery } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { getSellerInventory, getSellerSales, COST_PER_BOOK } from "@/lib/sellers";
import { useUserId } from "@/hooks/useUser";
import { Store, Package, TrendingUp, Loader2, BarChart3 } from "lucide-react";
import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from "recharts";

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
  const { userId } = useUserId();
  const [activeSection, setActiveSection] = useState<Section>("stock");
  const [dateRange, setDateRange] = useState("30d");

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

  const totalRevenue = sales.reduce((s, i) => s + i.sale_price * i.quantity, 0);
  const totalProfit = totalRevenue - sales.reduce((s, i) => s + i.quantity * COST_PER_BOOK, 0);
  const totalInvestmentSaved = sales.reduce((s, i) => s + i.quantity * COST_PER_BOOK, 0);

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
              <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-400" />
                  Stock ({activeInventory.length} títulos)
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
                    return (
                      <div key={item.id} className="px-5 py-3 flex items-center gap-3">
                        <span className="text-white/90 text-sm flex-1 truncate">
                          {book?.title || "Libro"}
                        </span>
                        <span className="text-white font-bold text-sm shrink-0">
                          x{item.quantity}
                        </span>
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
                        <span className="text-white/90 text-sm flex-1 truncate">
                          {book?.title || "Libro"}
                        </span>
                        <span className="text-white/40 text-xs shrink-0">
                          {new Date(sale.sold_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                        </span>
                        <span className="text-white font-bold text-sm shrink-0">
                          x{sale.quantity}
                        </span>
                        <span className="text-green-400 font-bold text-sm shrink-0">
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
              {/* Metric cards */}
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

              {/* Date range */}
              <div className="flex items-center justify-between">
                <DateRangePicker value={dateRange} onChange={setDateRange} />
              </div>

              {chartData.length === 0 ? (
                <div className="text-center py-16 text-white/30 text-sm">Sin datos en este período.</div>
              ) : (
                <>
                  {/* Ingresos y Ganancia - Bar chart */}
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

                  {/* Inversión ahorrada - Line chart */}
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
