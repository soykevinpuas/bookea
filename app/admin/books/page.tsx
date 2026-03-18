"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { useEffect, useState } from "react";

interface Book {
  id: string;
  title: string;
  author: string;
  description: string | null;
  category: string | null;
  cover_url: string | null;
  epub_url: string | null;
  price_digital: number;
  price_physical: number;
  price_bundle: number | null;
  stock_physical: number;
  is_active: boolean;
  created_at: string;
}

export default function AdminBooksPage() {
  const queryClient = useQueryClient();
  const supabase = createClientClient();
  const [user, setUser] = useState<{ role?: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: userData } = await supabase
          .from("users")
          .select("role")
          .eq("id", data.user.id)
          .single();
        setUser(userData);
      }
    });
  }, []);

  const { data: books, isLoading } = useQuery({
    queryKey: ["admin-books"],
    queryFn: async () => {
      const { data } = await supabase
        .from("books")
        .select("*")
        .order("created_at", { ascending: false });
      return data as Book[] || [];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await supabase.from("books").update({ is_active: isActive }).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-books"] });
    },
  });

  if (!user || user.role !== "admin") {
    return <div className="p-4">No autorizado</div>;
  }

  if (isLoading) return <div className="p-4">Cargando...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestionar Libros</h1>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + Agregar Libro
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Título</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Autor</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Precio Digital</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Stock</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Estado</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {books?.map((book) => (
              <tr key={book.id}>
                <td className="px-4 py-3">{book.title}</td>
                <td className="px-4 py-3 text-gray-500">{book.author}</td>
                <td className="px-4 py-3">${book.price_digital}</td>
                <td className="px-4 py-3">{book.stock_physical}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      book.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {book.is_active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() =>
                      toggleActive.mutate({ id: book.id, isActive: !book.is_active })
                    }
                    className="text-blue-600 hover:underline text-sm"
                  >
                    {book.is_active ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
