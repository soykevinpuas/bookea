"use client";

import AppImage from "@/components/ui/AppImage";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { createClientClient } from "@/lib/supabase";

type CoverRow = { cover_url: string | null };

export default function CoversBackground() {
  const [covers, setCovers] = useState<string[]>([]);

  useEffect(() => {
    const supabase = createClientClient();
    supabase
      .from("books")
      .select("cover_url")
      .eq("is_active", true)
      .not("cover_url", "is", null)
      .limit(24)
      .then(({ data }) => {
        const urls = ((data ?? []) as CoverRow[])
          .map((b) => b.cover_url)
          .filter((url: string | null): url is string => !!url);
        setCovers([...urls, ...urls, ...urls].slice(0, 24));
      });
  }, []);

  if (covers.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none -z-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a]/40 to-[#0a0a0a] z-10" />
      <motion.div
        animate={{ x: [0, -50], y: [0, -50] }}
        transition={{ repeat: Infinity, repeatType: "mirror", duration: 25, ease: "linear" }}
        className="grid grid-cols-4 gap-2 w-full h-full rotate-12 scale-[1.3] opacity-[0.25]"
      >
        {covers.map((url, i) => (
          <div
            key={i}
            className="relative aspect-[2/3] rounded-md overflow-hidden bg-white/5 border border-white/5"
          >
            <AppImage
              src={url}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </motion.div>
    </div>
  );
}
