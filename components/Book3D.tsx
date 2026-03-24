"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

// ============================================
// 6.4 - Book3D: Componente de tarjeta 3D animada para mostrar portadas de libros
// Incluye efectos de profundidad, sombra dinámica y animaciones de flotación
// ============================================

interface Book3DProps {
  src: string;
  title: string;
  className?: string;
  showShadow?: boolean;
  removeWhite?: boolean;
}

// 6.4.1 - Función utilitaria para eliminar fondo blanco de imágenes mediante Canvas API
function removeWhitePixels(img: HTMLImageElement, threshold = 240): string {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return img.src;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Recorrer píxeles y hacer transparentes los fondos blancos/near-white
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Si R, G y B superan el umbral, hacer transparente
    if (r > threshold && g > threshold && b > threshold) {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

// 6.4.2 - Componente principal Book3D
export default function Book3D({ 
  src, 
  title, 
  className = "", 
  showShadow = true,
  removeWhite = true 
}: Book3DProps) {
  // Estado local para almacenar imagen procesada y estado de carga
  const [processedSrc, setProcessedSrc] = useState(src);
  const [isLoaded, setIsLoaded] = useState(false);

  // 6.4.2.1 - Efecto para procesar eliminación de fondo blanco
  useEffect(() => {
    if (!src || !removeWhite) {
      setProcessedSrc(src);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => {
      try {
        const cleaned = removeWhitePixels(img);
        setProcessedSrc(cleaned);
      } catch {
        console.warn("Error al remover fondo (posible CORS):");
        setProcessedSrc(src);
      }
      setIsLoaded(true);
    };
    img.onerror = () => {
      setProcessedSrc(src);
      setIsLoaded(true);
    };
  }, [src, removeWhite]);

  // ============================================
  // 6.4.3 - Renderizado del libro 3D
  // ============================================
  return (
    <div className={`relative perspective-1000 ${className} group`}>
      {/* Contenedor animado con movimiento de flotación */}
      <motion.div
        animate={{
          y: [0, -8, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        whileHover={{ 
          y: -25,
          scale: 1.05,
          rotateY: -15,
          transition: { duration: 0.4, ease: "easeOut" }
        }}
        className="relative preserve-3d transition-transform duration-500"
      >
        {/* 6.4.3.1 - Contenedor del libro con efecto de lomo 3D */}
        <div className="relative shadow-2xl rounded-sm overflow-hidden preserve-3d">
          {/* Efecto de profundidad: lomo del libro (espesor) */}
          <div className="absolute top-0 -left-[4px] bottom-0 w-[8px] bg-gradient-to-r from-black/40 to-black/10 origin-right transform -rotate-y-90 pointer-events-none" />
          
          {/* Imagen de la portada del libro */}
          <img
            src={processedSrc}
            alt={title}
            className={`w-full h-full object-cover rounded-sm transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
          
          {/* Overlay de brillo sutil para efecto glossy */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/5 pointer-events-none" />
        </div>

        {/* 6.4.3.2 - Sombra dinámica que escala con la altura */}
        {showShadow && (
          <motion.div
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[80%] h-4 bg-black/40 blur-xl rounded-[100%] z-[-1]"
            animate={{
              scale: [1, 0.85, 1],
              opacity: [0.4, 0.2, 0.4],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}
      </motion.div>
    </div>
  );
}
