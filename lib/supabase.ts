import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 1.1 - Cliente Supabase Estándar (SSG / Funciones Puras)
import { createClient as createStandardClient } from '@supabase/supabase-js'
export const supabase = createStandardClient(supabaseUrl, supabaseAnonKey)

// 1.2 - Cliente Supabase para Componentes de Cliente (SSR Aware)
export const createClientClient = () => createBrowserClient(supabaseUrl, supabaseAnonKey)
