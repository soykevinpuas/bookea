"use client";

import { Check, Sparkles, Zap, Shield, BookOpen } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";

export default function SubscribePage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "subscription" }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        toast.error(data.error);
        if (data.error === "No autorizado") {
          router.push("/login?message=Debes iniciar sesión para suscribirte");
        }
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al procesar la suscripción");
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    "5 créditos mensuales para elegir cualquier libro",
    "Acceso ilimitado al catálogo de lectura",
    "Lector premium sin publicidad",
    "Sincronización en todos tus dispositivos",
    "Soporte prioritario",
    "Descuentos en ediciones físicas",
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] retro:bg-[#0d1117] text-white selection:bg-blue-500/30 overflow-hidden relative">
      {/* Background gradients */}
      <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none -z-10"></div>
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/5 blur-[120px] pointer-events-none"></div>

      <main className="max-w-5xl mx-auto px-6 py-20 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-950/50 border border-blue-800/50 text-blue-300 text-sm font-medium mb-6 backdrop-blur-sm">
            <Sparkles className="w-4 h-4" />
            <span>Plan Premium</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6">
            Eleva tu experiencia de <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              Lectura
            </span>
          </h1>
          <p className="text-lg text-white/50 max-w-xl mx-auto">
            Únete a nuestra membresía y accede a los mejores títulos con beneficios exclusivos cada mes.
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <div className="relative group">
            {/* Pulsing glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
            
            <div className="relative bg-[#111] border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden hover:border-white/20 transition-all">
              {/* Card Header */}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Membresía Mensual</h2>
                  <p className="text-white/40 text-sm">Cancela cuando quieras</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                  <Zap className="w-6 h-6 text-blue-400" />
                </div>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black">$99</span>
                  <span className="text-white/40 font-medium">MXN / mes</span>
                </div>
              </div>

              {/* Benefits List */}
              <ul className="space-y-4 mb-10">
                {benefits.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="mt-1 p-0.5 rounded-full bg-green-500/10 text-green-400">
                      <Check className="w-4 h-4" />
                    </div>
                    <span className="text-sm text-white/70">{benefit}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-lg transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)] hover:shadow-[0_0_30px_rgba(37,99,235,0.4)] transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 group/btn"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    Comenzar ahora
                    <Zap className="w-5 h-5 group-hover/btn:fill-current transition-all" />
                  </>
                )}
              </button>

              <p className="text-center text-xs text-white/30 mt-6 px-4">
                Al suscribirte, aceptas nuestros términos de servicio. Pago seguro procesado por Stripe.
              </p>
            </div>
          </div>
        </div>

        {/* Feature grid below */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-32">
          <div className="flex gap-6 p-6 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex-shrink-0 w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
              <BookOpen className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold mb-2">Lectura sin límites</h3>
              <p className="text-sm text-white/40 leading-relaxed">
                Navega por todo el catálogo y lee fragmentos o libros completos según tu nivel de suscripción de forma fluida.
              </p>
            </div>
          </div>
          <div className="flex gap-6 p-6 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex-shrink-0 w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20">
              <Shield className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold mb-2">Privacidad y Seguridad</h3>
              <p className="text-sm text-white/40 leading-relaxed">
                Tus datos de pago nunca tocan nuestros servidores. Todo se gestiona bajo los estándares bancarios de Stripe.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-white/5 mt-20 text-center">
        <Link href="/catalog" className="text-white/40 hover:text-white transition-colors text-sm">
          ← Regresar al catálogo
        </Link>
      </footer>
    </div>
  );
}
