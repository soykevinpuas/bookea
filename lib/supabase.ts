import { createBrowserClient } from '@supabase/ssr'
import { createClient as createStandardClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn("ALERTA: Variables de Supabase ausentes durante el build o ejecución. Usando placeholders.");

  if (typeof window !== 'undefined') {
    console.error("ERROR DE CONFIGURACIÓN: La aplicación no tiene las variables de Supabase. Revisa tu archivo .env.local.");
  }
}

// Singleton del navegador para evitar multiples instancias de Auth/Realtime.
let browserClient: SupabaseClient | null = null;

// Cliente compatible con imports legacy: en browser delega al singleton SSR-aware.
export const supabase = typeof window === 'undefined'
  ? createStandardClient(supabaseUrl, supabaseAnonKey)
  : new Proxy({} as SupabaseClient, {
      get: (target, prop) => {
        if (!browserClient) {
          browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
        }
        return Reflect.get(browserClient, prop);
      }
    });


// Factory explicita para componentes cliente.
export const createClientClient = () => {
  if (typeof window === 'undefined') {
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  return browserClient;
}
