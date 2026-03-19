import { createClient } from "@/lib/server";
import Link from "next/link";
import {
  BookOpen,
  ShoppingCart,
  Users,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";

async function getAdminStats() {
  const supabase = await createClient();

  const [booksRes, ordersRes, usersRes] = await Promise.all([
    supabase.from("books").select("id, is_active", { count: "exact" }),
    supabase.from("orders_physical").select("id, status, total", { count: "exact" }),
    supabase.from("users").select("id, role", { count: "exact" }),
  ]);

  const totalBooks = booksRes.count ?? 0;
  const activeBooks = booksRes.data?.filter((b) => b.is_active).length ?? 0;

  const totalOrders = ordersRes.count ?? 0;
  const pendingOrders = ordersRes.data?.filter((o) => o.status === "pending").length ?? 0;
  const revenue = ordersRes.data?.reduce((sum, o) => sum + (Number(o.total) || 0), 0) ?? 0;

  const totalUsers = usersRes.count ?? 0;

  return { totalBooks, activeBooks, totalOrders, pendingOrders, revenue, totalUsers };
}

// 5.2 - AdminDashboard: Vista principal del panel de control que muestra estadísticas globales del proyecto
export default async function AdminDashboard() {
  let stats = { totalBooks: 0, activeBooks: 0, totalOrders: 0, pendingOrders: 0, revenue: 0, totalUsers: 0 };

  try {
    stats = await getAdminStats();
  } catch {
    // 5.2.1 - Fallback de seguridad visual: Si la tabla aún no contiene campos, muestra ceros limpios
  }

  const cards = [
    {
      label: "Libros en catálogo",
      value: stats.totalBooks,
      sub: `${stats.activeBooks} activos`,
      icon: BookOpen,
      href: "/admin/books",
      color: "blue",
    },
    {
      label: "Órdenes físicas",
      value: stats.totalOrders,
      sub: `${stats.pendingOrders} pendientes`,
      icon: ShoppingCart,
      href: "/admin/orders",
      color: "amber",
    },
    {
      label: "Usuarios registrados",
      value: stats.totalUsers,
      sub: "en total",
      icon: Users,
      href: "/admin/users",
      color: "green",
    },
    {
      label: "Ingresos físicos",
      value: `$${stats.revenue.toLocaleString("es-MX")}`,
      sub: "MXN acumulado",
      icon: TrendingUp,
      href: "/admin/orders",
      color: "purple",
    },
  ];

  const colorMap: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    green: "bg-green-500/10 text-green-400 border-green-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-white/40 text-sm mt-1">Visión general de Bookea</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group relative bg-white/5 border border-white/8 rounded-2xl p-5 hover:bg-white/8 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${colorMap[card.color]}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" />
            </div>
            <div className="text-2xl font-bold mb-1">{card.value}</div>
            <div className="text-sm text-white/40">{card.label}</div>
            <div className="text-xs text-white/25 mt-0.5">{card.sub}</div>
          </Link>
        ))}
      </div>

      <div className="bg-white/5 border border-white/8 rounded-2xl p-6">
        <h2 className="font-semibold mb-4 text-white/80">Acciones rápidas</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/books?action=new"
            className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            + Agregar libro
          </Link>
          <Link
            href="/admin/orders"
            className="px-4 py-2.5 bg-white/8 text-white/70 text-sm font-medium rounded-xl hover:bg-white/12 transition-colors border border-white/10"
          >
            Ver órdenes pendientes
          </Link>
          <Link
            href="/admin/users"
            className="px-4 py-2.5 bg-white/8 text-white/70 text-sm font-medium rounded-xl hover:bg-white/12 transition-colors border border-white/10"
          >
            Gestionar usuarios
          </Link>
        </div>
      </div>
    </div>
  );
}
