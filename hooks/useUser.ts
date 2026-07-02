"use client";

import { useAuth } from "@/lib/auth-provider";

// Hook pequeño para consumir solo userId/loading desde AuthProvider.
export function useUserId() {
  // Mantiene a los componentes desacoplados del shape completo de AuthProvider.
  const { userId, isLoading } = useAuth();

  // API minima: id actual y bandera para saber si auth sigue resolviendo.
  return { userId, isLoading };
}
