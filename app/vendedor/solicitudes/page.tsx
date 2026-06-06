"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { getSellerRequests } from "@/lib/sellers";
import { receiveStockItemAction } from "@/lib/actions/sellers";
import { useUserId } from "@/hooks/useUser";
import { ShoppingCart, Loader2, Package, Check, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
  shipped: { label: "Enviado", color: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
  delivered: { label: "Entregado", color: "bg-green-500/10 text-green-400 border border-green-500/20" },
  cancelled: { label: "Cancelado", color: "bg-red-500/10 text-red-400 border border-red-500/20" },
};

const STATUS_TABS = [
  { key: "all", label: "Todas" },
  { key: "pending", label: "Pendientes" },
  { key: "shipped", label: "Enviadas" },
  { key: "delivered", label: "Entregadas" },
  { key: "cancelled", label: "Canceladas" },
];

export default function MisSolicitudesPage() {
  const supabase = createClientClient();
  const { userId } = useUserId();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["seller-requests", userId],
    queryFn: () => getSellerRequests(supabase, userId!),
    enabled: !!userId,
  });

  const queryClient = useQueryClient();

  const [receivingItems, setReceivingItems] = useState<Set<string>>(new Set());

  const receiveMutation = useMutation({
    mutationFn: async ({ itemId, requestId }: { itemId: string; requestId: string }) => {
      return await receiveStockItemAction(itemId, requestId);
    },
    onMutate: ({ itemId }) => {
      setReceivingItems(prev => new Set(prev).add(itemId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-requests", userId] });
      toast.success("Libro recibido y añadido a tu inventario");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al recibir libro");
    },
    onSettled: () => {
      setReceivingItems(new Set());
    },
  });

  const filteredRequests = statusFilter === "all"
    ? requests
    : requests.filter((r: any) => r.status === statusFilter);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-amber-400" />
            Mis Solicitudes
          </h1>
          <p className="text-white/40 text-sm mt-1">
            {requests.length} solicitud{requests.length !== 1 ? "es" : ""}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-white/20" />
        </div>
      ) : (
        <>
          {/* Status filter tabs */}
          <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${
                  statusFilter === tab.key
                    ? "bg-amber-600/20 text-amber-400 border border-amber-500/20"
                    : "text-white/40 hover:text-white/60 border border-transparent"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filteredRequests.length === 0 ? (
            <div className="text-center py-20 text-white/30">
              <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No hay solicitudes {statusFilter !== "all" ? `${STATUS_TABS.find(t => t.key === statusFilter)?.label.toLowerCase()}` : ""}.</p>
              <p className="text-sm text-white/20 mt-1">
                Solicita reposición de stock desde la sección Solicitar Stock.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((req) => {
                const statusInfo = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
                const totalItems = req.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;

                return (
                  <div
                    key={req.id}
                    className="bg-white/5 border border-white/8 rounded-2xl p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                        <span className="text-xs text-white/30">
                          {new Date(req.created_at).toLocaleDateString("es-MX", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <span className="text-xs text-white/40">{totalItems} uds.</span>
                    </div>

                    <div className="space-y-1 mb-3">
                      {req.items?.map((item) => {
                        const book = item.books as any;
                        const isReceived = !!item.received_at;
                        const isReceiving = receivingItems.has(item.id);
                        return (
                          <div key={item.id} className="flex items-center gap-2 text-sm">
                            {book?.cover_url && (
                              <img src={book.cover_url} alt="" className="w-7 h-10 rounded object-cover bg-white/5 shrink-0" />
                            )}
                            <span className="text-white/70 flex-1 min-w-0 truncate">
                              {book?.title ?? "Libro"}
                            </span>
                            <span className="text-white font-medium shrink-0">x{item.quantity}</span>

                            {req.status === "shipped" && !isReceived && (
                              <button
                                onClick={() => receiveMutation.mutate({ itemId: item.id, requestId: req.id })}
                                disabled={isReceiving}
                                className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-all disabled:opacity-50 shrink-0"
                              >
                                {isReceiving ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Truck className="w-3 h-3" />
                                )}
                                Recibir
                              </button>
                            )}

                            {isReceived && (
                              <span className="text-[10px] text-green-400 font-medium flex items-center gap-1 shrink-0">
                                <Check className="w-3 h-3" />
                                Recibido
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {req.notes && (
                      <p className="text-xs text-white/30 italic mb-2">"{req.notes}"</p>
                    )}

                    {req.tracking_number && (
                      <p className="text-xs text-blue-400 flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        Guía de envío: {req.tracking_number}
                      </p>
                    )}

                    {req.status === "shipped" && (
                      <p className="text-xs text-blue-400/60 mt-1 flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        En tránsito — confirma recepción de cada libro
                      </p>
                    )}
                    {req.status === "delivered" && (
                      <p className="text-xs text-green-400 mt-1">Recibido por el vendedor</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
