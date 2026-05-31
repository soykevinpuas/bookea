"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { getAllStockRequests, updateStockRequestStatus } from "@/lib/sellers";
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import type { StockRequest } from "@/types/seller";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
  shipped: { label: "Enviado", color: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
  delivered: { label: "Entregado", color: "bg-green-500/10 text-green-400 border border-green-500/20" },
  cancelled: { label: "Cancelado", color: "bg-red-500/10 text-red-400 border border-red-500/20" },
};

const STATUS_FLOW: StockRequest["status"][] = ["pending", "shipped", "delivered", "cancelled"];

export default function AdminStockRequestsPage() {
  const queryClient = useQueryClient();
  const supabase = createClientClient();

  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});

  const { data: requests = [], isLoading } = useQuery<StockRequest[]>({
    queryKey: ["admin-stock-requests"],
    queryFn: () => getAllStockRequests(supabase),
  });

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      tracking_number,
    }: {
      id: string;
      status: StockRequest["status"];
      tracking_number?: string;
    }) => {
      await updateStockRequestStatus(supabase, id, status, tracking_number);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-stock-requests"] }),
  });

  const handleShip = (req: StockRequest) => {
    const tracking = trackingInputs[req.id]?.trim();
    if (!tracking) {
      alert("Ingresa el número de guía antes de marcar como enviado.");
      return;
    }
    updateStatus.mutate({ id: req.id, status: "shipped", tracking_number: tracking });
  };

  const pending = requests.filter((r) => r.status === "pending").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Solicitudes de Stock</h1>
          <p className="text-white/40 text-sm mt-1">
            {requests.length} solicitud{requests.length !== 1 ? "es" : ""} · {pending} pendiente
            {pending !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-white/20" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No hay solicitudes de stock todavía.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const statusInfo = STATUS_LABELS[req.status];

            return (
              <div
                key={req.id}
                className="bg-white/5 border border-white/8 rounded-2xl p-5 hover:bg-white/7 transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </span>
                      <span className="text-xs text-white/30">
                        {new Date(req.created_at).toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <p className="text-sm text-white/50">
                      <span className="text-white/70 font-medium">Vendedor:</span>{" "}
                      {(req.seller as any)?.email ?? "Desconocido"}
                    </p>

                    <div className="mt-2 space-y-0.5">
                      {req.items?.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-white/70">
                            {(item.books as any)?.title ?? "Libro"} x{item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>

                    {req.notes && (
                      <p className="text-xs text-white/30 mt-2 italic">"{req.notes}"</p>
                    )}

                    {req.tracking_number && (
                      <p className="text-xs text-blue-400 mt-2 flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        Guía: {req.tracking_number}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    {req.status === "pending" && (
                      <div className="flex flex-col items-end gap-2">
                        <input
                          value={trackingInputs[req.id] || ""}
                          onChange={(e) =>
                            setTrackingInputs((prev) => ({
                              ...prev,
                              [req.id]: e.target.value,
                            }))
                          }
                          placeholder="Número de guía"
                          className="w-full text-xs px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 outline-none focus:border-blue-500/50 transition-colors"
                        />
                        <button
                          onClick={() => handleShip(req)}
                          disabled={updateStatus.isPending}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          Marcar como Enviado
                        </button>
                        <button
                          onClick={() =>
                            updateStatus.mutate({ id: req.id, status: "cancelled" })
                          }
                          disabled={updateStatus.isPending}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 rounded-lg transition-colors border border-white/10"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Cancelar
                        </button>
                      </div>
                    )}

                    {req.status === "shipped" && (
                      <button
                        onClick={() =>
                          updateStatus.mutate({ id: req.id, status: "delivered" })
                        }
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
