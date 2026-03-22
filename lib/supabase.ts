import { createBrowserClient } from '@supabase/ssr'
import { createClient as createStandardClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn("⚠️ ALERTA: Variables de Supabase ausentes durante el build. Usando placeholders para evitar errores de compilación.")
}

// 1.1 - Cliente Supabase Estándar (SSG / Funciones Puras)
export const supabase = createStandardClient(supabaseUrl, supabaseAnonKey)

// 1.2 - Cliente Supabase para Componentes de Cliente (SSR Aware)
export const createClientClient = () => {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
