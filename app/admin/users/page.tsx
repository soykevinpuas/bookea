"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { Users, ShieldCheck, Shield, Loader2 } from "lucide-react";

interface AppUser {
  id: string;
  email: string;
  role: "free" | "subscriber" | "admin";
  created_at: string;
}

const ROLE_STYLES: Record<AppUser["role"], string> = {
  free: "bg-white/8 text-white/50 border border-white/10",
  subscriber: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  admin: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
};

const ROLE_LABELS: Record<AppUser["role"], string> = {
  free: "Free",
  subscriber: "Suscriptor",
  admin: "Admin",
};

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const supabase = createClientClient();

  const { data: users = [], isLoading } = useQuery<AppUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, email, role, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const changeRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: AppUser["role"] }) => {
      const { error } = await supabase.from("users").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const subscribers = users.filter((u) => u.role === "subscriber").length;
  const admins = users.filter((u) => u.role === "admin").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="text-white/40 text-sm mt-1">
            {users.length} registrado{users.length !== 1 ? "s" : ""} · {subscribers} suscriptor{subscribers !== 1 ? "es" : ""} · {admins} admin
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-white/20" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No hay usuarios todavía.</p>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left px-5 py-3.5 font-medium text-white/40">Email</th>
                <th className="text-left px-5 py-3.5 font-medium text-white/40">Rol</th>
                <th className="text-left px-5 py-3.5 font-medium text-white/40 hidden sm:table-cell">Registrado</th>
                <th className="text-left px-5 py-3.5 font-medium text-white/40">Cambiar rol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-white/3 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {user.role === "admin" ? (
                        <ShieldCheck className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      ) : (
                        <Shield className="w-4 h-4 text-white/20 flex-shrink-0" />
                      )}
                      <span className="text-white/80 truncate max-w-[200px]">{user.email}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_STYLES[user.role]}`}>
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-white/40 text-xs hidden sm:table-cell">
                    {new Date(user.created_at).toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={user.role}
                      onChange={(e) =>
                        changeRole.mutate({ id: user.id, role: e.target.value as AppUser["role"] })
                      }
                      className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/70 focus:outline-none focus:border-blue-500/50 transition-colors"
                    >
                      <option value="free">Free</option>
                      <option value="subscriber">Suscriptor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
