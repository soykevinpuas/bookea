"use client";

import AppImage from "@/components/ui/AppImage";
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
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import ErrorBoundary from "@/components/ErrorBoundary";
import StockRequestItemsModal from "@/components/StockRequestItemsModal";
import BookPreviewModal from "@/components/BookPreviewModal";

export default function AdminSellerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClientClient();
  const queryClient = useQueryClient();

  const { data: adminSession } = useQuery({
    queryKey: ["admin-session"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const [showAssign, setShowAssign] = useState(false);
  const [modalItems, setModalItems] = useState<UntypedValue[] | null>(null);
  const [showAllInventory, setShowAllInventory] = useState(false);
  const [showAllSales, setShowAllSales] = useState(false);
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [assignBookId, setAssignBookId] = useState("");
  const [assignQty, setAssignQty] = useState(1);
  const [previewBook, setPreviewBook] = useState<UntypedValue>(null);
  const [bookSearch, setBookSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-seller-detail", id],
    queryFn: () => getAdminSellerDetail(supabase, id),
    enabled: !!id,
  });

  const { data: physicalBooks = [] } = useQuery({
    queryKey: ["physical-books", adminSession?.id],
    queryFn: () => getPhysicalBooks(supabase, adminSession?.id),
    enabled: !!adminSession?.id,
  });

  const assignMutation = useMutation({
    mutationFn: () => assignStock(supabase, id, assignBookId, assignQty),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-seller-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
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
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      toast.success("Stock revertido");
    },
    onError: (err) => toast.error(err.message),
  });
  const revertingBookId = revertMutation.isPending ? revertMutation.variables?.bookId : null;

  const salesMap = useMemo(() => {
    try {
      const map = new Map<string, number>();
      const salesList = data?.sales || [];
      for (const sale of salesList) {
        const qty = sale.quantity || 0;
        map.set(sale.book_id, (map.get(sale.book_id) || 0) + qty);
      }
      return map;
    } catch (e) {
      console.error("[salesMap] error:", e);
      return new Map();
    }
  }, [data?.sales]);

  const totalRevenue = (data?.sales || []).reduce((s, i) => s + (i.sale_price || 0) * (i.quantity || 0), 0);

  const filteredBooks = physicalBooks.filter(
    (b: UntypedValue) =>
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

  return (
    <ErrorBoundary>
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
          <div className="relative overflow-hidden bg-white/5 border border-white/8 rounded-2xl p-5 mb-4">
            <h3 className="font-medium mb-3">Asignar stock a {seller.email}</h3>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
                placeholder="Buscar libro físico..."
                disabled={assignMutation.isPending}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 outline-none focus:border-blue-500/50"
              />
            </div>
            <div className="max-h-48 overflow-y-auto mb-3 space-y-1">
              {filteredBooks.map((book: UntypedValue) => {
                const isAssigningBook = assignMutation.isPending && assignBookId === book.id;
                return (
                  <button
                    key={book.id}
                    onClick={() => setAssignBookId(book.id)}
                    disabled={assignMutation.isPending}
                    className={`relative overflow-hidden w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      isAssigningBook
                        ? "bg-green-500/10 text-green-300 border border-green-500/30"
                        : assignBookId === book.id
                          ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                          : "text-white/60 hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <span className="font-medium">{book.title}</span>
                    <span className="text-white/30 ml-2">({book.author})</span>
                    <span className="text-white/20 text-xs ml-2">Stock: {book.stock_physical}</span>
                    {isAssigningBook && <div className="stock-progress-line" aria-hidden="true" />}
                  </button>
                );
              })}
              {filteredBooks.length === 0 && (
                <p className="text-sm text-white/30 py-2 text-center">Sin resultados</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAssignQty(Math.max(1, assignQty - 1))}
                  disabled={assignMutation.isPending}
                  className="p-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-8 text-center font-medium">{assignQty}</span>
                <button
                  onClick={() => setAssignQty(assignQty + 1)}
                  disabled={assignMutation.isPending}
                  className="p-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                onClick={() => assignMutation.mutate()}
                disabled={!assignBookId || assignMutation.isPending}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {assignMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {assignMutation.isPending ? "Asignando..." : "Asignar"}
              </button>
              <button
                onClick={() => setShowAssign(false)}
                disabled={assignMutation.isPending}
                className="px-4 py-1.5 text-sm text-white/40 hover:text-white/60 disabled:opacity-30 disabled:pointer-events-none"
              >
                Cancelar
              </button>
            </div>
            {assignMutation.isPending && <div className="stock-progress-line" aria-hidden="true" />}
          </div>
        )}

        {inventory.length === 0 ? (
          <p className="text-white/30 text-sm">Sin stock asignado.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {inventory.slice(0, 3).map((item) => {
              const isReverting = revertingBookId === item.book_id;
              return (
                <div
                  key={item.id}
                  className="bg-white/5 border border-white/8 rounded-2xl p-4"
                >
                  <div className="flex gap-3">
                    {item.books?.cover_url && (
                      <button onClick={() => setPreviewBook(item.books)} className="shrink-0 p-0 border-0 bg-transparent cursor-pointer">
                        <AppImage
                          src={item.books.cover_url}
                          alt=""
                          className="w-12 h-16 rounded-lg object-cover bg-white/5 hover:ring-2 hover:ring-blue-500/50 transition-all"
                        />
                      </button>
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
                      {isReverting ? <Loader2 className="w-3 h-3 animate-spin text-red-400" /> : <Minus className="w-3 h-3" />}
                      {isReverting ? "Quitando..." : "Quitar 1"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {inventory.length > 3 && (
          <button
            onClick={() => setShowAllInventory(true)}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors mt-3"
          >
            +{inventory.length - 3} libros más
          </button>
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
            {sales.slice(0, 3).map((sale) => (
              <div
                key={sale.id}
                className="bg-white/5 border border-white/8 rounded-xl px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {sale.books?.cover_url && (
                    <button onClick={() => setPreviewBook(sale.books)} className="shrink-0 p-0 border-0 bg-transparent cursor-pointer">
                      <AppImage
                        src={sale.books.cover_url}
                        alt=""
                        className="w-8 h-10 rounded object-cover bg-white/5 hover:ring-2 hover:ring-blue-500/50 transition-all"
                      />
                    </button>
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
                    ${((sale.sale_price || 0) * (sale.quantity || 0)).toLocaleString("es-MX")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        {sales.length > 3 && (
          <button
            onClick={() => setShowAllSales(true)}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors mt-3"
          >
            +{sales.length - 3} ventas más
          </button>
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
            {requests.slice(0, 3).map((req) => (
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
                  {(req.items ?? []).slice(0, 3).map((item) => {
                    const soldQty = salesMap.get(item.book_id) || 0;
                    const isReceived = !!item.received_at;
                    return (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 min-w-0 flex-1">
                          {item.books?.cover_url && (
                            <button onClick={() => setPreviewBook(item.books)} className="shrink-0 p-0 border-0 bg-transparent cursor-pointer">
                              <AppImage src={item.books.cover_url} alt="" className="w-5 h-7 rounded object-cover bg-white/5 hover:ring-2 hover:ring-blue-500/50 transition-all" />
                            </button>
                          )}
                          <span className="text-white/60 truncate">{item.books?.title ?? "Libro"}</span>
                          <span className="text-white/50 shrink-0">x{item.quantity}</span>
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
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
                    );
                  })}
                  {(req.items?.length ?? 0) > 3 && (
                    <button
                      onClick={() => setModalItems(req.items ?? [])}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1"
                    >
                      +{req.items!.length - 3} libros más
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {requests.length > 3 && (
          <button
            onClick={() => setShowAllRequests(true)}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors mt-3"
          >
            +{requests.length - 3} solicitudes más
          </button>
        )}
      </section>
    </div>

      {/* Modal: inventario completo */}
      {showAllInventory && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAllInventory(false)} />
          <div className="relative bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="sticky top-0 z-10 bg-[#1a1a1a] flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Inventario completo</h3>
              <button onClick={() => setShowAllInventory(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3">
              {inventory.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  {item.books?.cover_url && (
                    <button onClick={() => setPreviewBook(item.books)} className="shrink-0 p-0 border-0 bg-transparent cursor-pointer">
                      <AppImage src={item.books.cover_url} alt="" className="w-8 h-12 rounded object-cover bg-white/5 hover:ring-2 hover:ring-blue-500/50 transition-all" />
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-sm truncate">{item.books?.title ?? "Libro"}</p>
                    <p className="text-white/40 text-xs truncate">{item.books?.author}</p>
                  </div>
                  <span className="text-white font-medium text-sm shrink-0">{item.quantity} uds.</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: ventas completas */}
      {showAllSales && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAllSales(false)} />
          <div className="relative bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="sticky top-0 z-10 bg-[#1a1a1a] flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Ventas realizadas</h3>
              <button onClick={() => setShowAllSales(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3">
              {sales.map((sale) => (
                <div key={sale.id} className="flex items-center gap-3">
                  {sale.books?.cover_url && (
                    <button onClick={() => setPreviewBook(sale.books)} className="shrink-0 p-0 border-0 bg-transparent cursor-pointer">
                      <AppImage src={sale.books.cover_url} alt="" className="w-8 h-12 rounded object-cover bg-white/5 hover:ring-2 hover:ring-blue-500/50 transition-all" />
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-sm truncate">{sale.books?.title ?? "Libro"}</p>
                    <p className="text-white/40 text-xs">
                      {new Date(sale.sold_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <span className="text-white font-medium text-sm shrink-0">x{sale.quantity}</span>
                  <span className="text-xs font-bold text-green-400 shrink-0">
                    ${((sale.sale_price || 0) * (sale.quantity || 0)).toLocaleString("es-MX")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: solicitudes completas */}
      {showAllRequests && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAllRequests(false)} />
          <div className="relative bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="sticky top-0 z-10 bg-[#1a1a1a] flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Solicitudes de stock</h3>
              <button onClick={() => setShowAllRequests(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3">
              {requests.map((req) => (
                <div key={req.id} className="bg-white/5 border border-white/8 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={req.status} />
                      <span className="text-xs text-white/30">
                        {new Date(req.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    {req.tracking_number && (
                      <span className="text-xs text-blue-400">Guía: {req.tracking_number}</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {(req.items ?? []).slice(0, 3).map((item: UntypedValue) => {
                      const soldQty = salesMap.get(item.book_id) || 0;
                      const isReceived = !!item.received_at;
                      return (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 min-w-0 flex-1">
                            {item.books?.cover_url && (
                              <button onClick={() => setPreviewBook(item.books)} className="shrink-0 p-0 border-0 bg-transparent cursor-pointer">
                                <AppImage src={item.books.cover_url} alt="" className="w-5 h-7 rounded object-cover bg-white/5 hover:ring-2 hover:ring-blue-500/50 transition-all" />
                              </button>
                            )}
                            <span className="text-white/60 truncate">{item.books?.title ?? "Libro"}</span>
                            <span className="text-white/50 shrink-0">x{item.quantity}</span>
                          </span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
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
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <StockRequestItemsModal
        isOpen={!!modalItems}
        onClose={() => setModalItems(null)}
        items={modalItems ?? []}
        title="Libros en solicitud"
      >
        {(item: UntypedValue) => {
          const soldQty = salesMap.get(item.book_id) || 0;
          const isReceived = !!item.received_at;
          return (
            <div key={item.id} className="flex items-center gap-3">
              {item.books?.cover_url && (
                <button onClick={() => setPreviewBook(item.books)} className="shrink-0 p-0 border-0 bg-transparent cursor-pointer">
                  <AppImage src={item.books.cover_url} alt="" className="w-8 h-12 rounded object-cover bg-white/5 hover:ring-2 hover:ring-blue-500/50 transition-all" />
                </button>
              )}
              <span className="text-white/80 text-sm flex-1 min-w-0 truncate">
                {item.books?.title ?? "Libro"}
              </span>
              <span className="text-white font-medium text-sm shrink-0">x{item.quantity}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
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
          );
        }}
      </StockRequestItemsModal>

      {previewBook && (
        <BookPreviewModal book={previewBook} onClose={() => setPreviewBook(null)} />
      )}
    </ErrorBoundary>
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
