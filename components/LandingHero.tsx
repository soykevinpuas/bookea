"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  BookOpen,
  Zap,
  Smartphone,
  Star,
} from "lucide-react";
import { motion, useInView } from "framer-motion";
import FloatingBook3D from "@/components/FloatingBook3D";

export default function LandingHero({ covers }: { covers: string[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const featuresRef = useRef(null);
  const stepsRef = useRef(null);
  const testimonialsRef = useRef(null);
  const featuresInView = useInView(featuresRef, { once: true, margin: "-80px" });
  const stepsInView = useInView(stepsRef, { once: true, margin: "-80px" });
  const testimonialsInView = useInView(testimonialsRef, { once: true, margin: "-80px" });

  const randomCover = covers.length > 0
    ? covers[Math.floor(Math.random() * covers.length)]
    : "";

  const collageCovers = covers.slice(0, 8);

  const fadeIn = (delay = 0) =>
    mounted
      ? { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.5 } }
      : { initial: false, animate: { opacity: 1, y: 0 }, transition: { delay: 0, duration: 0 } };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 overflow-x-hidden font-sans selection:bg-amber-500/30 relative">

      {/* Collage grid background */}
      {collageCovers.length > 0 && (
        <div className="fixed inset-0 pointer-events-none -z-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a]/95 to-[#0a0a0a] z-10" />
          <div className="grid grid-cols-4 gap-2 w-full h-full rotate-12 scale-125 opacity-[0.08]">
            {collageCovers.map((url, i) => (
              <div
                key={i}
                className="relative overflow-hidden rounded-lg"
                style={{ aspectRatio: "3/4" }}
              >
                <img
                  src={url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
            {collageCovers.slice(0, 4).map((url, i) => (
              <div
                key={`r2-${i}`}
                className="relative overflow-hidden rounded-lg"
                style={{ aspectRatio: "3/4" }}
              >
                <img
                  src={url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grain overlay */}
      <div className="fixed inset-0 pointer-events-none -z-10 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")", backgroundRepeat: "repeat", backgroundSize: "256px 256px" }} />

      {/* Grid pattern */}
      <div className="fixed inset-0 pointer-events-none -z-10 opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      {/* Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-600/8 blur-[150px] pointer-events-none -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-orange-600/8 blur-[150px] pointer-events-none -z-10" />

      {/* ─── HERO ─── */}
      <main className="max-w-7xl mx-auto px-6 pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pb-28 relative z-10 min-h-screen flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center w-full">

          <div>
            <motion.div {...fadeIn(0.1)}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/50 border border-amber-800/40 text-amber-300 text-sm font-medium mb-6 backdrop-blur-sm">
                <Zap className="w-3.5 h-3.5" />
                <span>Lectura ilimitada &mdash; $99 MXN/mes</span>
              </div>
            </motion.div>

            <motion.h1 {...fadeIn(0.2)} className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tighter mb-6 text-white leading-[1.05]">
              Lee sin{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500">
                l&iacute;mites
              </span>
              .
            </motion.h1>

            <motion.p {...fadeIn(0.3)} className="text-lg sm:text-xl text-gray-400 mb-10 max-w-xl leading-relaxed">
              Acceso ilimitado a cientos de libros digitales. Lee en l&iacute;nea, descarga para offline y sincroniza tu progreso en todos tus dispositivos.
            </motion.p>

            <motion.div {...fadeIn(0.4)} className="flex flex-col sm:flex-row items-start gap-4">
              <Link
                href="/subscribe"
                className="group w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl font-bold text-lg transition-all duration-300 shadow-lg shadow-amber-700/20 hover:shadow-amber-600/40 hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5" />
                Activar Premium
              </Link>
              <Link
                href="/catalog"
                className="group w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-2"
              >
                <BookOpen className="w-5 h-5" />
                Explorar Cat&aacute;logo
              </Link>
            </motion.div>

            <motion.p {...fadeIn(0.5)} className="mt-8 text-sm text-gray-600 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500/60" />
              Sin permanencia &mdash; cancela cuando quieras
            </motion.p>
          </div>

          <motion.div
            {...fadeIn(0.25)}
            className="h-[300px] sm:h-[360px] lg:h-[460px] xl:h-[500px]"
          >
            {randomCover && <FloatingBook3D coverUrl={randomCover} />}
          </motion.div>
        </div>
      </main>

      {/* ─── CÓMO FUNCIONA ─── */}
      <section ref={stepsRef} className="border-t border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6 py-20 sm:py-28">
          <motion.div
            initial={false}
            animate={stepsInView || !mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <span className="text-xs font-bold text-amber-500 uppercase tracking-[0.2em] mb-4 block">C&oacute;mo funciona</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Tres pasos para empezar a leer
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {[
              {
                num: "01",
                icon: Zap,
                title: "Activa tu membres&iacute;a",
                desc: "Suscr&iacute;bete por $99 MXN al mes. Sin permanencia, cancela cuando quieras.",
              },
              {
                num: "02",
                icon: BookOpen,
                title: "Elige tu libro",
                desc: "Explora cientos de t&iacute;tulos en nuestro cat&aacute;logo y agrega tus favoritos a tu biblioteca.",
              },
              {
                num: "03",
                icon: Smartphone,
                title: "Lee donde sea",
                desc: "En l&iacute;nea o sin conexi&oacute;n. En tu celular, tablet o computadora. Tu progreso se sincroniza solo.",
              },
            ].map((step, i) => (
              <motion.div
                key={step.num}
                initial={false}
                animate={stepsInView || !mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ delay: i * 0.12, duration: 0.4 }}
                className="relative text-center md:text-left"
              >
                {i < 2 && (
                  <div className="hidden md:block absolute top-6 left-[calc(50%+3rem)] w-[calc(100%-6rem)] h-px bg-gradient-to-r from-amber-500/30 to-transparent" />
                )}
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-bold mb-5">
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
            animate={featuresInView || !mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <span className="text-xs font-bold text-amber-500 uppercase tracking-[0.2em] mb-4 block">Caracter&iacute;sticas</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Todo lo que necesitas para leer m&aacute;s
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
                desc: "Todo el cat&aacute;logo digital sin restricciones. Lee en l&iacute;nea o descarga para offline.",
                color: "border-amber-500/20 bg-amber-500/10 text-amber-400",
              },
              {
                icon: Smartphone,
                title: "F&iacute;sicos a Domicilio",
                desc: "Compra copias f&iacute;sicas con env&iacute;o a todo M&eacute;xico. Transacciones seguras con Stripe.",
                color: "border-orange-500/20 bg-orange-500/10 text-orange-400",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={false}
                animate={featuresInView || !mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="group relative bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 hover:bg-white/[0.06] transition-all duration-300"
              >
                <div className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center mb-5 border`}>
                  <item.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-3 group-hover:text-amber-300 transition-colors">{item.title}</h3>
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
            animate={testimonialsInView || !mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <span className="text-xs font-bold text-amber-500 uppercase tracking-[0.2em] mb-4 block">Lectores</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Lo que dicen nuestros usuarios
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: "Sof&iacute;a R.",
                handle: "@sofireads",
                text: "Desde que tengo Bookea leo el doble. Poder llevar todos mis libros en el celular me cambi&oacute; la vida.",
                rating: 5,
              },
              {
                name: "Carlos M.",
                handle: "@carloslibros",
                text: "Por lo que cuesta un caf&eacute; al mes tengo acceso a un cat&aacute;logo enorme. La mejor suscripci&oacute;n que he probado.",
                rating: 5,
              },
              {
                name: "Ana G.",
                handle: "@anabooks",
                text: "El lector es muy bueno y la sincronizaci&oacute;n funciona perfecto entre mi iPad y mi celular.",
                rating: 5,
              },
            ].map((t, i) => (
              <motion.div
                key={t.name}
                initial={false}
                animate={testimonialsInView || !mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ delay: i * 0.12, duration: 0.4 }}
                className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6"
              >
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-amber-500 text-amber-500" />
                  ))}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-6">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold">
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
              T&eacute;rminos del Servicio
            </Link>
            <span className="text-gray-700/50 hidden sm:inline">|</span>
            <Link href="/login" className="text-gray-500 hover:text-gray-300 transition-colors">
              Iniciar Sesi&oacute;n
            </Link>
          </div>
          <p className="text-gray-600 text-sm">
            &copy; {new Date().getFullYear()} Bookea. Hecho en M&eacute;xico.
          </p>
        </div>
      </footer>
    </div>
  );
}
