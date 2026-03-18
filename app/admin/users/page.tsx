"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { useEffect, useState } from "react";

interface User {
  id: string;
  email: string;
  role: "free" | "subscriber" | "admin";
  created_at: string;
}

export default function AdminUsersPage() {
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

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });
      return data as User[] || [];
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      await supabase.from("users").update({ role }).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  if (!user || user.role !== "admin") {
    return <div className="p-4">No autorizado</div>;
  }

  if (isLoading) return <div className="p-4">Cargando...</div>;

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin": return "bg-red-100 text-red-800";
      case "subscriber": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Usuarios</h1>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Email</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Rol</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Fecha de registro</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users?.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded ${getRoleColor(u.role)}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(u.created_at).toLocaleDateString("es-MX")}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={(e) =>
                      updateRole.mutate({ id: u.id, role: e.target.value })
                    }
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="free">Free</option>
                    <option value="subscriber">Subscriber</option>
                    <option value="admin">Admin</option>
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
