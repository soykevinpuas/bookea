"use client";

import { useEffect, useState } from "react";
import { createClientClient } from "@/lib/supabase";

// 3.2.1 - useUserId: Hook personalizado para obtener el ID del usuario autenticado
// Proporciona una forma reutilizable de acceder al usuario actual en componentes cliente
export function useUserId() {
  // Estado local para almacenar el ID del usuario
  const [userId, setUserId] = useState<string>("");
  
  // Estado para indicar si la verificación de autenticación está en progreso
  const [isLoading, setIsLoading] = useState(true);

  // Efecto para obtener el usuario actual al montar el componente
  useEffect(() => {
    const supabase = createClientClient();
    
    // getUser() obtiene el usuario actual de la sesión de Supabase
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
      }
      setIsLoading(false);
    });
  }, []);

  // Retorna el ID del usuario y el estado de carga
  return { userId, isLoading };
}
