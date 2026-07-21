"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { Users, ShieldCheck, Shield, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";

// AppUser representa la fila minima necesaria para administrar acceso y suscripciones.
interface AppUser {
  id: string;
  email: string;
  role: "free" | "subscriber" | "admin" | "vendedor";
  created_at: string;
  subscription_ends_at: string | null;
}

// Estilos y etiquetas se separan para que roles nuevos se agreguen en un solo lugar.
const ROLE_STYLES: Record<AppUser["role"], string> = {
  free: "bg-white/5 text-white/50 border border-white/10",
  subscriber: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  admin: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  vendedor: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
};

const ROLE_LABELS: Record<AppUser["role"], string> = {
  free: "Free",
  subscriber: "Suscriptor",
  admin: "Admin",
  vendedor: "Vendedor",
};

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const supabase = createClientClient();
  const [confirmRole, setConfirmRole] = useState<{ id: string; email: string; oldRole: AppUser["role"]; newRole: AppUser["role"] } | null>(null);

  // Tabla principal: lista usuarios ordenados por registro reciente.
  const { data: users = [], isLoading } = useQuery<AppUser[]>({
    queryKey: queryKeys.users.admin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, email, role, created_at, subscription_ends_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Mutacion de fecha: usa RPC para respetar reglas de admin y mantener historial server-side.
  const updateSubscriptionDate = useMutation({
    mutationFn: async ({ userId, endsAt, email }: { userId: string; endsAt: string | null; email: string }) => {
      const toastId = toast.loading(`Actualizando suscripción de ${email}...`);

      try {
        const { error, data } = await supabase.rpc("admin_set_subscription_date", {
          target_user_id: userId,
          new_ends_at: endsAt
        });

        if (error) throw error;

        if (data && typeof data === 'object' && !data.success) {
          throw new Error(data.error || 'El RPC devolvió error');
        }

        toast.success(`Suscripción actualizada para ${email}`, { id: toastId });
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        toast.error(`Error al guardar: ${msg}`, { id: toastId });
        throw err;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.admin }),
  });

  // Mutacion de rol: pasa por API propia para evitar bloqueos de RLS desde cliente.
  const changeRole = useMutation({
    mutationFn: async ({ id, role, email }: { id: string; role: AppUser["role"]; email: string }) => {
      const toastId = toast.loading(`Cambiando rol de ${email}...`);
      try {
        // Llamada al servidor para bypassear RLS completamente
        const response = await fetch('/api/admin/update-role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUserId: id, newRole: role }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Error desconocido del servidor');
        }

        // Verificar que el cambio realmente se reflejó
        if (result.updatedUser) {
          if (result.updatedUser.role !== role) {
            throw new Error(`Servidor confirmó pero rol sigue siendo '${result.updatedUser.role}' en vez de '${role}'`);
          }
        }

        toast.success(`✅ ${email} ahora es ${ROLE_LABELS[role]}`, { id: toastId });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        toast.error(`Error al cambiar rol: ${msg}`, { id: toastId });
        throw err;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.admin }),
  });

  // Contadores del encabezado calculados en cliente desde la misma query de usuarios.
  const subscribers = users.filter((u) => u.role === "subscriber").length;
  const vendedores = users.filter((u) => u.role === "vendedor").length;
  const admins = users.filter((u) => u.role === "admin").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 pl-10 md:pl-0">
            <Users className="w-6 h-6 text-blue-500 dark:text-blue-400" />
            <span>Usuarios</span>
            </h1>
          <p className="text-white/40 text-sm mt-1">
            {users.length} registrado{users.length !== 1 ? "s" : ""} · {subscribers} suscriptor{subscribers !== 1 ? "es" : ""} · {vendedores} vendedor{vendedores !== 1 ? "es" : ""} · {admins} admin
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
        <div className="bg-white/5 border border-white/8 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm min-w-full sm:min-w-[800px]">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left px-5 py-3.5 font-medium text-white/40">Email</th>
                <th className="text-left px-5 py-3.5 font-medium text-white/40">Rol actual</th>
                <th className="text-left px-5 py-3.5 font-medium text-white/40">Fin Suscripción</th>
                <th className="text-left px-5 py-3.5 font-medium text-white/40 hidden sm:table-cell">Registro</th>
                <th className="text-left px-5 py-3.5 font-medium text-white/40">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-white/5 transition-colors">
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
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                       {/* Date input dispara guardado inmediato para minimizar pasos administrativos. */}
                       <div className="relative">
                         <input
                           type="date"
                           defaultValue={user.subscription_ends_at ? user.subscription_ends_at.split('T')[0] : ""}
                           onChange={(e) => {
                             const val = e.target.value;
                             updateSubscriptionDate.mutate({
                               userId: user.id,
                               endsAt: val ? new Date(val).toISOString() : null,
                               email: user.email
                             });
                           }}
                           disabled={updateSubscriptionDate.isPending && updateSubscriptionDate.variables?.userId === user.id}
                           className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs outline-none focus:border-blue-500/50 disabled:opacity-50"
                         />
                         {updateSubscriptionDate.isPending && updateSubscriptionDate.variables?.userId === user.id && (
                           <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                             <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                           </div>
                         )}
                       </div>
                    </div>
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
                      onChange={(e) => {
                        const newRole = e.target.value as AppUser["role"];
                        if (newRole !== user.role) {
                          setConfirmRole({ id: user.id, email: user.email, oldRole: user.role, newRole });
                        }
                      }}
                      className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/70 focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
                    >
                      <option value="free" className="bg-neutral-900 text-white">Free</option>
                      <option value="subscriber" className="bg-neutral-900 text-white">Suscriptor Premium</option>
                      <option value="vendedor" className="bg-neutral-900 text-white">Vendedor</option>
                      <option value="admin" className="bg-neutral-900 text-white">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de confirmacion: protege cambios de rol de alto impacto. */}
      {confirmRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121212] border border-white/10 p-6 rounded-2xl max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-yellow-500/10 rounded-full">
                <AlertTriangle className="w-6 h-6 text-yellow-500" />
              </div>
              <h3 className="text-lg font-bold text-white">Confirmar cambio</h3>
            </div>

            <p className="text-white/70 text-sm mb-4 leading-relaxed">
              Estás a punto de cambiar el nivel de acceso de <strong className="text-white">{confirmRole.email}</strong>.<br/><br/>
              Pasará de <strong className="line-through opacity-70">{ROLE_LABELS[confirmRole.oldRole]}</strong> a <strong className="text-blue-400">{ROLE_LABELS[confirmRole.newRole]}</strong>.
            </p>

            {confirmRole.oldRole === "admin" && (
              <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs leading-relaxed">
                <strong>⚠️ Advertencia Crítica:</strong> Si te estás quitando tu propio rol de administrador, inmediatamente perderás los permisos para ver y editar registros en Supabase. Los usuarios desaparecerán de tu lista debido a las reglas de seguridad (RLS).
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setConfirmRole(null)}
                className="px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  changeRole.mutate({ id: confirmRole.id, role: confirmRole.newRole, email: confirmRole.email });
                  setConfirmRole(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                disabled={changeRole.isPending}
              >
                {changeRole.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sí, cambiar rol"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
