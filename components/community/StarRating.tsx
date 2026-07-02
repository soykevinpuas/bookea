"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { useState } from "react";

/**
 * StarRating: Componente táctil y animado para calificar libros
 */

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function StarRating({
  rating,
  onRatingChange,
  readOnly = false,
  size = "md"
}: StarRatingProps) {
  // hovered permite previsualizar la calificacion antes de confirmarla con click/tap.
  const [hovered, setHovered] = useState<number | null>(null);

  // Tamaños compartidos para mantener consistencia entre tarjetas, formularios y reseñas.
  const sizes = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8"
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        // Si hay hover gana la previsualizacion; si no, se pinta el rating persistido.
        const isFilled = hovered !== null ? star <= hovered : star <= rating;

        return (
          <motion.button
            key={star}
            type="button"
            whileHover={!readOnly ? { scale: 1.2, rotate: 15 } : {}}
            whileTap={!readOnly ? { scale: 0.9 } : {}}
            onMouseEnter={() => !readOnly && setHovered(star)}
            onMouseLeave={() => !readOnly && setHovered(null)}
            onClick={() => !readOnly && onRatingChange?.(star)}
            className={`${readOnly ? "cursor-default" : "cursor-pointer"} focus:outline-none transition-colors`}
            disabled={readOnly}
          >
            <Star
              className={`${sizes[size]} ${
                isFilled
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300 dark:text-white/10"
              }`}
            />
          </motion.button>
        );
      })}
    </div>
  );
}
