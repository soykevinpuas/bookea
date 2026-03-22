import { createBrowserClient } from '@supabase/ssr'
import { createClient as createStandardClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// 1.1 - Cliente Supabase Estándar (SSG / Funciones Puras)
// Solo se inicializa si las variables existen para evitar errores en build
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createStandardClient(supabaseUrl, supabaseAnonKey)
  : null as any

// 1.2 - Cliente Supabase para Componentes de Cliente (SSR Aware)
export const createClientClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase credentials missing in createClientClient")
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
