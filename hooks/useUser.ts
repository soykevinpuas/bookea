"use client";

import { useEffect, useState } from "react";
import { createClientClient } from "@/lib/supabase";

// 3.2.1 - useUserId: Hook personalizado para obtener el ID del usuario autenticado
export function useUserId() {
  const [userId, setUserId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("bookea-auth-id") || "";
    }
    return "";
  });
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClientClient();
    
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        localStorage.setItem("bookea-auth-id", data.user.id);
      } else if (navigator.onLine) {
        // Solo limpiamos si estamos online y realmente no hay sesión
        setUserId("");
        localStorage.removeItem("bookea-auth-id");
      }
      setIsLoading(false);
    });
  }, []);

  return { userId, isLoading };
}
