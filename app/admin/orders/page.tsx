"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { Package, CheckCircle2, Truck, Clock, Loader2 } from "lucide-react";

interface Order {
  id: string;
  user_id: string;
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
  created_at: string;
  books?: { title: string; author: string } | null;
}

const STATUS_LABELS: Record<Order["status"], { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
  shipped: { label: "Enviado", color: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
  delivered: { label: "Entregado", color: "bg-green-500/10 text-green-400 border border-green-500/20" },
  cancelled: { label: "Cancelado", color: "bg-red-500/10 text-red-400 border border-red-500/20" },
};

const STATUS_FLOW: Order["status"][] = ["pending", "shipped", "delivered", "cancelled"];

export default function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const supabase = createClientClient();

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders_physical")
        .select("*, books(title, author)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Order["status"] }) => {
      const { error } = await supabase
        .from("orders_physical")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-orders"] }),
  });

  const pending = orders.filter((o) => o.status === "pending").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Órdenes físicas</h1>
          <p className="text-white/40 text-sm mt-1">
            {orders.length} orden{orders.length !== 1 ? "es" : ""} · {pending} pendiente{pending !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-white/20" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No hay órdenes todavía.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const statusInfo = STATUS_LABELS[order.status];
            const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(order.status) + 1];

            return (
              <div
                key={order.id}
                className="bg-white/5 border border-white/8 rounded-2xl p-5 hover:bg-white/7 transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      <span className="text-xs text-white/30">
                        {new Date(order.created_at).toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <p className="font-semibold text-white truncate">
                      {(order.books as any)?.title ?? "Libro desconocido"}
                    </p>
                    <p className="text-sm text-white/50 mt-0.5">
                      {order.name} — {order.city}, {order.state} {order.zip}
                    </p>
                    <p className="text-xs text-white/30 mt-0.5">{order.address} · {order.phone}</p>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <div className="text-right">
                      <p className="font-bold text-white">${order.total} MXN</p>
                      <p className="text-xs text-white/30">Envío: ${order.shipping_cost}</p>
                    </div>

                    {nextStatus && (
                      <button
                        onClick={() => updateStatus.mutate({ id: order.id, status: nextStatus })}
                        disabled={updateStatus.isPending}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-white/8 rounded-lg hover:bg-white/15 transition-colors border border-white/10 text-white/70"
                      >
                        {nextStatus === "shipped" && <Truck className="w-3.5 h-3.5" />}
                        {nextStatus === "delivered" && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {nextStatus === "cancelled" && <Clock className="w-3.5 h-3.5" />}
                        Marcar como {STATUS_LABELS[nextStatus].label}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
