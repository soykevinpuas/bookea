import Link from "next/link";
import Image from "next/image";
import { getBooks } from "@/lib/books";
import Book3D from "@/components/Book3D";
import { createClient } from "@/lib/server";

export default async function CatalogPage() {
  const supabase = await createClient();
  const books = await getBooks(supabase);


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-300">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Catálogo de Libros
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Explora nuestra colección premium. {(books || []).length} títulos disponibles.
            </p>

          </div>
        </div>

        {books.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm">
            <span className="text-4xl block mb-4">📚</span>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Catálogo vacío</h3>
            <p className="text-gray-500 dark:text-gray-400">Pronto agregaremos nuevos y emocionantes títulos.</p>


          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8">
            {books.map((book) => (
              <div
                key={book.id}
                className="group flex flex-col bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm hover:shadow-xl dark:shadow-none hover:-translate-y-1 transition-all duration-300 overflow-hidden"
              >
                <div className="relative aspect-[2/3] px-12 py-12 flex items-center justify-center bg-transparent overflow-visible">
                  {book.cover_url ? (
                    <Link href={`/book/${book.id}`} className="w-full h-full">
                      <Book3D 
                        src={book.cover_url} 
                        title={book.title} 
                        className="w-full h-full"
                      />
                    </Link>
                  ) : (
                    <Link href={`/book/${book.id}`} className="w-full h-full flex items-center justify-center text-4xl text-gray-300 dark:text-white/10 bg-gray-50 dark:bg-white/5 font-serif italic rounded-2xl border border-dashed border-white/20">
                      Bookea
                    </Link>
                  )}
                </div>

                
                <div className="flex flex-col flex-1 p-5">
                  <Link href={`/book/${book.id}`} className="mb-1">
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {book.title}
                    </h3>
                  </Link>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mb-4">
                    por {book.author}
                  </p>
                  
                  <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-100 dark:border-white/5">
                    <span className="text-lg font-black text-gray-900 dark:text-white">
                      {book.price_digital === 0 ? (
                        <span className="text-green-600 dark:text-green-400">¡GRATIS!</span>
                      ) : (
                        <>${book.price_digital} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">MXN</span></>
                      )}
                    </span>
                    <Link
                      href={`/book/${book.id}`}
                      className="text-sm font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Detalles
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
