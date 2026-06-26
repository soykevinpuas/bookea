"use client";

import { useBook } from "@/hooks/useBooks";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClientClient } from "@/lib/supabase";
import { useEffect, useState } from "react";

export default function BuyPhysicalPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClientClient();

  const { data: book, isLoading } = useBook(id);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push("/login");
      return;
    }

    const shipping = {
      name: formData.get("name"),
      address: formData.get("address"),
      city: formData.get("city"),
      state: formData.get("state"),
      zip: formData.get("zip"),
      phone: formData.get("phone"),
    };

    const baseUrl = window.location.origin;

    try {
      const response = await fetch(`${baseUrl}/api/stripe/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "physical",
          bookId: id,
          shipping,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      console.error("Error:", err);
      setError("Error al procesar la compra");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-lg">Libro no encontrado</div>
        <Link href="/catalog" className="text-blue-600 hover:underline">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  if (book.stock_physical <= 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-lg">Libro no disponible</div>
        <Link href={`/book/${id}`} className="text-blue-600 hover:underline">
          Volver al libro
        </Link>
      </div>
    );
  }

  const total = book.price_physical;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href={`/book/${id}`}
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          ← Volver al libro
        </Link>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Datos de Envío
          </h1>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h2 className="font-semibold text-gray-700 mb-2">{book.title}</h2>
            <p className="text-sm text-gray-500">por {book.author}</p>
            <div className="mt-2 flex justify-between text-sm">
              <span>Libro físico:</span>
              <span>${book.price_physical} MXN</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Envío:</span>
              <span className="text-green-600 font-semibold">Gratis</span>
            </div>
            <div className="flex justify-between font-bold mt-2 pt-2 border-t">
              <span>Total:</span>
              <span>${total} MXN</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre completo
              </label>
              <input
                name="name"
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección
              </label>
              <input
                name="address"
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ciudad
                </label>
                <input
                  name="city"
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado
                </label>
                <input
                  name="state"
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código Postal
                </label>
                <input
                  name="zip"
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  name="phone"
                  type="tel"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Cargando..." : `Pagar $${total} MXN`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
