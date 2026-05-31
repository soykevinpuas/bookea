"use client";

import { useQuery } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { getSellerRequests } from "@/lib/sellers";
import { useUserId } from "@/hooks/useUser";
import { ShoppingCart, Loader2, Package } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
  shipped: { label: "Enviado", color: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
  delivered: { label: "Entregado", color: "bg-green-500/10 text-green-400 border border-green-500/20" },
  cancelled: { label: "Cancelado", color: "bg-red-500/10 text-red-400 border border-red-500/20" },
};

export default function MisSolicitudesPage() {
  const supabase = createClientClient();
  const { userId } = useUserId();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["seller-requests", userId],
    queryFn: () => getSellerRequests(supabase, userId!),
    enabled: !!userId,
  });

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
      ) : requests.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No has realizado solicitudes todavía.</p>
          <p className="text-sm text-white/20 mt-1">
            Solicita reposición de stock desde la sección Solicitar Stock.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
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
                  {req.items?.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-white/70">
                        {(item.books as any)?.title ?? "Libro"}
                      </span>
                      <span className="text-white font-medium">x{item.quantity}</span>
                    </div>
                  ))}
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

                {req.status === "delivered" && (
                  <p className="text-xs text-green-400 mt-1">Recibido por el vendedor</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
