"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { getPhysicalBooks, getSellerInventory } from "@/lib/sellers";
import { createStockRequestAction } from "@/lib/actions/sellers";
import { useUserId } from "@/hooks/useUser";
import { ShoppingCart, Loader2, Plus, Minus, Search, X, Store, Package, ChevronLeft, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BookPreviewModal from "@/components/BookPreviewModal";

interface CartItem {
  book_id: string;
  title: string;
  quantity: number;
  max_stock: number;
}

export default function NuevaSolicitudPage() {
  const supabase = createClientClient();
  const { userId } = useUserId();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [previewBook, setPreviewBook] = useState<any>(null);

  const { data: books = [], isLoading: booksLoading } = useQuery({
    queryKey: ["physical-books"],
    queryFn: () => getPhysicalBooks(supabase),
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ["seller-inventory", userId],
    queryFn: () => getSellerInventory(supabase, userId!),
    enabled: !!userId,
  });

  const inventoryMap = new Map(inventory.map(i => [i.book_id, i.quantity]));
  const booksMap = new Map(books.map((b: any) => [b.id, b]));

  const addToCart = (book: any) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.book_id === book.id);
      if (existing) {
        return prev.map((c) =>
          c.book_id === book.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          book_id: book.id,
          title: book.title,
          quantity: 1,
          max_stock: book.stock_physical,
        },
      ];
    });
  };

  const updateQty = (bookId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.book_id !== bookId) return c;
          const book = booksMap.get(bookId) as any;
          const maxAllowed = book?.stock_physical ?? Infinity;
          return { ...c, quantity: Math.max(1, Math.min(maxAllowed, c.quantity + delta)) };
        })
        .filter((c) => c.quantity > 0)
    );
  };

  const removeFromCart = (bookId: string) => {
    setCart((prev) => prev.filter((c) => c.book_id !== bookId));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("No autenticado");
      const items = cart.map((c) => ({
        book_id: c.book_id,
        quantity: c.quantity,
      }));
      return await createStockRequestAction(userId, items, notes || undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-requests", userId] });
      queryClient.invalidateQueries({ queryKey: ["vendedor-dashboard"] });
      setCart([]);
      setNotes("");
      toast.success("Solicitud creada correctamente");
      router.push("/vendedor?seccion=solicitudes");
    },
    onError: (err) => {
      console.error("Error creando solicitud:", err);
      toast.error(err.message);
    },
  });

  const isFormValid = cart.length > 0;

  const booksInStock = books.filter((b: any) => b.stock_physical > 0);
  const filteredBooks = booksInStock.filter(
    (b: any) =>
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/vendedor"
          className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 pl-10 md:pl-0">
            <ShoppingCart className="w-6 h-6 text-amber-400" />
            Solicitar Stock
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Selecciona los libros que necesitas
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Book Selection */}
        <div className="lg:col-span-2">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar libros físicos..."
              className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 outline-none focus:border-amber-500/50 transition-colors text-sm"
            />
          </div>

          {booksLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-white/20" />
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="text-center py-20 text-white/30">
              <Store className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No hay libros físicos disponibles.</p>
              <p className="text-sm text-white/20 mt-1">Solo se muestran libros con stock disponible.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredBooks.map((book: any) => {
                const inCart = cart.find((c) => c.book_id === book.id);
                return (
                  <div
                    key={book.id}
                    className={`bg-white/5 border rounded-xl px-4 py-3 flex items-center justify-between transition-all ${
                      inCart ? "border-amber-500/30 bg-amber-500/5" : "border-white/8"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {book.cover_url && (
                        <button onClick={() => setPreviewBook(book)} className="shrink-0 p-0 border-0 bg-transparent cursor-pointer">
                          <img
                            src={book.cover_url}
                            alt=""
                            className="w-8 h-10 rounded object-cover bg-white/5 hover:ring-2 hover:ring-amber-500/50 transition-all"
                          />
                        </button>
                      )}
                      <div>
                        <p className="text-sm font-medium truncate">{book.title}</p>
                        <p className="text-xs text-white/40 truncate">{book.author}</p>
                        <p className="text-xs text-white/30">
                          Stock total: {book.stock_physical}
                          {book.stock_physical <= 3 && (
                            <span className="text-red-400 ml-1 font-medium">⚠️ Pocos</span>
                          )}
                          {inventoryMap.has(book.id) && (
                            <span className="text-amber-400/60 ml-1">
                              · Tienes: {inventoryMap.get(book.id)}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    {inCart ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-amber-400 font-medium">
                          x{inCart.quantity}
                        </span>
                        <button
                          onClick={() => removeFromCart(book.id)}
                          className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4 text-white/40" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(book)}
                        disabled={book.stock_physical <= 0}
                        className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-30"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Agregar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart / Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white/5 border border-white/8 rounded-2xl p-5 sticky top-24">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-amber-400" />
              Tu pedido
            </h3>

            {cart.length === 0 ? (
              <p className="text-sm text-white/30">Selecciona libros para solicitar.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {cart.map((item) => (
                  <div
                    key={item.book_id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-white/70 truncate flex-1">{item.title}</span>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => updateQty(item.book_id, -1)}
                        className="p-0.5 hover:bg-white/10 rounded"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-5 text-center font-medium text-xs">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(item.book_id, 1)}
                        className="p-0.5 hover:bg-white/10 rounded"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas opcionales..."
              className="w-full text-xs px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 outline-none focus:border-amber-500/50 transition-colors mb-4 resize-none h-20"
            />

            <button
              onClick={() => createMutation.mutate()}
              disabled={!isFormValid || createMutation.isPending}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50 text-sm"
            >
              {createMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </span>
              ) : (
                `Enviar solicitud (${cart.reduce((s, i) => s + i.quantity, 0)} uds.)`
              )}
            </button>
          </div>
        </div>
      </div>

      {previewBook && (
        <BookPreviewModal book={previewBook} onClose={() => setPreviewBook(null)} />
      )}
    </div>
  );
}
