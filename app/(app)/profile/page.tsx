"use client";

import { createClientClient } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { User, CreditCard, Shield, Zap, Settings, Loader2, Sparkles, BookOpen } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useUserId } from "@/hooks/useUser";
import { useProfile } from "@/hooks/useAvatars";
import { useSubscription } from "@/hooks/useSubscription";
import { parseAvatarConfig } from "@/lib/avatars-v2";
import { AnimalEngine } from "@/components/avatars/AnimalEngine";
import AvatarSelector from "@/components/profile/AvatarSelector";

/**
 * 3.3.3 - Renderizado del perfil del usuario mejorado.
 */

export default function ProfilePage() {
  const { userId, isLoading: authLoading } = useUserId();
  const { 
    profile, 
    isLoading: profileLoading, 
    updateName,
    isUpdatingName,
    updateAvatar,
    isUpdatingAvatar
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

  if (authLoading || (profileLoading && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] retro:bg-[#0d1117]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500/50" />
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

  const handleSaveAvatar = async (config: string) => {
    try {
      await updateAvatar(config);
      toast.success("Avatar actualizado");
    } catch {
      toast.error("Error al guardar avatar");
    }
  };

  // 3.3.2 - Determinar si el usuario tiene suscripción activa
  const isSubscriber = subscription?.isActive;

  return (
    <div className="min-h-screen bg-[#070708] text-white py-12 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header de perfil */}
        <div className="mb-12 text-center sm:text-left flex flex-col sm:flex-row justify-between items-end gap-4">
          <div>
            <h1 className="text-4xl font-black mb-2 tracking-tight">Mi Perfil</h1>
            <p className="text-white/40">Gestiona tu identidad y suscripción Premium.</p>
          </div>
          {isSubscriber && (
            <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500 fill-current" />
              <span className="text-amber-500 font-bold text-xs uppercase tracking-widest">Miembro Premium</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Columna Izquierda: Info Usuario */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 text-center relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-full bg-amber-600/5 blur-3xl -z-10 group-hover:bg-amber-600/10 transition-colors" />
              
              <div className="relative w-32 h-32 mx-auto mb-8">
                <div className="w-full h-full rounded-full border-4 border-white/5 overflow-hidden bg-[#111] shadow-2xl relative flex items-center justify-center">
                  {profile?.avatar_url ? (
                    <AnimalEngine 
                      type={parseAvatarConfig(profile.avatar_url).type} 
                      color={parseAvatarConfig(profile.avatar_url).color} 
                      size="100%" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-amber-600 text-4xl font-black">
                      {dbUser?.email?.charAt(0) || "U"}
                    </div>
                  )}
                </div>
                {isSubscriber && (
                  <div className="absolute -bottom-1 -right-1 bg-amber-500 p-2 rounded-full shadow-lg border-4 border-[#070708]">
                    <Zap className="w-4 h-4 text-black fill-current" />
                  </div>
                )}
              </div>

              {isEditingName ? (
                <div className="flex flex-col gap-3 mb-6">
                  <input 
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-center outline-none focus:border-amber-500 transition-colors"
                    placeholder="Tu nombre público..."
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={handleSaveName} disabled={isUpdatingName} className="flex-1 bg-white text-black font-bold text-xs py-2.5 rounded-xl transition-all hover:opacity-80 disabled:opacity-50">
                      {isUpdatingName ? "..." : "Guardar"}
                    </button>
                    <button onClick={() => setIsEditingName(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-xs py-2.5 rounded-xl transition-all">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <h2 onClick={() => setIsEditingName(true)} className="font-black text-2xl mb-1 truncate cursor-pointer hover:text-amber-500 transition-colors flex items-center justify-center gap-2 group-hover:translate-y-[-2px]">
                  {profile?.name || dbUser?.email?.split('@')[0]}
                  <Settings className="w-4 h-4 opacity-0 group-hover:opacity-40 transition-opacity" />
                </h2>
              )}
              
              <p className="text-xs text-white/30 truncate mb-8 px-4">{dbUser?.email}</p>
              
              <div className={`inline-flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] w-fit ${
                subLoading ? 'bg-white/5 text-white/20 animate-pulse border border-white/10' :
                isSubscriber ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-white/5 text-white/40 border border-white/10'
              }`}>
                {subLoading ? 'Cargando...' : (subscription?.role === 'admin' ? 'Premium Admin' : (isSubscriber ? 'Miembro Premium' : 'Nivel Gratis'))}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-4 divide-y divide-white/5 overflow-hidden">
              <Link href="/dashboard" className="flex items-center gap-4 px-4 py-4 text-sm font-bold text-white/60 hover:text-white hover:bg-white/5 transition-all">
                <Sparkles className="w-4 h-4 text-amber-400" /> Mi Biblioteca
              </Link>
              <Link href="/dashboard?tab=reading" className="flex items-center gap-4 px-4 py-4 text-sm font-bold text-white/60 hover:text-white hover:bg-white/5 transition-all">
                <BookOpen className="w-4 h-4" /> Progreso
              </Link>
            </div>
          </div>

          {/* Columna Derecha: Configuración */}
          <div className="lg:col-span-8 space-y-8">
            {/* Animal Builder Section */}
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 sm:p-10">
              <h3 className="text-2xl font-black flex items-center gap-3 mb-10">
                <Sparkles className="w-6 h-6 text-amber-500" />
                Personalizar Avatar
              </h3>
              <AvatarSelector 
                currentAvatarConfig={profile?.avatar_url}
                onSelect={handleSaveAvatar}
                isUpdating={isUpdatingAvatar}
              />
            </div>

            {/* Facturación Section */}
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 sm:p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Shield className="w-32 h-32 text-blue-500" />
              </div>

              <h3 className="text-2xl font-black flex items-center gap-3 mb-8">
                <CreditCard className="w-6 h-6 text-blue-400" />
                Facturación y Plan
              </h3>

              {!isSubscriber ? (
                <div className="p-6 bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/20 rounded-2xl">
                  <p className="text-sm leading-relaxed mb-6">
                    Actualmente estás en el nivel gratuito. Actualiza a Premium para obtener acceso ilimitado a toda nuestra biblioteca digital y lectura offline.
                  </p>
                  <Link href="/subscribe" className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all hover:scale-105">
                    <Zap className="w-4 h-4" /> Activar Premium
                  </Link>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10 text-center">
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Estado</p>
                      <p className={`text-xl font-black ${subscription?.role === 'admin' ? 'text-purple-400' : 'text-green-400'}`}>
                        {subscription?.role === 'admin' ? 'Acceso VIP' : 'Premium Activo'}
                      </p>
                    </div>
                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10 text-center">
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Expiración</p>
                      <p className="text-xl font-black">
                        {subscription?.role === 'admin' ? 'Vitalicio' : `${subscription?.daysRemaining ?? 0} días`}
                      </p>
                    </div>
                  </div>

                  <div className="p-6 bg-white/5 border border-white/10 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-center md:text-left">
                      <p className="font-bold mb-1">Gestionar en Stripe</p>
                      <p className="text-xs text-white/40">Actualiza tu método de pago o descarga facturas.</p>
                    </div>
                    <button onClick={handlePortal} disabled={portalLoading} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs transition-all flex items-center gap-3">
                      {portalLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <CreditCard className="w-4 h-4" />}
                      Abrir Portal
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Seguridad Section */}
            <div className="bg-white/5 border border-white/10 rounded-[2.2rem] p-8">
              <h3 className="text-xl font-black mb-4">Seguridad</h3>
              <p className="text-sm text-white/40 font-light mb-2">
                Para cambios de contraseña y seguridad avanzada, gestionamos todo a través de Supabase Auth.
              </p>
              <span className="text-[10px] text-white/20 italic">No hay acciones adicionales requeridas.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
