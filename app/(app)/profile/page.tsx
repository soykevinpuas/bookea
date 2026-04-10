"use client";

import { createClientClient } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { User, CreditCard, Shield, Zap, Settings, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useUserId } from "@/hooks/useUser";
import { useProfile } from "@/hooks/useAvatars";
import AvatarSelector from "@/components/profile/AvatarSelector";
import { ANIMAL_AVATARS, getAvatarStyle } from "@/lib/avatars";
import { useSubscription } from "@/hooks/useSubscription";

export default function ProfilePage() {
  const { userId, isLoading: authLoading } = useUserId();
  const { 
    profile, 
    isLoading: profileLoading, 
    updateAvatar, 
    isUpdatingAvatar,
    updateName,
    isUpdatingName 
  } = useProfile(userId);
  const { data: subscription, isLoading: subLoading } = useSubscription(userId);

  const [dbUser, setDbUser] = useState<any>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const supabase = createClientClient();

  useEffect(() => {
    async function getDbUser() {
      if (!userId) return;
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();
      setDbUser(data);
    }
    getDbUser();
  }, [userId]);

  useEffect(() => {
    if (profile?.name) {
      setTempName(profile.name);
    }
  }, [profile]);

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || "Error al abrir el portal de facturación");
      }
    } catch (error) {
      toast.error("Error al conectar con el portal de pagos");
    } finally {
      setPortalLoading(false);
    }
  };

  if (authLoading || (profileLoading && !profile) || subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] retro:bg-[#0d1117]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500/50" />
      </div>
    );
  }

  const handleSaveName = async () => {
    if (!tempName.trim()) return;
    try {
      await updateName(tempName);
      setIsEditingName(false);
      toast.success("Nombre actualizado");
    } catch {
      toast.error("Error al actualizar nombre");
    }
  };

  // 3.3.2 - Determinar si el usuario tiene suscripción activa
  const isSubscriber = subscription?.isActive;

  // 3.3.3 - Renderizado del perfil del usuario
  return (
    <div className="min-h-screen bg-[#0a0a0a] retro:bg-[#0d1117] text-white py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-10 text-center sm:text-left">
          <h1 className="text-3xl font-bold mb-2">Mi Perfil</h1>
          <p className="text-white/40">Gestiona tu cuenta y suscripción premium.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* User Info Card */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center relative overflow-hidden group">
              {/* Background glow behind avatar */}
              <div className="absolute top-0 left-0 w-full h-full bg-blue-600/5 blur-3xl -z-10 group-hover:bg-blue-600/10 transition-colors" />
              
              <div className="relative w-28 h-28 mx-auto mb-6">
                <div className="w-full h-full rounded-full border-4 border-white/5 overflow-hidden bg-white/5 shadow-2xl relative">
                  {profile?.avatar_url?.startsWith("avatar:") ? (
                    <div 
                      className="w-full h-full"
                      style={getAvatarStyle(profile.avatar_url)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-blue-600 text-3xl font-bold">
                      {dbUser?.email?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                
                {isSubscriber && (
                  <div className="absolute -bottom-1 -right-1 bg-blue-500 p-2 rounded-full shadow-lg border-2 border-[#0a0a0a]">
                    <Zap className="w-4 h-4 text-white fill-current" />
                  </div>
                )}
              </div>

              {isEditingName ? (
                <div className="flex flex-col gap-2 mb-4">
                  <input 
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-center outline-none focus:border-blue-500 transition-colors"
                    placeholder="Tu nombre público..."
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSaveName}
                      disabled={isUpdatingName}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-xs py-1.5 rounded-md transition-colors disabled:opacity-50"
                    >
                      {isUpdatingName ? "..." : "Guardar"}
                    </button>
                    <button 
                      onClick={() => setIsEditingName(false)}
                      className="flex-1 bg-white/10 hover:bg-white/20 text-xs py-1.5 rounded-md transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <h2 
                  onClick={() => setIsEditingName(true)}
                  className="font-bold text-xl mb-1 truncate cursor-pointer hover:text-blue-400 transition-colors flex items-center justify-center gap-2"
                >
                  {profile?.name || dbUser?.email?.split('@')[0]}
                  <Settings className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
                </h2>
              )}
              
              <p className="text-xs text-white/30 truncate mb-6">{dbUser?.email}</p>
              
              <div className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                isSubscriber 
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                  : 'bg-white/5 text-white/40 border border-white/10'
              }`}>
                {subscription?.role === 'admin' ? 'Admin / VIP' : (isSubscriber ? 'Plan Premium' : 'Nivel Gratis')}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 divide-y divide-white/5">
              <Link href="/dashboard" className="flex items-center gap-3 px-2 py-3 text-sm text-white/60 hover:text-white transition-colors">
                <Sparkles className="w-4 h-4 text-blue-400" /> Mi Biblioteca
              </Link>
              <Link href="/catalog" className="flex items-center gap-3 px-2 py-3 text-sm text-white/60 hover:text-white transition-colors">
                <CreditCard className="w-4 h-4" /> Mis Compras
              </Link>
            </div>
          </div>

          {/* Subscription / Billing Details */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-md">
              <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                Personalización
              </h3>
              
              <div className="space-y-6">
                <p className="text-sm text-white/60">Elige tu animal espiritual. Este avatar será visible en la comunidad cuando comentes libros.</p>
                <AvatarSelector 
                  currentAvatarId={profile?.avatar_url || ""}
                  onSelect={(id) => updateAvatar(id as any)}
                  isUpdating={isUpdatingAvatar}
                />
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-md relative overflow-hidden">
               {/* Decorative glow */}
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Shield className="w-32 h-32 text-blue-500" />
              </div>

              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-400" />
                Facturación y Plan
              </h3>

              {!isSubscriber ? (
                <div className="space-y-6">
                  <div className="p-5 bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/20 rounded-xl">
                    <p className="text-sm leading-relaxed mb-4">
                      Actualmente estás en el nivel gratuito. Actualiza a Premium para obtener acceso ilimitado a toda nuestra biblioteca digital y lectura offline.
                    </p>
                    <Link 
                      href="/subscribe"
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition-all hover:scale-105"
                    >
                      <Zap className="w-4 h-4" /> Activar Premium
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                      <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Estado</p>
                      <p className={`text-lg font-bold ${subscription?.role === 'admin' ? 'text-purple-400' : 'text-green-400'}`}>
                        {subscription?.role === 'admin' ? 'Acceso VIP Admin' : 'Premium Activo'}
                      </p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                      <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Expiración</p>
                      <p className="text-lg font-bold">
                        {subscription?.role === 'admin' ? 'Acceso Vitalicio' : `${subscription?.daysRemaining ?? 0} días restantes`}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold mb-1">Gestionar suscripción en Stripe</p>
                      <p className="text-xs text-white/40 leading-relaxed">
                        Actualiza tu método de pago, descarga facturas o cancela tu suscripción cómodamente.
                      </p>
                    </div>
                    <button
                      onClick={handlePortal}
                      disabled={portalLoading}
                      className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold text-xs transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                    >
                      {portalLoading ? <Loader2 className="w-3 h-3 animate-spin"/> : <CreditCard className="w-3 h-3" />}
                      Abrir Portal
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
              <h3 className="text-xl font-bold mb-4">Seguridad</h3>
              <p className="text-sm text-white/40 mb-6 font-light">
                Para cambios de contraseña o seguridad avanzada, gestionamos todo a través de Supabase Auth para tu mayor tranquilidad.
              </p>
              <div className="flex gap-4">
                 {/* Empty for now but ready for actions */}
                 <span className="text-xs text-white/20 italic">No hay acciones adicionales requeridas.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
