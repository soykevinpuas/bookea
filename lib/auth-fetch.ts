"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

// Recupera la sesion del navegador antes de declarar al usuario como no autenticado.
export async function recoverBrowserSession(supabase: SupabaseClient) {
  try {
    const { data } = await supabase.auth.refreshSession();
    if (data.session?.user) return true;
  } catch {
    // getUser hace la segunda verificacion y evita limpiar sesion por un fallo transitorio.
  }

  try {
    const { data } = await supabase.auth.getUser();
    return !!data.user;
  } catch {
    return false;
  }
}

// Fetch JSON para pantallas cliente: reintenta una vez tras refrescar la sesion Supabase.
export async function fetchJsonWithSessionRetry<T>(
  supabase: SupabaseClient,
  input: RequestInfo | URL,
  init: RequestInit = {},
  fallbackError = "No se pudo cargar la informacion"
): Promise<T> {
  const runFetch = () => fetch(input, { ...init, credentials: "include" });

  let response = await runFetch();

  if (response.status === 401) {
    await recoverBrowserSession(supabase);
    response = await runFetch();
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : fallbackError;
    throw new Error(message);
  }

  return payload as T;
}
