"use client";

import Link from "next/link";
import { createClientClient } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string; role?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClientClient();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }

      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (userData?.role !== "admin") {
        router.push("/dashboard");
        return;
      }

      setUser({ ...data.user, role: userData.role });
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-xl font-bold">
              Admin
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/admin/books" className="text-gray-600 hover:text-gray-900">
                Libros
              </Link>
              <Link href="/admin/orders" className="text-gray-600 hover:text-gray-900">
                Órdenes
              </Link>
              <Link href="/admin/users" className="text-gray-600 hover:text-gray-900">
                Usuarios
              </Link>
            </nav>
          </div>
          <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
            Volver a mi biblioteca
          </Link>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
