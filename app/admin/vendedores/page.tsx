"use client";

import { useQuery } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { getAdminSellers } from "@/lib/sellers";
import { Store, Users, Package, TrendingDown, Loader2, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function AdminVendedoresPage() {
  const supabase = createClientClient();

  const { data: sellers = [], isLoading } = useQuery({
    queryKey: ["admin-sellers"],
    queryFn: () => getAdminSellers(supabase),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 pl-10 md:pl-0">
            <Store className="w-6 h-6 text-blue-500 dark:text-blue-400" />
            <span>Vendedores</span>
          </h1>
          <p className="text-white/40 text-sm mt-1">
            {sellers.length} vendedor{sellers.length !== 1 ? "es" : ""}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-white/20" />
        </div>
      ) : sellers.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <Store className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No hay vendedores registrados.</p>
          <p className="text-sm text-white/20 mt-1">
            Convierte un usuario en vendedor desde la sección Usuarios.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sellers.map((seller) => (
            <Link
              key={seller.id}
              href={`/admin/vendedores/${seller.id}`}
              className="group bg-white/5 border border-white/8 rounded-2xl p-5 hover:bg-white/8 transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                  <Store className="w-5 h-5" />
                </div>
                <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" />
              </div>
              <p className="font-semibold text-white truncate">{seller.email}</p>
              <p className="text-xs text-white/30 mt-0.5">
                Registrado {new Date(seller.created_at).toLocaleDateString("es-MX")}
              </p>
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/5">
                <div>
                  <p className="text-lg font-bold text-white">{seller.inventory_count}</p>
                  <p className="text-[11px] text-white/40">Libros en stock</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{seller.total_assigned}</p>
                  <p className="text-[11px] text-white/40">Asignados</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-400">{seller.total_sold}</p>
                  <p className="text-[11px] text-white/40">Vendidos</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
