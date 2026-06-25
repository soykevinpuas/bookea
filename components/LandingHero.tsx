"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  BookOpen,
  Zap,
  Smartphone,
  Star,
  ArrowRight,
  Dices,
} from "lucide-react";
import { motion, useInView } from "framer-motion";
import FloatingBook3D from "@/components/FloatingBook3D";

export default function LandingHero({ covers }: { covers: string[] }) {
  const [isClient, setIsClient] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const featuresRef = useRef(null);
  const stepsRef = useRef(null);
  const testimonialsRef = useRef(null);
  const featuresInView = useInView(featuresRef, { once: true, margin: "-80px" });
  const stepsInView = useInView(stepsRef, { once: true, margin: "-80px" });
  const testimonialsInView = useInView(testimonialsRef, { once: true, margin: "-80px" });

  useEffect(() => {
    setIsClient(true);
    if (covers.length > 0) {
      setCurrentIndex(Math.floor(Math.random() * covers.length));
    }
  }, [covers]);

  const nextCover = useCallback(() => {
    if (covers.length > 0) {
      setCurrentIndex((prev) => {
        let next = Math.floor(Math.random() * covers.length);
        if (next === prev && covers.length > 1) {
          next = (next + 1) % covers.length;
        }
        return next;
      });
    }
  }, [covers]);

  useEffect(() => {
    const timer = setInterval(nextCover, 3000);
    return () => clearInterval(timer);
  }, [nextCover, currentIndex]);

  const fadeIn = (delay = 0) =>
    isClient
      ? { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.5 } }
      : { initial: false, animate: { opacity: 1, y: 0 }, transition: { delay: 0, duration: 0 } };

  const collageCovers = [...covers, ...covers, ...covers].slice(0, 24);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 overflow-x-hidden font-sans selection:bg-purple-500/30 relative z-0">

      {/* Collage grid background */}
      {collageCovers.length > 0 && (
        <div className="fixed inset-0 pointer-events-none -z-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a]/40 to-[#0a0a0a] z-10" />
            <motion.div 
              animate={{ x: [0, -50], y: [0, -50] }}
              transition={{ repeat: Infinity, repeatType: "mirror", duration: 25, ease: "linear" }}
              className="grid grid-cols-4 gap-2 w-full h-full rotate-12 scale-[1.3] opacity-[0.25]"
            >
            {collageCovers.map((url, i) => (
              <div
                key={i}
                className="relative aspect-[2/3] rounded-md overflow-hidden bg-white/5 border border-white/5"
              >
                <img
                  src={url}
                  alt="Book cover"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
            </motion.div>
        </div>
      )}

      {/* Grid Pattern */}
      <div 
        className="fixed inset-0 pointer-events-none -z-10 opacity-20 mix-blend-overlay"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      {/* Glows - changed to fixed to prevent scroll jank */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/8 blur-[150px] pointer-events-none -z-10 will-change-transform" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-fuchsia-600/8 blur-[150px] pointer-events-none -z-10 will-change-transform" />

      {/* ─── HERO ─── */}
      <main className="max-w-7xl mx-auto px-6 pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pb-28 relative z-10 min-h-screen flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center w-full">
          
          <div>
            <motion.div {...fadeIn(0.1)}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-950/50 border border-purple-800/40 text-purple-300 text-sm font-medium mb-6 backdrop-blur-sm">
                <Zap className="w-3.5 h-3.5" />
                <span>Lectura ilimitada &mdash; $99 MXN/mes</span>
              </div>
            </motion.div>

            <motion.h1 {...fadeIn(0.2)} className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tighter mb-6 text-white leading-[1.05]">
              Tu biblioteca infinita en{" "}
              <span className="inline-flex">
                {"Bookea".split("").map((letter, i) => (
                  <motion.span
                    key={i}
                    animate={{ y: [0, -6, 0] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.12,
                      ease: "easeInOut",
                    }}
                    className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-purple-500"
                    style={{ display: "inline-block" }}
                  >
                    {letter}
                  </motion.span>
                ))}
              </span>
              .
            </motion.h1>

            <motion.p {...fadeIn(0.3)} className="text-lg sm:text-xl text-gray-400 mb-10 max-w-xl leading-relaxed">
              Acceso ilimitado a cientos de libros digitales. Lee en línea, descarga para offline y sincroniza tu progreso en todos tus dispositivos.
            </motion.p>

            <motion.div {...fadeIn(0.4)} className="flex flex-col sm:flex-row items-start gap-4">
              <Link
                href="/subscribe"
                className="group w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white rounded-xl font-bold text-lg transition-all duration-300 shadow-lg shadow-purple-700/20 hover:shadow-purple-600/40 hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5" />
                Activar Premium
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/catalogo"
                className="group w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-2"
              >
                <BookOpen className="w-5 h-5" />
                Explorar Catálogo
              </Link>
            </motion.div>

            <motion.div {...fadeIn(0.5)} className="mt-10 flex items-center gap-4 text-sm text-gray-500">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0a0a0a] bg-white/10" />
                ))}
              </div>
              <p>+10,000 lectores ya están dentro</p>
            </motion.div>
          </div>

          <motion.div
            {...fadeIn(0.25)}
            className="h-[300px] sm:h-[360px] lg:h-[460px] xl:h-[500px] relative group"
          >
            {isClient && covers.length > 0 && <FloatingBook3D coverUrl={covers[currentIndex]} />}
            
            <button
              onClick={nextCover}
              className="absolute bottom-4 right-4 bg-[#0a0a0a]/50 hover:bg-[#0a0a0a]/80 p-3 rounded-full backdrop-blur-md border border-white/10 transition-all opacity-0 group-hover:opacity-100 shadow-lg z-20 text-white"
              title="Siguiente portada"
            >
              <Dices className="w-6 h-6" />
            </button>
          </motion.div>
        </div>
      </main>

      {/* ─── CÓMO FUNCIONA ─── */}
      <section ref={stepsRef} className="border-t border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6 py-20 sm:py-28">
          <motion.div
            initial={false}
            animate={stepsInView || !isClient ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <span className="text-xs font-bold text-purple-500 uppercase tracking-[0.2em] mb-4 block">Cómo funciona</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Tres pasos para empezar a leer
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {[
              {
                num: "01",
                icon: Zap,
                title: "Activa tu membresía",
                desc: "Suscríbete por $99 MXN al mes. Sin permanencia, cancela cuando quieras.",
              },
              {
                num: "02",
                icon: BookOpen,
                title: "Elige tu libro",
                desc: "Explora cientos de títulos en nuestro catálogo y agrega tus favoritos a tu biblioteca.",
              },
              {
                num: "03",
                icon: Smartphone,
                title: "Lee donde sea",
                desc: "En línea o sin conexión. En tu celular, tablet o computadora. Tu progreso se sincroniza solo.",
              },
            ].map((step, i) => (
              <motion.div
                key={step.num}
                initial={false}
                animate={stepsInView || !isClient ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ delay: i * 0.12, duration: 0.4 }}
                className="relative text-center md:text-left"
              >
                {i < 2 && (
                  <div className="hidden md:block absolute top-6 left-[calc(50%+3rem)] w-[calc(100%-6rem)] h-px bg-gradient-to-r from-purple-500/30 to-transparent" />
                )}
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-bold mb-5">
                  {step.num}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed max-w-xs mx-auto md:mx-0">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section ref={featuresRef} className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-20 sm:py-28">
          <motion.div
            initial={false}
            animate={featuresInView || !isClient ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <span className="text-xs font-bold text-purple-500 uppercase tracking-[0.2em] mb-4 block">Características</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Todo lo que necesitas para leer más
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: BookOpen,
                title: "Lector Nativo",
                desc: "Disfruta de tus E-books en cualquier dispositivo sin instalaciones. Sincroniza tu progreso en la nube.",
                color: "border-blue-500/20 bg-blue-500/10 text-blue-400",
              },
              {
                icon: Zap,
                title: "Acceso Ilimitado",
                desc: "Todo el catálogo digital sin restricciones. Lee en línea o descarga para offline.",
                color: "border-purple-500/20 bg-purple-500/10 text-purple-400",
              },
              {
                icon: Smartphone,
                title: "Físicos a Domicilio",
                desc: "Compra copias físicas con envío a todo México. Transacciones seguras con Stripe.",
                color: "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-400",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={false}
                animate={featuresInView || !isClient ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="group relative bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 hover:bg-white/[0.06] transition-all duration-300"
              >
                <div className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center mb-5 border`}>
                  <item.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-3 group-hover:text-purple-300 transition-colors">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIOS ─── */}
      <section ref={testimonialsRef} className="border-t border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6 py-20 sm:py-28">
          <motion.div
            initial={false}
            animate={testimonialsInView || !isClient ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <span className="text-xs font-bold text-purple-500 uppercase tracking-[0.2em] mb-4 block">Lectores</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Lo que dicen nuestros usuarios
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: "Sofía R.",
                handle: "@sofireads",
                text: "Desde que tengo Bookea leo el doble. Poder llevar todos mis libros en el celular me cambió la vida.",
                rating: 5,
              },
              {
                name: "Carlos M.",
                handle: "@carloslibros",
                text: "Por lo que cuesta un café al mes tengo acceso a un catálogo enorme. La mejor suscripción que he probado.",
                rating: 5,
              },
              {
                name: "Ana G.",
                handle: "@anabooks",
                text: "El lector es muy bueno y la sincronización funciona perfecto entre mi iPad y mi celular.",
                rating: 5,
              },
            ].map((t, i) => (
              <motion.div
                key={t.name}
                initial={false}
                animate={testimonialsInView || !isClient ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ delay: i * 0.12, duration: 0.4 }}
                className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6"
              >
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-purple-500 text-purple-500" />
                  ))}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-6">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-white text-xs font-bold">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.handle}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/[0.06] py-10 text-center bg-black/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-center gap-6 mb-4 text-sm flex-wrap">
            <Link href="/aviso-de-privacidad" className="text-gray-500 hover:text-gray-300 transition-colors">
              Aviso de Privacidad
            </Link>
            <span className="text-gray-700/50 hidden sm:inline">|</span>
            <Link href="/terminos" className="text-gray-500 hover:text-gray-300 transition-colors">
              Términos del Servicio
            </Link>
            <span className="text-gray-700/50 hidden sm:inline">|</span>
            <Link href="/login" className="text-gray-500 hover:text-gray-300 transition-colors">
              Iniciar Sesión
            </Link>
          </div>
          <p className="text-gray-600 text-sm">
            &copy; {new Date().getFullYear()} Bookea. Hecho en México.
          </p>
        </div>
      </footer>
    </div>
  );
}
