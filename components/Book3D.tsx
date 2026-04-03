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
}

// 6.4.1 - Componente principal Book3D: renderiza portada con efectos CSS nativos
export default function Book3D({ 
  src, 
  title, 
  className = "", 
  showShadow = true,
  objectFit = "cover",
}: Omit<Book3DProps, 'enhance'>) {
  // ============================================
  // 6.4.2 - Renderizado de la tarjeta del libro con CSS filter para mejora visual
  // Se evita el Canvas/crossOrigin que causaba imágenes negras en despliegue
  // ============================================
  return (
    <div className={`relative ${className} group`}>
      {/* 6.4.2.1 - Contenedor con efecto hover: zoom suave y degradado inferior */}
      <div className="relative h-full shadow-lg rounded-lg overflow-hidden transition-all duration-300 group-hover:-translate-y-2 group-hover:scale-[1.03] group-hover:shadow-2xl bg-white/5">
        {/* Imagen de la portada: filter CSS aplica el efecto de mejora visual de forma nativa */}
        <img
          src={src || ''}
          alt={title}
          loading="lazy"
          className={`w-full h-full object-${objectFit} rounded-lg`}
          style={{ filter: 'contrast(1.05) saturate(1.1) brightness(1.02)' }}
        />
        
        {/* Degradado inferior que aparece en hover para mejorar legibilidad/estética - Protegido en modo Retro */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none no-retro-override" />
      </div>

      {/* 6.4.2.2 - Sombra proyectada debajo del libro */}
      {showShadow && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[90%] h-3 bg-black/30 blur-md rounded-[100%] transition-opacity duration-300 group-hover:opacity-50" />
      )}
    </div>
  );
}
