import { createClient } from "@/lib/server";
import Link from "next/link";
import React from "react";
import {
  BookOpen,
  ShoppingCart,
  Users,
  TrendingUp,
  ArrowUpRight,
  Eye,
  CreditCard,
  Library,
  Sparkles,
  Calendar,
  Activity,
} from "lucide-react";

interface AdminStats {
  totalBooks: number;
  activeBooks: number;
  newBooksThisWeek: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  revenuePhysical: number;
  totalUsers: number;
  newUsersThisWeek: number;
  subscribers: number;
  admins: number;
  freeUsers: number;
  digitalRevenue: number;
  subscriptionPayments: number;
  recentSignups: number;
  recentPayments: number;
  booksReadThisWeek: number;
  reviewsThisWeek: number;
}

interface AdminCard {
  label: string;
  value: number | string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
}

async function getAdminStats(): Promise<AdminStats> {
  const supabase = await createClient();
  
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneWeekAgoStr = oneWeekAgo.toISOString();

  const [booksRes, ordersRes, usersRes, analyticsRes, userBooksRes, reviewsRes] = await Promise.all([
    supabase.from("books").select("id, is_active, created_at", { count: "exact" }),
    supabase.from("orders_physical").select("id, status, total, created_at", { count: "exact" }),
    supabase.from("users").select("id, role, created_at", { count: "exact" }),
    supabase.from("analytics_events").select("event_name, event_data").gte("created_at", oneWeekAgoStr),
    supabase.from("user_books").select("id, created_at", { count: "exact" }).gte("created_at", oneWeekAgoStr),
    supabase.from("reviews").select("id, created_at", { count: "exact" }).gte("created_at", oneWeekAgoStr),
  ]);

  const totalBooks = booksRes.count ?? 0;
  const activeBooks = booksRes.data?.filter((b) => b.is_active).length ?? 0;
  const newBooksThisWeek = booksRes.data?.filter((b) => new Date(b.created_at) >= oneWeekAgo).length ?? 0;

  const totalOrders = ordersRes.count ?? 0;
  const pendingOrders = ordersRes.data?.filter((o) => o.status === "pending").length ?? 0;
  const completedOrders = ordersRes.data?.filter((o) => o.status === "delivered").length ?? 0;
  const revenuePhysical = ordersRes.data?.reduce((sum, o) => sum + (Number(o.total) || 0), 0) ?? 0;

  const totalUsers = usersRes.count ?? 0;
  const newUsersThisWeek = usersRes.data?.filter((u) => new Date(u.created_at) >= oneWeekAgo).length ?? 0;
  const subscribers = usersRes.data?.filter((u) => u.role === "subscriber").length ?? 0;
  const admins = usersRes.data?.filter((u) => u.role === "admin").length ?? 0;
  const freeUsers = usersRes.data?.filter((u) => u.role === "free").length ?? 0;

  const analyticsEvents = analyticsRes.data ?? [];
  const paymentCompleted = analyticsEvents.filter(e => e.event_name === 'payment_completed');
  const digitalRevenue = paymentCompleted.reduce((sum, e) => sum + (Number(e.event_data?.amount) || 0), 0);
  const subscriptionPayments = analyticsEvents.filter(e => e.event_name === 'subscription_upgraded').length;

  const booksReadThisWeek = userBooksRes.count ?? 0;
  const reviewsThisWeek = reviewsRes.count ?? 0;
  const recentSignups = newUsersThisWeek;
  const recentPayments = paymentCompleted.length;

  return {
    totalBooks, activeBooks, newBooksThisWeek,
    totalOrders, pendingOrders, completedOrders, revenuePhysical,
    totalUsers, newUsersThisWeek, subscribers, admins, freeUsers,
    digitalRevenue, subscriptionPayments,
    recentSignups, recentPayments, booksReadThisWeek, reviewsThisWeek,
  };
}

