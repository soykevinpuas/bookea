"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { Package, CheckCircle2, Truck, Clock, Loader2 } from "lucide-react";
import { useState } from "react";
import { queryKeys } from "@/lib/query-keys";

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
  tracking_number: string | null;
  created_at: string;
  books?: { title: string; author: string } | null;
}

const STATUS_LABELS: Record<Order["status"], { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
  shipped: { label: "Enviado", color: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
  delivered: { label: "Entregado", color: "bg-green-500/10 text-green-400 border border-green-500/20" },
  cancelled: { label: "Cancelado", color: "bg-red-500/10 text-red-400 border border-red-500/20" },
};

export default function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const supabase = createClientClient();

  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: queryKeys.orders.admin,
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
    mutationFn: async ({ id, status, tracking_number }: { id: string; status: Order["status"]; tracking_number?: string }) => {
      const update: { status: Order["status"]; tracking_number?: string } = { status };
      if (tracking_number !== undefined) update.tracking_number = tracking_number;
      const { error } = await supabase
        .from("orders_physical")
        .update(update)
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status, tracking_number }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.admin });
      const previous = queryClient.getQueryData<Order[]>(queryKeys.orders.admin);
      queryClient.setQueryData<Order[]>(queryKeys.orders.admin, (old) => old?.map((order) =>
        order.id === id
          ? { ...order, status, ...(tracking_number !== undefined ? { tracking_number } : {}) }
          : order
      ));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.orders.admin, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
  });

  const handleShipWithTracking = (order: Order) => {
    const tracking = trackingInputs[order.id]?.trim();
    if (!tracking) {
      alert("Ingresa el número de guía antes de marcar como enviado.");
      return;
    }
    updateStatus.mutate({ id: order.id, status: "shipped", tracking_number: tracking });
  };

  const pending = orders.filter((o) => o.status === "pending").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 pl-10 md:pl-0">
            <Package className="w-6 h-6 text-blue-500 dark:text-blue-400" />
            <span>Órdenes físicas</span>
          </h1>
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
                      {order.books?.title ?? "Libro desconocido"}
                    </p>
                    <p className="text-sm text-white/50 mt-0.5">
                      {order.name} — {order.city}, {order.state} {order.zip}
                    </p>
                    <p className="text-xs text-white/30 mt-0.5">{order.address} · {order.phone}</p>
                    {order.tracking_number && (
                      <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        Guía: {order.tracking_number}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <div className="text-right">
                      <p className="font-bold text-white">${order.total} MXN</p>
                      <p className="text-xs text-green-400 font-semibold">Envío gratis</p>
                    </div>

                    {order.status === "pending" && (
                      <div className="flex flex-col items-end gap-2">
                        <input
                          value={trackingInputs[order.id] || ""}
                          onChange={(e) => setTrackingInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                          placeholder="Número de guía"
                          className="w-full text-xs px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 outline-none focus:border-blue-500/50 transition-colors"
                        />
                        <button
                          onClick={() => handleShipWithTracking(order)}
                          disabled={updateStatus.isPending}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          Marcar como Enviado
                        </button>
                        <button
                          onClick={() => updateStatus.mutate({ id: order.id, status: "cancelled" })}
                          disabled={updateStatus.isPending}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 rounded-lg transition-colors border border-white/10"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Cancelar
                        </button>
                      </div>
                    )}

                    {order.status === "shipped" && (
                      <button
                        onClick={() => updateStatus.mutate({ id: order.id, status: "delivered" })}
                        disabled={updateStatus.isPending}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Marcar como Entregado
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
