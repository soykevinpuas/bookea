"use client";

import { useQuery } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { useUserId } from "@/hooks/useUser";
import { Package, Truck, CheckCircle2, Clock, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Order {
  id: string;
  book_id: string;
  status: "pending" | "shipped" | "delivered" | "cancelled";
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  shipping_cost: number;
  total: number;
  tracking_number: string | null;
  created_at: string;
  books?: { id: string; title: string; cover_url: string | null; author: string } | null;
}

const STATUS_CONFIG: Record<Order["status"], { label: string; color: string; icon: any; msg: string }> = {
  pending: {
    label: "Pendiente",
    color: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    icon: Clock,
    msg: "El administrador procesará tu envío pronto.",
  },
  shipped: {
    label: "Enviado",
    color: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    icon: Truck,
    msg: "Tu pedido está en camino.",
  },
  delivered: {
    label: "Entregado",
    color: "bg-green-500/10 text-green-400 border border-green-500/20",
    icon: CheckCircle2,
    msg: "Entregado — gracias por tu compra.",
  },
  cancelled: {
    label: "Cancelado",
    color: "bg-red-500/10 text-red-400 border border-red-500/20",
    icon: Clock,
    msg: "Esta orden fue cancelada.",
  },
};

export default function OrdersPage() {
  const { userId, isLoading: authLoading } = useUserId();
  const supabase = createClientClient();

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["user-orders", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("orders_physical")
        .select("*, books(id, title, cover_url, author)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Order[];
    },
    enabled: !!userId,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] retro:bg-[#0d1117] transition-colors duration-300">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Mis Órdenes
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Historial de tus compras de libros físicos.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm">
            <Package className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-white/20" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Sin órdenes</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Aún no has comprado libros físicos.
            </p>
            <Link
              href="/catalog?tab=fisicos"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all"
            >
              Explorar catálogo físico
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const cfg = STATUS_CONFIG[order.status];
              const StatusIcon = cfg.icon;
              const book = order.books as Order["books"];

              return (
                <div
                  key={order.id}
                  className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    {/* Book cover */}
                    <Link href={`/book/${book?.id || order.book_id}`} className="shrink-0">
                      {book?.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="w-14 h-20 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-14 h-20 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-lg text-gray-400">
                          📚
                        </div>
                      )}
                    </Link>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.color} flex items-center gap-1`}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                        <span className="text-[11px] text-gray-400 dark:text-white/30">
                          {new Date(order.created_at).toLocaleDateString("es-MX", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      <Link
                        href={`/book/${book?.id || order.book_id}`}
                        className="font-bold text-sm sm:text-base text-gray-900 dark:text-white truncate block hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        {book?.title || "Libro"}
                      </Link>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {book?.author || ""}
                      </p>

                      <p className="text-xs text-gray-400 dark:text-white/30 mt-2 leading-relaxed">
                        {order.name} · {order.city}, {order.state} {order.zip}<br />
                        {order.address} · {order.phone}
                      </p>

                      {/* Tracking number */}
                      {order.tracking_number && (
                        <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-500 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg">
                          <Package className="w-3 h-3" />
                          Guía: {order.tracking_number}
                        </div>
                      )}

                      {/* Status message */}
                      <p className="text-xs text-gray-400 dark:text-white/40 mt-3 italic">
                        {cfg.msg}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="text-right shrink-0">
                      <p className="font-bold text-gray-900 dark:text-white">${order.total} MXN</p>
                      <p className="text-[10px] text-gray-400 dark:text-white/30">Envío: ${order.shipping_cost}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
