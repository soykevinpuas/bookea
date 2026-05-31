"use client";

import { useQuery } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { getSellerInventory, getSellerSales, getSellerRequests } from "@/lib/sellers";
import { useUserId } from "@/hooks/useUser";
import { Package, TrendingDown, Truck, Loader2, Store } from "lucide-react";
import Link from "next/link";

export default function VendedorDashboard() {
  const supabase = createClientClient();
  const { userId } = useUserId();

  const { data: inventory = [] } = useQuery({
    queryKey: ["seller-inventory", userId],
    queryFn: () => getSellerInventory(supabase, userId!),
    enabled: !!userId,
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["seller-sales", userId],
    queryFn: () => getSellerSales(supabase, userId!),
    enabled: !!userId,
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["seller-requests", userId],
    queryFn: () => getSellerRequests(supabase, userId!),
    enabled: !!userId,
  });

  const totalStock = inventory.reduce((s, i) => s + i.quantity, 0);
  const totalSold = sales.reduce((s, i) => s + i.quantity, 0);
  const activeRequests = requests.filter((r) => r.status === "pending").length;
  const lowStock = inventory.filter((i) => i.quantity <= 2);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Store className="w-6 h-6 text-amber-400" />
          Panel de Vendedor
        </h1>
        <p className="text-white/40 text-sm mt-1">Gestiona tu inventario y solicitudes</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
          <p className="text-2xl font-bold text-white">{totalStock}</p>
          <p className="text-sm text-white/40 mt-1">Libros en stock</p>
        </div>
        <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
          <p className="text-2xl font-bold text-amber-400">{totalSold}</p>
          <p className="text-sm text-white/40 mt-1">Vendidos</p>
        </div>
        <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
          <p className="text-2xl font-bold text-white">{inventory.length}</p>
          <p className="text-sm text-white/40 mt-1">Títulos diferentes</p>
        </div>
        <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
          <p className="text-2xl font-bold text-blue-400">{activeRequests}</p>
          <p className="text-sm text-white/40 mt-1">Solicitudes activas</p>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-8">
          <p className="text-sm font-medium text-amber-400 flex items-center gap-2 mb-2">
            <Package className="w-4 h-4" />
            Libros con stock bajo ({lowStock.length})
          </p>
          <div className="space-y-1">
            {lowStock.map((item) => (
              <div key={item.id} className="flex justify-between text-sm text-white/60">
                <span>{item.books?.title}</span>
                <span className="font-medium text-amber-400">{item.quantity} uds.</span>
              </div>
            ))}
          </div>
          <Link
            href="/vendedor/solicitudes/nueva"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
          >
            <Truck className="w-3.5 h-3.5" />
            Solicitar reposición
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-white/50" /> Últimos en inventario
          </h2>
          {inventory.length === 0 ? (
            <p className="text-white/30 text-sm">
              No tienes libros en inventario. Solicita stock para comenzar.
            </p>
          ) : (
            <div className="space-y-2">
              {inventory.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="bg-white/5 border border-white/8 rounded-xl px-4 py-3 flex items-center gap-3"
                >
                  {item.books?.cover_url && (
                    <img
                      src={item.books.cover_url}
                      alt=""
                      className="w-10 h-14 rounded-lg object-cover bg-white/5"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.books?.title}</p>
                    <p className="text-xs text-white/40 truncate">{item.books?.author}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{item.quantity}</p>
                    <p className="text-xs text-white/40">uds.</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-amber-400" /> Últimas ventas
          </h2>
          {sales.length === 0 ? (
            <p className="text-white/30 text-sm">Aún no has registrado ventas.</p>
          ) : (
            <div className="space-y-2">
              {sales.slice(0, 5).map((sale) => (
                <div
                  key={sale.id}
                  className="bg-white/5 border border-white/8 rounded-xl px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {sale.books?.cover_url && (
                      <img
                        src={sale.books.cover_url}
                        alt=""
                        className="w-8 h-10 rounded object-cover bg-white/5"
                      />
                    )}
                    <div>
                      <p className="text-sm font-medium">{sale.books?.title}</p>
                      <p className="text-xs text-white/40">
                        {new Date(sale.sold_at).toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-amber-400">-{sale.quantity}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
