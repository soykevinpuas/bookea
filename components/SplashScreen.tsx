"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * 1.7 - SplashScreen: Animación de entrada premium para Bookea.
 * Se muestra solo una vez por sesión (usando sessionStorage).
 */
export function SplashScreen() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 1.7.1 - Verificar si ya se mostró en esta sesión
    const hasShown = sessionStorage.getItem("bookea-splash-shown");
    if (!hasShown) {
      setShow(true);
      sessionStorage.setItem("bookea-splash-shown", "true");
    }
  }, []);

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
        onAnimationComplete={() => {
            // Un pequeño retraso extra antes de desmontar para suavidad
            setTimeout(() => setShow(false), 2000);
        }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0a0a0a]"
      >
        <div className="relative">
          {/* Círculos decorativos de fondo pulsantes */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 0.1 }}
            transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
            className="absolute inset-0 bg-blue-600 rounded-full blur-[100px]"
          />
          
          <div className="relative flex flex-col items-center">
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ 
                duration: 1, 
                ease: [0.16, 1, 0.3, 1], // Custom cubic-bezier for premium feel
              }}
              className="text-6xl sm:text-8xl font-black tracking-tighter text-white"
            >
              <span className="text-blue-500">B</span>ookea
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="mt-4 text-sm font-bold uppercase tracking-[0.4em] text-blue-400/80"
            >
              Tu biblioteca premium
            </motion.div>

            {/* Progress bar sutil debajo del logo */}
            <div className="mt-8 w-48 h-[2px] bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "0%" }}
                transition={{ duration: 2, ease: "easeInOut" }}
                className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
              />
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
