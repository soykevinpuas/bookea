"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { useEffect, useState } from "react";

interface Order {
  id: string;
  book_id: string;
  status: "pending" | "shipped" | "delivered" | "cancelled";
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  shipping_cost: number;
  total: number;
  created_at: string;
  books?: { title: string; author: string };
}

export default function AdminOrdersPage() {
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

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders_physical")
        .select("*, books(title, author)")
        .order("created_at", { ascending: false });
      return data as Order[] || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await supabase.from("orders_physical").update({ status }).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
  });

  if (!user || user.role !== "admin") {
    return <div className="p-4">No autorizado</div>;
  }

  if (isLoading) return <div className="p-4">Cargando...</div>;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "shipped": return "bg-blue-100 text-blue-800";
      case "delivered": return "bg-green-100 text-green-800";
      case "cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Órdenes Físicas</h1>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Fecha</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Libro</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Cliente</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Dirección</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Total</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Estado</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {orders?.map((order) => (
              <tr key={order.id}>
                <td className="px-4 py-3 text-sm">
                  {new Date(order.created_at).toLocaleDateString("es-MX")}
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm font-medium">{order.books?.title}</div>
                  <div className="text-xs text-gray-500">{order.books?.author}</div>
                </td>
                <td className="px-4 py-3 text-sm">
                  <div>{order.name}</div>
                  <div className="text-xs text-gray-500">{order.phone}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {order.city}, {order.state}
                </td>
                <td className="px-4 py-3 font-medium">${order.total}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={order.status}
                    onChange={(e) =>
                      updateStatus.mutate({ id: order.id, status: e.target.value })
                    }
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="pending">Pendiente</option>
                    <option value="shipped">Enviado</option>
                    <option value="delivered">Entregado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
