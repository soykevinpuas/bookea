"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Book3DProps {
  src: string;
  title: string;
  className?: string;
  showShadow?: boolean;
  removeWhite?: boolean;
}

/**
 * Utility to remove white background from an image using Canvas
 */
function removeWhitePixels(img: HTMLImageElement, threshold = 240): string {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return img.src;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Scan pixels and set near-white to transparent
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // If R, G, and B are all above threshold, make it transparent
    if (r > threshold && g > threshold && b > threshold) {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

export default function Book3D({ 
  src, 
  title, 
  className = "", 
  showShadow = true,
  removeWhite = true 
}: Book3DProps) {
  const [processedSrc, setProcessedSrc] = useState(src);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

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
      } catch (e) {
        console.warn("Background removal failed (CORS?):", e);
        setProcessedSrc(src);
      }
      setIsLoaded(true);
    };
    img.onerror = () => {
      setProcessedSrc(src);
      setIsLoaded(true);
    };
  }, [src, removeWhite]);

  return (
    <div className={`relative perspective-1000 ${className} group`}>
      {/* Floating Animation */}
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
        <div className="relative shadow-2xl rounded-sm overflow-hidden preserve-3d">
          {/* Spine Depth Effect (The "Thickness" of the book) */}
          <div className="absolute top-0 -left-[4px] bottom-0 w-[8px] bg-gradient-to-r from-black/40 to-black/10 origin-right transform -rotate-y-90 pointer-events-none" />
          
          <img
            src={processedSrc}
            alt={title}
            className={`w-full h-full object-cover rounded-sm transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
          
          {/* Subtle Shine/Glass Effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/5 pointer-events-none" />
        </div>

        {/* Dynamic Shadow that scales with height */}
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
