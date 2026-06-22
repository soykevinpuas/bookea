"use client";

import { useRef } from "react";
import Link from "next/link";
import { BookOpen, Zap, Smartphone } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { InstallPWA } from "@/components/InstallPWA";
import FloatingBook3D from "@/components/FloatingBook3D";

const covers = [
  "https://picsum.photos/seed/bookea1/400/600",
  "https://picsum.photos/seed/bookea2/400/600",
  "https://picsum.photos/seed/bookea3/400/600",
];

export default function LandingHero() {
  const featuresRef = useRef(null);
  const featuresInView = useInView(featuresRef, { once: true, margin: "-100px" });

  const randomCover = covers[Math.floor(Math.random() * covers.length)];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 overflow-hidden font-sans selection:bg-amber-500/30">
      <div className="absolute top-0 inset-x-0 h-[600px] bg-gradient-to-b from-amber-900/15 to-transparent pointer-events-none -z-10" />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-amber-700/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-orange-700/10 blur-[120px] pointer-events-none" />

      <main className="max-w-7xl mx-auto px-6 pt-16 pb-20 sm:pt-20 sm:pb-24 lg:pb-32 relative z-10 min-h-screen flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center w-full">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/50 border border-amber-800/40 text-amber-300 text-sm font-medium mb-6"
            >
              <Zap className="w-4 h-4" />
              <span>Lectura ilimitada por $99 MXN/mes</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.6 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 text-white leading-tight"
            >
              Lee sin{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                límites
              </span>
              .
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="text-lg sm:text-xl text-gray-400 mb-10 max-w-xl leading-relaxed"
            >
              Acceso ilimitado a cientos de libros digitales. Lee en línea, descarga para offline y sincroniza tu progreso en todos tus dispositivos.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.6 }}
              className="flex flex-col sm:flex-row items-start gap-4"
            >
              <Link
                href="/subscribe"
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-amber-700/20 hover:shadow-amber-600/40 flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5" />
                Activar Premium
              </Link>
              <Link
                href="/catalog"
                className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2"
              >
                <BookOpen className="w-5 h-5" />
                Explorar Catálogo
              </Link>
              <InstallPWA variant="button" />
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
            className="h-[400px] sm:h-[500px] hidden lg:block"
          >
            <FloatingBook3D coverUrl={randomCover} />
          </motion.div>
        </div>
      </main>

      <section ref={featuresRef} className="border-t border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {[
              {
                icon: BookOpen,
                title: "Lector Nativo",
                desc: "Disfruta de tus E-books en cualquier dispositivo sin instalaciones, sincronizando tu progreso en la nube.",
                color: "border-blue-500/30 bg-blue-500/20 text-blue-400",
              },
              {
                icon: Zap,
                title: "Acceso Ilimitado",
                desc: "Acceso ilimitado a todo el catálogo digital. Lee en línea, descarga para offline y sincroniza tu progreso.",
                color: "border-amber-500/30 bg-amber-500/20 text-amber-400",
              },
              {
                icon: Smartphone,
                title: "Físicos a Domicilio",
                desc: "Compra copias físicas con envío a domicilio. Transacciones blindadas con Stripe.",
                color: "border-orange-500/30 bg-orange-500/20 text-orange-400",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                animate={featuresInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="bg-white/5 border border-white/5 rounded-2xl p-8 hover:bg-white/10 transition-colors"
              >
                <div className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center mb-6 border`}>
                  <item.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-gray-400 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center bg-black">
        <div className="flex items-center justify-center gap-4 mb-3 text-sm">
          <Link href="/aviso-de-privacidad" className="text-gray-500 hover:text-gray-300 transition-colors">
            Aviso de Privacidad
          </Link>
          <span className="text-gray-700">|</span>
          <Link href="/terminos" className="text-gray-500 hover:text-gray-300 transition-colors">
            Términos del Servicio
          </Link>
        </div>
        <p className="text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} Bookea. Hecho en M&eacute;xico.
        </p>
      </footer>
    </div>
  );
}
