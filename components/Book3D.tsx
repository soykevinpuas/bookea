// ============================================
// 6.4 - BookCard: Componente de tarjeta para mostrar portadas de libros
// Usa CSS puro para efectos visuales (sin Canvas) para evitar errores CORS en producción
// ============================================

interface Book3DProps {
  src: string;
  title: string;
  className?: string;
  showShadow?: boolean;
  enhance?: boolean;
  objectFit?: "cover" | "contain";
  percentComplete?: number;
}

// 6.4.1 - Componente principal Book3D: renderiza portada con efectos CSS nativos
export default function Book3D({ 
  src, 
  title, 
  className = "", 
  showShadow = true,
  objectFit = "cover",
  percentComplete = 0,
}: Omit<Book3DProps, 'enhance'>) {
  // 6.4.1.1 - Determinar si el libro está completado (100%)
  const isCompleted = percentComplete >= 100;

  // ============================================
  // 6.4.2 - Renderizado de la tarjeta del libro con CSS filter para mejora visual
  // Se evita el Canvas/crossOrigin que causaba imágenes negras en despliegue
  // ============================================
  return (
    <div 
      className={`relative ${className} group`}
      data-book-cover
    >
      {/* 6.4.2.1 - Contenedor con efecto hover: zoom suave y degradado inferior */}
      <div className={`relative h-full shadow-lg rounded-lg overflow-hidden transition-all duration-300 group-hover:-translate-y-2 group-hover:scale-[1.03] ${
        isCompleted 
          ? 'shadow-[0_0_20px_rgba(255,215,0,0.6)] ring-2 ring-amber-400/80 golden-glow' 
          : 'group-hover:shadow-2xl'
      }`}>
        {/* Imagen de la portada: filter CSS aplica el efecto de mejora visual de forma nativa */}
        <img
          src={src || ''}
          alt={title}
          loading="lazy"
          className={`w-full h-full object-${objectFit} rounded-lg ${isCompleted ? 'brightness-105' : ''}`}
          style={{ filter: 'contrast(1.05) saturate(1.1) brightness(1.02)' }}
        />
        
        {/* 6.4.2.2 - Efecto dorado para libros completados (100%) */}
        {isCompleted && (
          <>
            {/* Borde dorado que pulsa con brillo */}
            <div className="absolute inset-0 rounded-lg border-2 border-amber-400 animate-[goldPulse_2s_ease-in-out_infinite] pointer-events-none" />
            
            {/* Brillo exterior suave */}
            <div className="absolute inset-0 rounded-lg shadow-[0_0_20px_rgba(255,215,0,0.4)] pointer-events-none" />
            
            {/* Esquinas doradas decorativas */}
            <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-amber-400/90 rounded-tl-sm" />
            <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-amber-400/90 rounded-tr-sm" />
            <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-amber-400/90 rounded-bl-sm" />
            <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-amber-400/90 rounded-br-sm" />
          </>
        )}
        
        {/* Degradado inferior que aparece en hover para mejorar legibilidad/estética - Protegido en modo Retro */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 pointer-events-none no-retro-override ${
          !isCompleted ? 'group-hover:opacity-100' : 'opacity-30'
        }`} />
      </div>

      {/* 6.4.2.3 - Sombra proyectada debajo del libro con tinte dorado si está completado */}
      {showShadow && (
        <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-[90%] h-3 blur-md rounded-[100%] transition-opacity duration-300 ${
          isCompleted 
            ? 'bg-amber-400/40 shadow-[0_0_10px_rgba(255,215,0,0.5)]' 
            : 'bg-black/30 group-hover:opacity-50'
        }`} />
      )}
    </div>
  );
}
