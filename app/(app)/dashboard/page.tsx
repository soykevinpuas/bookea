"use client";

import Link from "next/link";
import { useUserBooks } from "@/hooks/useBooks";
import { useUserId } from "@/hooks/useUser";
import Book3D from "@/components/Book3D";
import { BookOpen, Trophy, Flame, Loader2, Compass } from "lucide-react";

// 3.4 - DashboardPage: Panel principal del usuario que muestra su biblioteca personal y estadísticas de lectura
export default function DashboardPage() {
  // 3.4.1 - Obtención del ID del usuario autenticado mediante el hook useUserId
  const { userId } = useUserId();
  
  // 3.4.2 - Consulta de los libros adquiridos por el usuario mediante React Query
  const { data: books, isLoading } = useUserBooks(userId);

  // 3.4.3 - Estado de carga inicial mientras se obtienen los datos del usuario
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500/50" />
      </div>
    );
  }

  // 3.4.4 - Estadísticas de lectura del usuario (colección, libros terminados, racha actual)
  const stats = [
    { label: "Colección", value: books?.length || 0, icon: BookOpen, color: "text-blue-400" },
    { label: "Terminados", value: 0, icon: Trophy, color: "text-yellow-400" },
    { label: "Racha", value: "1 día", icon: Flame, color: "text-orange-500" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-blue-500/30">
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* 3.4.5 - Encabezado con estadísticas de lectura en cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-white/5 ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white/40 text-xs font-medium uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 3.4.6 - Título de sección con enlace de navegación al catálogo completo */}
        <div className="flex items-center justify-between mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Mi Biblioteca</h1>
          <Link href="/catalog" className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2">
            Explorar más <Compass className="w-4 h-4" />
          </Link>
        </div>

        {/* 3.4.7 - Renderizado condicional: Estado vacío (Empty State) cuando el usuario no tiene libros */}
        {!books || books.length === 0 ? (
          <div className="bg-white/5 border border-dashed border-white/10 rounded-3xl p-16 text-center backdrop-blur-sm">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-8 h-8 text-white/20" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Tu estantería está vacía</h3>
            <p className="text-white/40 mb-8 max-w-sm mx-auto">Comienza tu viaje literario adquiriendo tu primer libro en el catálogo premium.</p>
            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-500 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-600/20"
            >
              Ir al Catálogo
            </Link>
          </div>
        ) : (
          // 3.4.8 - Grid de libros adquiridos con acceso directo al lector
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-16">
            {books.map((book) => (
              <div key={book.id} className="flex flex-col items-center">
                {/* 3.4.8.1 - Tarjeta 3D del libro con portada flotante animada */}
                <div className="w-full aspect-[2/3] mb-8 flex items-center justify-center">
                  <Link href={`/book/${book.id}`} className="w-48 h-72">
                    <Book3D 
                      src={book.cover_url || ""} 
                      title={book.title} 
                      className="w-full h-full"
                    />
                  </Link>
                </div>
                
                {/* 3.4.8.2 - Información del libro y botón de acceso al lector */}
                <div className="text-center w-full mt-4">
                  <h3 className="font-bold text-lg line-clamp-1 mb-1">{book.title}</h3>
                  <p className="text-sm text-white/40 mb-4">{book.author}</p>
                  <Link 
                    href={`/reader/${book.id}`}
                    className="inline-block w-full py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold hover:bg-white/10 hover:border-white/20 transition-all"
                  >
                    Leer ahora
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

