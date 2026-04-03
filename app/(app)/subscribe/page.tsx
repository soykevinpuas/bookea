"use client";

import { Check, Sparkles, Zap, Shield, BookOpen, CreditCard } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";

export default function SubscribePage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleWhatsApp = () => {
    const message = encodeURIComponent("Hola, quiero activar mi suscripción en Bookea. Ya realicé mi pago.");
    window.open(`https://wa.me/5210000000000?text=${message}`, "_blank");
  };

  const benefits = [
    "5 créditos mensuales para canjear por libros",
    "Cada crédito activa un libro por 30 días",
    "Acceso total al catálogo premium",
    "Lector avanzado con notas y subrayados",
    "Sincronización en la nube",
    "Sin publicidad ni interrupciones",
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] retro:bg-[#0d1117] text-white selection:bg-blue-500/30 overflow-hidden relative font-sans">
      {/* Background gradients */}
      <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none -z-10"></div>
      
      <main className="max-w-5xl mx-auto px-6 py-20 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-950/50 border border-blue-800/50 text-blue-300 text-sm font-medium mb-6 backdrop-blur-sm">
            <Sparkles className="w-4 h-4" />
            <span>Plan de Créditos Premium</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6">
            Obtén tus <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              Créditos de Lectura
            </span>
          </h1>
          <p className="text-lg text-white/50 max-w-xl mx-auto">
            Suscríbete de forma manual y recibe créditos para desbloquear tus libros favoritos cada mes.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Tarjeta de Beneficios */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl blur opacity-20 transition duration-1000"></div>
            <div className="relative bg-[#111] border border-white/10 rounded-3xl p-8 shadow-2xl">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Membresía</h2>
                  <p className="text-white/40 text-sm">Activación manual inmediata</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                  <Zap className="w-6 h-6 text-blue-400" />
                </div>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black">$99</span>
                  <span className="text-white/40 font-medium">MXN / 5 Créditos</span>
                </div>
                <p className="text-xs text-blue-400/60 mt-2 font-medium uppercase tracking-wider">
                  1 Crédito = 1 Libro por 30 Días
                </p>
              </div>

              <ul className="space-y-4 mb-0">
                {benefits.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="mt-1 p-0.5 rounded-full bg-green-500/10 text-green-400">
                      <Check className="w-4 h-4" />
                    </div>
                    <span className="text-sm text-white/70">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Tarjeta de Instrucciones de Pago */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-400" />
              Instrucciones de Pago
            </h3>

            <div className="space-y-6">
              {/* Opción 1: Transferencia */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">Opción 1: Transferencia (SPEI)</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Banco:</span>
                    <span className="font-mono">NOMBRE_DEL_BANCO</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">CLABE:</span>
                    <span className="font-mono">0000 0000 0000 0000 00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Titular:</span>
                    <span className="font-medium">NOMBRE_DEL_TITULAR</span>
                  </div>
                </div>
              </div>

              {/* Opción 2: PayPal */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">Opción 2: PayPal</p>
                <p className="text-sm text-white/60 mb-4 text-center">Envía el pago de $99 MXN de forma segura vía PayPal.</p>
                <Link 
                  href="https://paypal.me/USUARIO/99" 
                  target="_blank"
                  className="block w-full py-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl text-center font-bold transition-all"
                >
                  Pagar con PayPal
                </Link>
              </div>

              {/* Paso final: WhatsApp */}
              <div className="pt-4 border-t border-white/5">
                <p className="text-sm text-white/40 mb-4">
                  Una vez realizado el pago, envía tu <strong className="text-white">comprobante</strong> y el <strong className="text-white">correo</strong> que usaste para registrarte:
                </p>
                <button
                  onClick={handleWhatsApp}
                  className="w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-green-600/20"
                >
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Enviar Comprobante
                </button>
              </div>
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
                Usa tus créditos para desbloquear cualquier libro del catálogo premium por un periodo de 30 días.
              </p>
            </div>
          </div>
          <div className="flex gap-6 p-6 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex-shrink-0 w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20">
              <Shield className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold mb-2">Activación Humana</h3>
              <p className="text-sm text-white/40 leading-relaxed">
                Tus pagos son procesados directamente por nosotros. Una vez validado, verás tus créditos reflejados en tu perfil.
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