export default async function AdminDashboard() {
  let stats: AdminStats;

  try {
    stats = await getAdminStats();
  } catch (error) {
    console.error('[Admin] Error fetching stats:', error);
    stats = {
      totalBooks: 0, activeBooks: 0, newBooksThisWeek: 0,
      totalOrders: 0, pendingOrders: 0, completedOrders: 0, revenuePhysical: 0,
      totalUsers: 0, newUsersThisWeek: 0, subscribers: 0, admins: 0, freeUsers: 0,
      digitalRevenue: 0, subscriptionPayments: 0,
      recentSignups: 0, recentPayments: 0, booksReadThisWeek: 0, reviewsThisWeek: 0,
    };
  }

  const colorMap: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    green: "bg-green-500/10 text-green-400 border-green-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    pink: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  };

  const cardsLibros: AdminCard[] = [
    { label: "Libros en catálogo", value: stats.totalBooks, sub: `${stats.activeBooks} activos`, icon: BookOpen, href: "/admin/books", color: "blue" },
    { label: "Nuevos esta semana", value: stats.newBooksThisWeek, sub: "últimos 7 días", icon: Sparkles, href: "/admin/books", color: "cyan" },
  ];

  const cardsOrdenes: AdminCard[] = [
    { label: "Órdenes físicas", value: stats.totalOrders, sub: `${stats.pendingOrders} pendientes`, icon: ShoppingCart, href: "/admin/orders", color: "amber" },
    { label: "Ingresos físicos", value: `$${stats.revenuePhysical.toLocaleString("es-MX")}`, sub: `${stats.completedOrders} completadas`, icon: TrendingUp, href: "/admin/orders", color: "purple" },
  ];

  const cardsUsuarios: AdminCard[] = [
    { label: "Usuarios registrados", value: stats.totalUsers, sub: `${stats.newUsersThisWeek} nuevos`, icon: Users, href: "/admin/users", color: "green" },
    { label: "Suscriptores", value: stats.subscribers, sub: `${stats.freeUsers} free`, icon: CreditCard, href: "/admin/users", color: "emerald" },
  ];

  const cardsDigital: AdminCard[] = [
    { label: "Ingresos digitales", value: `$${stats.digitalRevenue.toLocaleString("es-MX")}`, sub: `${stats.subscriptionPayments} suscripciones`, icon: TrendingUp, href: "/admin/orders", color: "indigo" },
    { label: "Pagos esta semana", value: stats.recentPayments, sub: "últimos 7 días", icon: Activity, href: "/admin/users", color: "pink" },
  ];

  const cardsEngagement: AdminCard[] = [
    { label: "Libros leídos", value: stats.booksReadThisWeek, sub: "esta semana", icon: Library, href: "/admin/books", color: "violet" },
    { label: "Reseñas", value: stats.reviewsThisWeek, sub: "esta semana", icon: Eye, href: "/admin/books", color: "orange" },
  ];

  const CardGrid = ({ cards }: { cards: AdminCard[] }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4">
      {cards.map((card) => (
        <Link key={card.label} href={card.href} className="group relative bg-white/5 border border-white/8 rounded-2xl p-5 hover:bg-white/8 transition-all">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${colorMap[card.color]}`}>
            <card.icon className="w-5 h-5" />
          </div>
          <div className="flex items-start justify-between mt-4">
            <div>
              <div className="text-2xl font-bold">{card.value}</div>
              <div className="text-sm text-white/40 mt-0.5">{card.label}</div>
              <div className="text-xs text-white/25 mt-0.5">{card.sub}</div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" />
          </div>
        </Link>
      ))}
    </div>
  );

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-white/40 text-sm mt-1">Visión general de Bookea</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/30 bg-white/5 px-3 py-1.5 rounded-lg">
          <Calendar className="w-3.5 h-3.5" />
          {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
          <BookOpen className="w-4 h-4" /> Catálogo
        </h2>
        <CardGrid cards={cardsLibros} />
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" /> Órdenes Físicas
        </h2>
        <CardGrid cards={cardsOrdenes} />
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Users className="w-4 h-4" /> Usuarios
        </h2>
        <CardGrid cards={cardsUsuarios} />
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4" /> Pagos Digitales
        </h2>
        <CardGrid cards={cardsDigital} />
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4" /> Engagement
        </h2>
        <CardGrid cards={cardsEngagement} />
      </section>

      <div className="bg-white/5 border border-white/8 rounded-2xl p-6">
        <h2 className="font-semibold mb-4 text-white/80 flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> Acciones rápidas
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/books?action=new" className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
            + Agregar libro
          </Link>
          <Link href="/admin/orders" className="px-4 py-2.5 bg-white/8 text-white/70 text-sm font-medium rounded-xl hover:bg-white/12 transition-colors border border-white/10">
            Ver órdenes pendientes
          </Link>
          <Link href="/admin/users" className="px-4 py-2.5 bg-white/8 text-white/70 text-sm font-medium rounded-xl hover:bg-white/12 transition-colors border border-white/10">
            Gestionar usuarios
          </Link>
        </div>
      </div>
    </div>
  );
}