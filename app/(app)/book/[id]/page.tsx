"use client";

// ============================================
// 3.5 - BookDetailPage: Página de detalle del libro con información, compra y acceso al lector
// ============================================

import { useBook, useUserBooks } from "@/hooks/useBooks";
import { useUserId } from "@/hooks/useUser";
import { useSubscription } from "@/hooks/useSubscription";
import { useCoins } from "@/hooks/useCoins";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { Zap, BookOpen, Loader2, MessageSquare, Star, Sparkles, Download, CheckCircle2, BookmarkPlus, BookmarkCheck, Coins, ChevronDown, ChevronUp } from "lucide-react";
import ReviewForm from "@/components/community/ReviewForm";
import ReviewList from "@/components/community/ReviewList";
import { addToLibrary } from "@/lib/books";
import { addToLibraryAction, removeFromLibraryAction } from "@/lib/actions/library";
import { createClientClient } from "@/lib/supabase";
import { CoinRedemptionModal } from "@/components/book/CoinRedemptionModal";
import BookLoading from "./loading";

// 3.5.1 - Componente principal de la página de detalle
function BookDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  
  // 3.5.2 - Obtención del ID del usuario autenticado
  const { userId } = useUserId();
  
  // 3.5.3 - Estado local para manejar estados de carga en operaciones asíncronas
  const [loading, setLoading] = useState<string | null>(null);

  // 3.5.4 - Efecto para detectar retorno de pago exitoso desde Stripe
  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      toast.success("¡Pago completado con éxito! El libro se está añadiendo a tu biblioteca.");
      router.replace(`/book/${id}`);
    }
  }, [searchParams, id, router]);

  // 3.5.5 - Consulta del libro por ID y verificación de acceso del usuario
  const { data: book, isLoading, error } = useBook(id);
  const { data: userBooks, refetch } = useUserBooks(userId);

  // 3.5.5.1 - Obtención del estado de suscripción del usuario
  const { data: subscription } = useSubscription(userId);
  const { data: coinsBalance, redeemCoin } = useCoins(userId);
  const [showCoinModal, setShowCoinModal] = useState(false);

  // 3.5.6 - Determinación del tipo de acceso
  const isPremiumBook = book?.is_premium !== false; // Por defecto es premium si no se especifica
  const hasPremiumAccess = subscription?.isActive || subscription?.role === 'admin';
  const canRead = !isPremiumBook || hasPremiumAccess;

  // Author data
  const [authorData, setAuthorData] = useState<{ name: string; bio: string | null; photo_url: string | null } | null>(null);
  const [authorOpen, setAuthorOpen] = useState(false);
  useEffect(() => {
    if (!book?.author_id) return;
    const supabase = createClientClient();
    supabase.from('authors').select('name, bio, photo_url').eq('id', book.author_id).single().then(({ data }) => {
      if (data) setAuthorData(data);
    });
  }, [book?.author_id]);

  // 3.5.6.1 - Estado para descarga offline y biblioteca
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [addingToLib, setAddingToLib] = useState(false);
  const supabase = createClientClient();

  const isInLibrary = userBooks?.some((b: any) => b.id.toLowerCase() === id.toLowerCase());
  const isCurrentlyInLibrary = !!isInLibrary; // Booleano estable

  useEffect(() => {
    // Verificar si el libro está en el caché al cargar
    if (book?.epub_url) {
      const url = book.epub_url;
    caches.open('bookea-books').then((cache: any) => {
      cache.match(url).then((match: any) => {
          if (match) setIsDownloaded(true);
        });
      });
    }
  }, [book?.epub_url]);

  // 3.5.7 - Los handlers de compra individual (handleBuy, handleClaimFree) han sido deprecados
  // en favor del modelo de suscripción mensual gestionado en /subscribe

  // 3.5.8.1 - Handler para descarga offline
  const handleDownload = async () => {
    if (!book?.epub_url) {
      toast.error("El libro no tiene un archivo digital disponible");
      return;
    }
    
    setIsDownloading(true);
    try {
      const cache = await caches.open('bookea-books');
      await cache.add(book.epub_url as string);
      setIsDownloaded(true);
      toast.success("¡Libro descargado para lectura offline!");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Error al descargar el libro para modo offline");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleAddToLibrary = async () => {
    if (!userId) {
      toast.error("Debes iniciar sesión");
      return;
    }
    setAddingToLib(true);
    try {
      const accessType = subscription?.isActive ? 'subscription' : 'permanent';
      const result = await addToLibraryAction(id, accessType as any);
      
      if (result.success) {
        toast.success("¡Libro añadido a tu biblioteca!");
        refetch(); // Sincronizar cache de React Query
      } else {
        toast.error(result.error || "No se pudo añadir el libro");
      }
    } catch (error: any) {
      console.error("Error al añadir a biblioteca:", error);
      // Mostrar el error completo para diagnóstico
      toast.error(`Error del Servidor: ${error.message || "Desconocido"}. Revisa los logs de Vercel.`);
    } finally {
      // Pequeño delay para dejar que el cache se actualice y el botón no parpadee
      setTimeout(() => setAddingToLib(false), 1000);
    }
  };

  const handleRemoveFromLibrary = async () => {
    if (!userId) return;
    setAddingToLib(true);
    try {
      const result = await removeFromLibraryAction(id);
      if (result.success) {
        toast.info("Libro quitado de tu biblioteca");
        refetch();
      } else {
        toast.error(result.error || "Error al quitar el libro");
      }
    } catch (error) {
      toast.error("Error de red");
    } finally {
      setAddingToLib(false);
    }
  };

  const handleCoinRedeem = async (coinType: string) => {
    if (!userId) return;
    redeemCoin({ bookId: id, coinType: coinType as any }, {
      onSuccess: (data) => {
        if (data.success) {
          toast.success(`¡Libro desbloqueado! Acceso por ${data.result?.days_granted} días`)
          refetch()
        } else {
          toast.error(data.error || "Error al canjear")
        }
      },
    })
  };

  if (isLoading) {
    return <BookLoading />;
  }

  if (error || !book) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-[#0a0a0a] retro:bg-[#0d1117]">
        <div className="text-lg text-red-500 dark:text-red-400">Libro no encontrado</div>
        <Link href="/catalog" className="text-blue-600 dark:text-blue-400 hover:underline">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  // ============================================
  // 3.5.10 - Renderizado del layout principal
  // ============================================
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] retro:bg-[#0d1117] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 3.5.10.1 - Enlace de navegación de retorno al catálogo */}
        <Link
          href="/catalog"
          className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
        >
          ← Volver al catálogo
        </Link>

        {/* 3.5.10.2 - Contenedor principal con información del libro */}
        <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden transition-colors">
          <div className="md:flex">
            {/* 3.5.10.2.1 - Sección de portada del libro */}
            <div className="md:w-1/3 lg:w-1/4">
              <div className="aspect-[2/3] bg-gray-100 dark:bg-black m-4 md:m-6 rounded-xl overflow-hidden shadow-sm relative group">
                {book.cover_url ? (
                  /* Fallback a img nativo garantizado a estirarse a los bordes si Book3D colapsaba su height por conflictos css */
                  <img
                    src={book.cover_url}
                    alt={book.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 z-10"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-white/10 font-serif italic text-4xl">
                    Bookea
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 preserve-gradient"></div>
              </div>
            </div>

            {/* 3.5.10.2.2 - Sección de información y opciones de compra */}
            <div className="md:w-2/3 lg:w-3/4 p-6 md:p-8">
              {/* Etiqueta de categoría del libro */}
              {book.category && (
                <span className="inline-block text-xs font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full mb-4 border border-blue-100 dark:border-blue-500/20">
                  {book.category}
                </span>
              )}
              
              {/* Título y autor del libro */}
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight">
                {book.title}
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-6 font-medium">por {book.author}</p>

              {/* Descripción del libro */}
              <div className="border-t border-b border-gray-100 dark:border-white/10 py-6 my-6">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                  Descripción
                </h2>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {book.description || "No hay descripción disponible."}
                </p>
              </div>

              {/* 3.5.10.2.3 - Opciones de compra y acceso */}
              <div className="space-y-4 max-w-xl">
                {/* 3.5.10.2.3.1 - Estado: Usuario tiene acceso al libro */}
                {canRead && book.epub_url && (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl gap-4">
                      <div>
                        <span className="block text-sm font-medium text-green-800 dark:text-green-400 mb-1">
                          {isPremiumBook ? '✓ Acceso Premium Activo' : '✓ Libro Gratuito'}
                        </span>
                        <span className="text-xl font-bold text-green-900 dark:text-green-300">
                          Listo para leer
                        </span>
                      </div>
                      <button
                        onClick={() => router.replace(`/reader/${book.id}`)}
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-all shadow-sm hover:shadow-md text-center"
                      >
                        Abrir Lector
                      </button>
                    </div>

                    {/* Opción de descarga offline si tiene acceso */}
                    <button
                      onClick={handleDownload}
                      disabled={isDownloading || isDownloaded}
                      className={`flex items-center justify-center gap-2 px-6 py-4 rounded-xl border transition-all ${
                        isDownloaded 
                        ? 'bg-blue-500/5 border-blue-500/20 text-blue-500 cursor-default' 
                        : 'border-white/10 hover:bg-white/5 text-gray-400 font-bold'
                      }`}
                    >
                      {isDownloading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : isDownloaded ? (
                        <CheckCircle2 className="w-5 h-5 font-bold" />
                      ) : (
                        <Download className="w-5 h-5" />
                      )}
                      {isDownloading ? 'Descargando...' : isDownloaded ? 'Disponible Offline' : 'Descargar Offline'}
                    </button>

                    {/* 3.5.10.2.3.1.2 - Botón de Biblioteca (Toggle) */}
                    {( isCurrentlyInLibrary || (!isPremiumBook || hasPremiumAccess) ) && (
                      <button
                        onClick={isCurrentlyInLibrary ? handleRemoveFromLibrary : handleAddToLibrary}
                        disabled={addingToLib}
                        className={`w-full flex items-center justify-center gap-3 px-6 py-5 rounded-2xl font-black transition-all border shadow-lg relative overflow-hidden ${
                          isCurrentlyInLibrary 
                          ? "bg-white dark:bg-[#1a1a1a] border-amber-500/50 text-amber-500 hover:bg-amber-500/5 shadow-amber-500/10" 
                          : (hasPremiumAccess
                            ? "bg-amber-500 border-amber-600 text-white hover:bg-amber-600 shadow-amber-500/20"
                            : "bg-white dark:bg-white/5 border-white/10 hover:border-blue-500/40 text-gray-900 dark:text-white")
                        } ${addingToLib ? "opacity-70 cursor-wait grayscale" : ""}`}
                      >
                        {addingToLib && (
                          <div className="absolute inset-0 bg-white/20 dark:bg-black/20 flex items-center justify-center z-10 backdrop-blur-[1px]">
                            <Loader2 className="w-6 h-6 animate-spin text-current" />
                          </div>
                        )}
                        
                        {!addingToLib && (isCurrentlyInLibrary ? (
                          <BookmarkCheck className="w-6 h-6" />
                        ) : (
                          <BookmarkPlus className="w-6 h-6" />
                        ))}
                        
                        <span className={addingToLib ? "opacity-0" : "opacity-100"}>
                          {isCurrentlyInLibrary ? 'En tu Biblioteca (Quitar)' : 'Añadir a mi Biblioteca'}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {/* 3.5.10.2.3.2 - Estado: Usuario NO tiene acceso Premium (y no es admin) */}
                {!hasPremiumAccess && !canRead && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 rounded-2xl gap-4 group">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-500/20 rounded-xl text-blue-500">
                           <Zap className="w-6 h-6 fill-current" />
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-blue-500 uppercase tracking-widest mb-0.5">
                            Contenido Premium
                          </span>
                          <span className="text-2xl font-black text-gray-900 dark:text-white">
                            $99 MXN / mes
                          </span>
                          <p className="text-xs text-white/40 mt-1">Acceso ilimitado a todos los libros</p>
                        </div>
                      </div>
                      
                      <Link 
                        href="/subscribe"
                        className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                      >
                        Activar Premium
                      </Link>
                    </div>

                    {/* Botón de desbloqueo con monedas */}
                    {coinsBalance && (coinsBalance.bronze + coinsBalance.silver + coinsBalance.gold + coinsBalance.diamond) > 0 && (
                      <button
                        onClick={() => setShowCoinModal(true)}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold transition-all"
                      >
                        <Coins className="w-5 h-5" />
                        Desbloquear con monedas
                      </button>
                    )}
                  </div>
                )}

                {/* 3.5.10.2.3.3 - Estado: Libro físico disponible en inventario */}
                {book.stock_physical > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-gray-50 dark:bg-black/30 border border-gray-100 dark:border-white/5 rounded-xl gap-4">
                    <div>
                      <span className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
                        Edición Física Especial
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-gray-900 dark:text-white">
                          ${book.price_physical} <span className="text-lg font-normal text-gray-500 dark:text-gray-400">MXN</span>
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

        {/* Author card */}
        {authorData && (
          <div className="mt-10 p-5 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl">
            <button
              onClick={() => setAuthorOpen(!authorOpen)}
              className="w-full flex items-center gap-4 text-left"
            >
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-lg font-bold text-blue-600 dark:text-blue-400 flex-shrink-0 overflow-hidden">
                {authorData.photo_url ? (
                  <img src={authorData.photo_url} alt={authorData.name} className="w-full h-full object-cover" />
                ) : (
                  authorData.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{authorData.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Sobre el autor</p>
              </div>
              {authorOpen ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />}
            </button>
            {authorOpen && authorData.bio && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10">
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-[15]">
                  {authorData.bio}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 3.5.11 - Sección de Comunidad y Reseñas */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Lado izquierdo: Formulario de reseña */}
          <div className="lg:col-span-1 space-y-6">
            <div className="sticky top-24">
              <div className="flex items-center gap-2 mb-6">
                 <MessageSquare className="w-5 h-5 text-blue-500" />
                 <h2 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                    Tu Opinión
                 </h2>
              </div>
              <ReviewForm bookId={id} />
              
              <div className="mt-8 p-6 bg-gradient-to-br from-yellow-500/5 to-transparent border border-yellow-500/10 rounded-2xl">
                 <div className="flex items-center gap-2 mb-2">
                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-widest">
                       Comunidad Bookea
                    </span>
                 </div>
                 <p className="text-xs text-gray-500 dark:text-white/40 leading-relaxed font-medium">
                    Tus reseñas ayudan a otros usuarios a descubrir nuevas historias. ¡Seamos constructivos y apasionados!
                 </p>
              </div>
            </div>
          </div>

          {/* Lado derecho: Lista de reseñas */}
          <div className="lg:col-span-2 space-y-8">
             <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                   <Sparkles className="w-5 h-5 text-blue-500/50" />
                   <h2 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                      Conversaciones
                   </h2>
                </div>
             </div>
             
              <ReviewList bookId={id} />
           </div>
         </div>
       </div>

       {/* Coin Redemption Modal */}
       {coinsBalance && (
         <CoinRedemptionModal
           isOpen={showCoinModal}
           onClose={() => setShowCoinModal(false)}
           balance={coinsBalance}
           onRedeem={handleCoinRedeem}
           bookTitle={book?.title || ''}
           alreadyHasAccess={canRead}
         />
       )}
     </div>
  );
}

export default function BookDetailPage() {
  return (
    <Suspense fallback={<BookLoading />}>
      <BookDetailContent />
    </Suspense>
  )
}
