"use client";

import { createClientClient } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { User, CreditCard, Shield, Zap, Settings, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [dbUser, setDbUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const supabase = createClientClient();

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const { data } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();
        setDbUser(data);
      }
      setLoading(false);
    }
    getProfile();
  }, []);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] retro:bg-[#0d1117]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500/50" />
      </div>
    );
  }

  // 3.3.2 - Determinar si el usuario tiene suscripción activa
  const isSubscriber = dbUser?.role === 'subscriber';

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
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-4 shadow-lg shadow-blue-600/20">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <h2 className="font-bold text-lg mb-1 truncate">{user?.email?.split('@')[0]}</h2>
              <p className="text-xs text-white/40 truncate mb-4">{user?.email}</p>
              
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                isSubscriber 
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                  : 'bg-white/5 text-white/40 border border-white/10'
              }`}>
                {isSubscriber ? <Zap className="w-3 h-3 fill-current" /> : null}
                {isSubscriber ? 'Plan Premium' : 'Nivel Gratis'}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 divide-y divide-white/5">
              <Link href="/dashboard" className="flex items-center gap-3 px-2 py-3 text-sm text-white/60 hover:text-white transition-colors">
                <Settings className="w-4 h-4" /> Configuración (Pronto)
              </Link>
              <Link href="/catalog" className="flex items-center gap-3 px-2 py-3 text-sm text-white/60 hover:text-white transition-colors">
                <CreditCard className="w-4 h-4" /> Mis Compras
              </Link>
            </div>
          </div>

          {/* Subscription / Billing Details */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-md relative overflow-hidden">
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
                      Actualmente estás en el nivel gratuito. Actualiza a Premium para obtener <span className="text-blue-400 font-bold">5 libros mensuales</span> y más beneficios exclusivos.
                    </p>
                    <Link 
                      href="/subscribe"
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition-all hover:scale-105"
                    >
                      <Zap className="w-4 h-4" /> Ver Planes Premium
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                      <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Estado</p>
                      <p className="text-lg font-bold text-green-400">Activo</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                      <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Ciclo Mensual</p>
                      <p className="text-lg font-bold">5/5 Créditos</p>
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
