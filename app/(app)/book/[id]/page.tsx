"use client";

import { useBook, useUserBooks } from "@/hooks/useBooks";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClientClient } from "@/lib/supabase";
import { useEffect, useState } from "react";

export default function BookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState<string | null>(null);
  const supabase = createClientClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });

    if (searchParams.get('payment') === 'success') {
      router.replace(`/book/${id}`);
    }
  }, []);

  const { data: book, isLoading, error } = useBook(id);
  const { data: userBooks, refetch } = useUserBooks(userId);

  const hasAccess = userBooks?.some((b) => b.id === id);

  const handleBuy = async (type: string, price?: string) => {
    setLoading(type);
    
    const baseUrl = window.location.origin;
    
    try {
      const response = await fetch(`${baseUrl}/api/stripe/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          bookId: id,
          price,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        alert(data.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al procesar la compra');
    } finally {
      setLoading(null);
    }
  };

  const handleClaimFree = async () => {
    if (!userId) {
      router.push("/login?message=Debes iniciar sesión para añadir libros gratis");
      return;
    }
    
    setLoading('claim_free');
    
    try {
      const response = await fetch('/api/books/claim-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: id }),
      });

      const data = await response.json();

      if (data.success) {
        refetch(); // Automatically upgrade the button UI to "Read"
      } else if (data.error) {
        alert(data.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al añadir el libro a tu biblioteca');
    } finally {
      setLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0a]">
        <div className="text-lg text-gray-600 dark:text-gray-400">Cargando libro...</div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-[#0a0a0a]">
        <div className="text-lg text-red-500 dark:text-red-400">Libro no encontrado</div>
        <Link href="/catalog" className="text-blue-600 dark:text-blue-400 hover:underline">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link
          href="/catalog"
          className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
        >
          ← Volver al catálogo
        </Link>

        <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden transition-colors">
          <div className="md:flex">
            <div className="md:w-1/3 lg:w-1/4">
              <div className="aspect-[2/3] bg-gray-100 dark:bg-black m-4 md:m-6 rounded-xl overflow-hidden shadow-sm relative group">
                {book.cover_url ? (
                  <img
                    src={book.cover_url}
                    alt={book.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-white/10 font-serif italic text-4xl">
                    Bookea
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            </div>

            <div className="md:w-2/3 lg:w-3/4 p-6 md:p-8">
              {book.category && (
                <span className="inline-block text-xs font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full mb-4 border border-blue-100 dark:border-blue-500/20">
                  {book.category}
                </span>
              )}
              
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight">
                {book.title}
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-6 font-medium">por {book.author}</p>

              <div className="border-t border-b border-gray-100 dark:border-white/10 py-6 my-6">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                  Descripción
                </h2>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {book.description || "No hay descripción disponible."}
                </p>
              </div>

              <div className="space-y-4 max-w-xl">
                {hasAccess && book.epub_url && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl gap-4">
                    <div>
                      <span className="block text-sm font-medium text-green-800 dark:text-green-400 mb-1">
                        ✓ Libro en biblioteca
                      </span>
                      <span className="text-xl font-bold text-green-900 dark:text-green-300">
                        Listo para leer
                      </span>
                    </div>
                    <Link
                      href={`/reader/${book.id}`}
                      className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-all shadow-sm hover:shadow-md text-center"
                    >
                      Abrir Lector
                    </Link>
                  </div>
                )}

                {!hasAccess && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-gray-50 dark:bg-black/30 border border-gray-100 dark:border-white/5 rounded-xl gap-4">
                    <div>
                      <span className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
                        Versión Digital
                      </span>
                      {book.price_digital === 0 ? (
                        <span className="text-3xl font-bold text-green-600 dark:text-green-400">
                          ¡GRATIS!
                        </span>
                      ) : (
                        <span className="text-3xl font-bold text-gray-900 dark:text-white">
                          ${book.price_digital} <span className="text-lg font-normal text-gray-500 dark:text-gray-400">MXN</span>
                        </span>
                      )}
                    </div>
                    
                    {book.price_digital === 0 ? (
                      <button 
                        onClick={handleClaimFree}
                        disabled={loading === 'claim_free'}
                        className="px-8 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-all shadow-sm shadow-green-500/30 disabled:opacity-50 hover:-translate-y-0.5"
                      >
                        {loading === 'claim_free' ? 'Añadiendo...' : 'Añadir a mi Biblioteca (Gratis)'}
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleBuy('digital_permanent')}
                        disabled={loading === 'digital_permanent'}
                        className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-sm shadow-blue-500/30 disabled:opacity-50 hover:-translate-y-0.5"
                      >
                        {loading === 'digital_permanent' ? 'Procesando...' : 'Comprar Digital'}
                      </button>
                    )}
                  </div>
                )}

                {book.stock_physical > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-gray-50 dark:bg-black/30 border border-gray-100 dark:border-white/5 rounded-xl gap-4">
                    <div>
                      <span className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
                        Edición Física Especial
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-gray-900 dark:text-white">
                          $199 <span className="text-lg font-normal text-gray-500 dark:text-gray-400">MXN</span>
                        </span>
                      </div>
                      <span className="inline-block mt-2 text-xs font-semibold bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-md">
                        {book.stock_physical} unidades disponibles
                      </span>
                    </div>
                    <Link
                      href={`/book/${id}/buy-physical`}
                      className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-sm hover:-translate-y-0.5 text-center border border-gray-700 dark:border-transparent"
                    >
                      Pedir Físico
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
