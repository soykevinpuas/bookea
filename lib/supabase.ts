import { createBrowserClient } from '@supabase/ssr'
import { createClient as createStandardClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn("⚠️ ALERTA: Variables de Supabase ausentes durante el build o ejecución. Usando placeholders.");
  
  // En el navegador, esto es crítico:
  if (typeof window !== 'undefined') {
    console.error("❌ ERROR DE CONFIGURACIÓN: La aplicación no tiene las variables de Supabase. Revisa tu archivo .env.local.");
  }
}

// 1.1 - Cliente Supabase Estándar (SSG / Funciones Puras)
export const supabase = createStandardClient(supabaseUrl, supabaseAnonKey)

// Singleton para el cliente del navegador para evitar múltiples instancias de Auth/Realtime
let browserClient: any = null;

// 1.2 - Cliente Supabase para Componentes de Cliente (SSR Aware / Singleton)
export const createClientClient = () => {
  if (typeof window === 'undefined') {
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  return browserClient;
}
