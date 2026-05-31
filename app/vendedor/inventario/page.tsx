"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { getSellerInventory, markAsSold } from "@/lib/sellers";
import { useUserId } from "@/hooks/useUser";
import { Package, Loader2, Minus, Search, Store } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function VendedorInventarioPage() {
  const supabase = createClientClient();
  const { userId } = useUserId();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selling, setSelling] = useState<{ bookId: string; title: string; qty: number } | null>(
    null
  );

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ["seller-inventory", userId],
    queryFn: () => getSellerInventory(supabase, userId!),
    enabled: !!userId,
  });

  const sellMutation = useMutation({
    mutationFn: async () => {
      if (!selling) return;
      await markAsSold(supabase, userId!, selling.bookId, selling.qty);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-inventory", userId] });
      queryClient.invalidateQueries({ queryKey: ["seller-sales", userId] });
      toast.success("Venta registrada");
      setSelling(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const filtered = inventory.filter(
    (item) =>
      item.books?.title.toLowerCase().includes(search.toLowerCase()) ||
      item.books?.author.toLowerCase().includes(search.toLowerCase())
  );

  const totalStock = inventory.reduce((s, i) => s + i.quantity, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-amber-400" />
            Mi Inventario
          </h1>
          <p className="text-white/40 text-sm mt-1">
            {inventory.length} título{inventory.length !== 1 ? "s" : ""} · {totalStock} unidad
            {totalStock !== 1 ? "es" : ""}
          </p>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar en tu inventario..."
          className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 outline-none focus:border-amber-500/50 transition-colors text-sm"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-white/20" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <Store className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{search ? "Sin resultados." : "No tienes libros en inventario."}</p>
          {!search && (
            <p className="text-sm text-white/20 mt-1">
              Solicita stock al administrador para comenzar a vender.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`bg-white/5 border rounded-2xl p-4 transition-all ${
                item.quantity <= 2
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-white/8 hover:bg-white/8"
              }`}
            >
              <div className="aspect-[3/4] rounded-xl overflow-hidden bg-white/5 mb-3">
                {item.books?.cover_url ? (
                  <img
                    src={item.books.cover_url}
                    alt={item.books.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/10">
                    <Package className="w-10 h-10" />
                  </div>
                )}
              </div>
              <p className="font-medium text-sm truncate min-w-0">{item.books?.title ?? "Libro sin título"}</p>
              <p className="text-xs text-white/40 truncate mb-3 min-w-0">{item.books?.author ?? "—"}</p>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold text-white">{item.quantity}</p>
                  <p className="text-[10px] text-white/30">en stock</p>
                </div>
                {item.quantity > 0 && (
                  <button
                    onClick={() =>
                      setSelling({
                        bookId: item.book_id,
                        title: item.books?.title ?? "Libro",
                        qty: 1,
                      })
                    }
                    className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                    Vendido
                  </button>
                )}
              </div>
              {item.quantity <= 0 && (
                <p className="text-xs text-amber-400 font-medium">Sin stock</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sell Modal */}
      {selling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-lg mb-2">Registrar venta</h3>
            <p className="text-sm text-white/60 mb-4">
              ¿Cuántos ejemplares de <strong>{selling.title}</strong> se vendieron?
            </p>
            <div className="flex items-center justify-center gap-4 mb-6">
              <button
                onClick={() => setSelling({ ...selling, qty: Math.max(1, selling.qty - 1) })}
                className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 flex items-center justify-center"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-3xl font-bold w-12 text-center">{selling.qty}</span>
              <button
                onClick={() => setSelling({ ...selling, qty: selling.qty + 1 })}
                className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 flex items-center justify-center"
              >
                <Minus className="w-4 h-4 rotate-90" />
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSelling(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => sellMutation.mutate()}
                disabled={sellMutation.isPending}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {sellMutation.isPending ? "Registrando..." : "Confirmar venta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
