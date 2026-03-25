"use client";

import { useEffect, useState } from "react";

// ============================================
// 6.4 - BookCard: Componente de tarjeta para mostrar portadas de libros
// Incluye mejora de imagen y efectos de sombra
// ============================================

interface Book3DProps {
  src: string;
  title: string;
  className?: string;
  showShadow?: boolean;
  enhance?: boolean;
}

// 6.4.1 - Función para mejorar la calidad de imagen: contraste, saturación y nitidez
function enhanceImage(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(src);
        return;
      }

      // Aplicar filtro de mejora: contraste 8%, saturación 10%, brillo 2%
      ctx.filter = "contrast(1.08) saturate(1.1) brightness(1.02)";
      ctx.drawImage(img, 0, 0);
      
      // Exportar como JPEG con calidad 92%
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => resolve(src);
  });
}

// 6.4.2 - Componente principal BookCard
export default function Book3D({ 
  src, 
  title, 
  className = "", 
  showShadow = true,
  enhance = true 
}: Book3DProps) {
  // 6.4.2.1 - Estado local para almacenar imagen procesada y estado de carga
  const [processedSrc, setProcessedSrc] = useState(src);
  const [isLoaded, setIsLoaded] = useState(false);

  // 6.4.2.2 - Efecto para procesar mejora de imagen al cargar
  useEffect(() => {
    if (!src) {
      setProcessedSrc(src);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = async () => {
      try {
        let processed = src;
        
        // Aplicar mejora de calidad si está habilitada
        if (enhance) {
          processed = await enhanceImage(processed);
        }
        
        setProcessedSrc(processed);
      } catch {
        console.warn("Error al mejorar imagen (posible CORS):");
        setProcessedSrc(src);
      }
      setIsLoaded(true);
    };
    img.onerror = () => {
      setProcessedSrc(src);
      setIsLoaded(true);
    };
  }, [src, enhance]);

  // ============================================
  // 6.4.3 - Renderizado de la tarjeta del libro
  // ============================================
  return (
    <div className={`relative ${className} group`}>
      {/* 6.4.3.1 - Contenedor con efecto hover simple (solo translate) */}
      <div className="relative shadow-lg rounded-lg overflow-hidden transition-transform duration-300 group-hover:-translate-y-1">
        {/* Imagen de la portada del libro */}
        <img
          src={processedSrc}
          alt={title}
          className={`w-full h-full object-cover rounded-lg transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
        
        {/* Overlay de brillo sutil para efecto glossy */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/5 pointer-events-none rounded-lg" />
      </div>

      {/* 6.4.3.2 - Sombra estática */}
      {showShadow && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[90%] h-3 bg-black/30 blur-md rounded-[100%] transition-opacity duration-300 group-hover:opacity-50" />
      )}
    </div>
  );
}
