"use client";

import { Check, Sparkles, Zap, Shield, BookOpen, CreditCard, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";

export default function SubscribePage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubscribe = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "subscription" }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || "Error al iniciar el pago");
      }
    } catch (error) {
      console.error("Error subscribiéndose:", error);
      toast.error("Ocurrió un error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsApp = () => {
    const message = encodeURIComponent("Hola, quiero activar mi suscripción Premium en Bookea mediante pago manual.");
    window.open(`https://wa.me/5210000000000?text=${message}`, "_blank");
  };

  const benefits = [
    "Acceso ilimitado a todo el catálogo digital",
    "Lectura offline en todos tus dispositivos",
    "Lector avanzado con notas, subrayados y temas",
    "Sincronización en la nube de tu biblioteca",
    "Sin publicidad ni interrupciones",
    "Soporte prioritario y acceso anticipado",
  ];

  return (
    <div className="min-h-screen bg-[#070708] text-white selection:bg-amber-500/30 overflow-hidden relative font-sans">
      {/* 6.2.1 - Fondo Dinámico con Gradientes Premium */}
      <div className="absolute top-0 inset-x-0 h-[800px] bg-gradient-to-b from-amber-600/5 to-transparent pointer-events-none -z-10"></div>
      <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-amber-600/10 blur-[120px] rounded-full pointer-events-none"></div>
      
      <main className="max-w-6xl mx-auto px-6 py-16 sm:py-24 relative z-10">
        <div className="flex flex-col items-center text-center mb-16 sm:mb-24">
          <div className="animate-fade-in-up inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold mb-8 uppercase tracking-widest backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Membresía Premium</span>
          </div>
          
          <h1 className="text-5xl sm:text-7xl font-black tracking-tight mb-8 leading-[1.1]">
            La mejor forma de <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-500 to-amber-200">
              devorar historias
            </span>
          </h1>
          
          <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed">
            Únete a la comunidad de lectores más apasionados y rompe los límites de tu biblioteca digital.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* 6.2.2 - Listado de Beneficios (Izquierda) */}
          <div className="lg:col-span-5 order-2 lg:order-1">
            <h2 className="text-2xl font-bold mb-8 text-white/90">Todo lo que incluye:</h2>
            <ul className="space-y-6">
              {benefits.map((benefit, i) => (
                <li key={i} className="group flex items-center gap-4 animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                    <Check className="w-3.5 h-3.5 stroke-[3px]" />
                  </div>
                  <span className="text-white/60 group-hover:text-white/90 transition-colors">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 6.2.3 - Tarjeta de Checkout (Derecha) */}
          <div className="lg:col-span-7 order-1 lg:order-2">
            <div className="relative group">
              {/* Glow exterior */}
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 rounded-[2.5rem] blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
              
              <div className="relative bg-[#111113] border border-white/10 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl flex flex-col md:flex-row gap-12 sm:gap-16">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-amber-500 font-bold text-sm uppercase tracking-widest mb-4">
                    <Zap className="w-4 h-4 fill-current" />
                    Membresía Mensual
                  </div>
                  
                  <div className="flex items-baseline gap-2 mb-8">
                    <span className="text-7xl font-black text-white">$99</span>
                    <span className="text-2xl text-white/40 font-medium">MXN</span>
                  </div>

                  <p className="text-white/40 text-sm mb-12 leading-relaxed">
                    Suscripción recurrente. Cancela cuando quieras desde tu perfil. Sin cargos ocultos.
                  </p>

                  <button
                    onClick={handleSubscribe}
                    disabled={loading}
                    className="group relative w-full py-5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-lg rounded-2xl transition-all shadow-[0_0_40px_rgba(245,158,11,0.2)] hover:shadow-[0_0_60px_rgba(245,158,11,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-[0.98]"
                  >
                    {loading ? (
                      <div className="w-6 h-6 border-3 border-black/30 border-t-black rounded-full animate-spin"></div>
                    ) : (
                      <>
                        Activar Premium Ahora
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>

                <div className="hidden md:flex flex-col justify-center gap-6 border-l border-white/5 pl-12">
                   <div className="flex flex-col items-center gap-2 group/icon">
                      <CreditCard className="w-10 h-10 text-white/20 group-hover/icon:text-amber-500/50 transition-colors" />
                      <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Seguro</span>
                   </div>
                   <div className="flex flex-col items-center gap-2 group/icon">
                      <Shield className="w-10 h-10 text-white/20 group-hover/icon:text-amber-500/50 transition-colors" />
                      <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Confidencial</span>
                   </div>
                   <div className="flex flex-col items-center gap-2 group/icon">
                      <BookOpen className="w-10 h-10 text-white/20 group-hover/icon:text-amber-500/50 transition-colors" />
                      <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Ilimitado</span>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 6.2.4 - Footer Alternativo (Pago Manual) */}
        <div className="mt-32 text-center">
          <p className="text-white/30 text-sm mb-6">¿No tienes tarjeta? Ofrecemos métodos de pago manuales.</p>
          <button 
            onClick={handleWhatsApp}
            className="inline-flex items-center gap-2 text-white/60 hover:text-white font-bold text-sm border border-white/10 hover:border-amber-500/30 px-6 py-2.5 rounded-full transition-all hover:bg-amber-500/5"
          >
            Contactar para Pago Manual (SPEI/OXXO)
          </button>
        </div>
      </main>

      {/* Background decoration */}
      <div className="absolute bottom-0 right-0 w-[50%] h-[50%] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none -z-10"></div>
    </div>
  );
}

