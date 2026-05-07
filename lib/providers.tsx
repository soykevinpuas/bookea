"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10 * 60 * 1000, // 10 minutos cacheado (antes 5)
            gcTime: 60 * 60 * 1000, // 1 hora en memoria (antes 10 min)
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            refetchOnMount: false, // Usar cache si existe agresivamente
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
