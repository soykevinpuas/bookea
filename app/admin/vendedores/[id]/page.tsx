"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { getAdminSellerDetail, assignStock, getPhysicalBooks, revertAssignStock } from "@/lib/sellers";
import {
  Store,
  Package,
  TrendingDown,
  Loader2,
  ChevronLeft,
  Plus,
  Minus,
  Truck,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export default function AdminSellerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClientClient();
  const queryClient = useQueryClient();

  const [showAssign, setShowAssign] = useState(false);
  const [assignBookId, setAssignBookId] = useState("");
  const [assignQty, setAssignQty] = useState(1);
  const [bookSearch, setBookSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-seller-detail", id],
    queryFn: () => getAdminSellerDetail(supabase, id),
    enabled: !!id,
  });

  const { data: physicalBooks = [] } = useQuery({
    queryKey: ["physical-books"],
    queryFn: () => getPhysicalBooks(supabase),
  });

  const assignMutation = useMutation({
    mutationFn: () => assignStock(supabase, id, assignBookId, assignQty),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-seller-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      setShowAssign(false);
      setAssignBookId("");
      setAssignQty(1);
      toast.success("Stock asignado correctamente");
    },
    onError: (err) => toast.error(err.message),
  });

  const revertMutation = useMutation({
    mutationFn: ({ bookId, qty }: { bookId: string; qty: number }) =>
      revertAssignStock(supabase, id, bookId, qty),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-seller-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      toast.success("Stock revertido");
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredBooks = physicalBooks.filter(
    (b: any) =>
      b.title.toLowerCase().includes(bookSearch.toLowerCase()) ||
      b.author.toLowerCase().includes(bookSearch.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white/20" />
      </div>
    );
  }

  if (!data?.seller) {
    return <div className="text-center py-20 text-white/30">Vendedor no encontrado</div>;
  }

  const { seller, inventory, sales, requests } = data;

  const salesMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const sale of sales) {
      map.set(sale.book_id, (map.get(sale.book_id) || 0) + sale.quantity);
    }
    return map;
  }, [sales]);

  const totalRevenue = sales.reduce((s, i) => s + i.sale_price * i.quantity, 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/admin/vendedores"
          className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3 pl-10 md:pl-0">
            <Store className="w-6 h-6 text-amber-400" />
            <span>{seller.email}</span>
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Vendedor desde {new Date(seller.created_at).toLocaleDateString("es-MX")}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
          <p className="text-2xl font-bold text-white">
            {inventory.reduce((s, i) => s + i.quantity, 0)}
          </p>
          <p className="text-sm text-white/40">Stock actual</p>
        </div>
        <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
          <p className="text-2xl font-bold text-amber-400">
            {sales.reduce((s, i) => s + i.quantity, 0)}
          </p>
          <p className="text-sm text-white/40">Vendidos</p>
        </div>
        <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
          <p className="text-2xl font-bold text-green-400">
            ${totalRevenue.toLocaleString("es-MX")}
          </p>
          <p className="text-sm text-white/40">Ingresos</p>
        </div>
        <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
          <p className="text-2xl font-bold text-white">{requests.length}</p>
          <p className="text-sm text-white/40">Solicitudes</p>
        </div>
      </div>

      {/* Inventory */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-white/50" /> Inventario Actual
          </h2>
          <button
            onClick={() => setShowAssign(!showAssign)}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Asignar stock
          </button>
        </div>

        {showAssign && (
          <div className="bg-white/5 border border-white/8 rounded-2xl p-5 mb-4">
            <h3 className="font-medium mb-3">Asignar stock a {seller.email}</h3>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
                placeholder="Buscar libro físico..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 outline-none focus:border-blue-500/50"
              />
            </div>
            <div className="max-h-48 overflow-y-auto mb-3 space-y-1">
              {filteredBooks.map((book: any) => (
                <button
                  key={book.id}
                  onClick={() => setAssignBookId(book.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    assignBookId === book.id
                      ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                      : "text-white/60 hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <span className="font-medium">{book.title}</span>
                  <span className="text-white/30 ml-2">({book.author})</span>
                  <span className="text-white/20 text-xs ml-2">Stock: {book.stock_physical}</span>
                </button>
              ))}
              {filteredBooks.length === 0 && (
                <p className="text-sm text-white/30 py-2 text-center">Sin resultados</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAssignQty(Math.max(1, assignQty - 1))}
                  className="p-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-8 text-center font-medium">{assignQty}</span>
                <button
                  onClick={() => setAssignQty(assignQty + 1)}
                  className="p-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                onClick={() => assignMutation.mutate()}
                disabled={!assignBookId || assignMutation.isPending}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {assignMutation.isPending ? "Asignando..." : "Asignar"}
              </button>
              <button
                onClick={() => setShowAssign(false)}
                className="px-4 py-1.5 text-sm text-white/40 hover:text-white/60"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {inventory.length === 0 ? (
          <p className="text-white/30 text-sm">Sin stock asignado.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {inventory.map((item) => (
              <div
                key={item.id}
                className="bg-white/5 border border-white/8 rounded-2xl p-4"
              >
                <div className="flex gap-3">
                  {item.books?.cover_url && (
                    <img
                      src={item.books.cover_url}
                      alt=""
                      className="w-12 h-16 rounded-lg object-cover bg-white/5"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.books?.title}</p>
                    <p className="text-xs text-white/40 truncate">{item.books?.author}</p>
                    <p className="text-lg font-bold text-white mt-1">
                      {item.quantity}{" "}
                      <span className="text-sm font-normal text-white/40">uds.</span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                  <button
                    onClick={() =>
                      revertMutation.mutate({ bookId: item.book_id, qty: 1 })
                    }
                    disabled={revertMutation.isPending || item.quantity <= 0}
                    className="flex items-center gap-1 text-xs px-2 py-1 bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 rounded-lg transition-colors disabled:opacity-30"
                  >
                    <Minus className="w-3 h-3" />
                    Quitar 1
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sales History */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-amber-400" /> Ventas realizadas
        </h2>
        {sales.length === 0 ? (
          <p className="text-white/30 text-sm">Sin ventas registradas.</p>
        ) : (
          <div className="space-y-2">
            {sales.map((sale) => (
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
                    <p className="text-sm font-medium">{sale.books?.title ?? "Libro"}</p>
                    <p className="text-xs text-white/40">
                      {new Date(sale.sold_at).toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-amber-400">-{sale.quantity}</p>
                  <p className="text-xs text-green-400 font-medium">
                    ${(sale.sale_price * sale.quantity).toLocaleString("es-MX")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Stock Requests */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Truck className="w-5 h-5 text-white/50" /> Solicitudes de stock
        </h2>
        {requests.length === 0 ? (
          <p className="text-white/30 text-sm">Sin solicitudes.</p>
        ) : (
          <div className="space-y-2">
            {requests.map((req) => (
              <div
                key={req.id}
                className="bg-white/5 border border-white/8 rounded-xl px-4 py-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={req.status} />
                    <span className="text-xs text-white/30">
                      {new Date(req.created_at).toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                  {req.tracking_number && (
                    <span className="text-xs text-blue-400">Guía: {req.tracking_number}</span>
                  )}
                </div>
                <div className="space-y-1">
                  {req.items?.map((item) => {
                    const soldQty = salesMap.get(item.book_id) || 0;
                    const isReceived = !!item.received_at;
                    return (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-white/60">{item.books?.title ?? "Libro"}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">x{item.quantity}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            isReceived
                              ? soldQty >= item.quantity
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                : soldQty > 0
                                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                  : "bg-green-500/10 text-green-400 border border-green-500/20"
                              : "bg-white/5 text-white/30 border border-white/10"
                          }`}>
                            {isReceived
                              ? soldQty >= item.quantity
                                ? "Vendido"
                                : soldQty > 0
                                  ? `Vendido ${soldQty}/${item.quantity}`
                                  : "Recibido"
                              : "No recibido"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    shipped: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    delivered: "bg-green-500/10 text-green-400 border border-green-500/20",
    cancelled: "bg-red-500/10 text-red-400 border border-red-500/20",
  };
  const labels: Record<string, string> = {
    pending: "Pendiente",
    shipped: "Enviado",
    delivered: "Entregado",
    cancelled: "Cancelado",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles[status] ?? styles.pending}`}>
      {labels[status] ?? status}
    </span>
  );
}
