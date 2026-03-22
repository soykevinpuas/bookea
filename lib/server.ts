import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // Durante el build de Vercel, a veces las variables no están disponibles en la fase de pre-render
    // Devolvemos un cliente básico que no tronará el proceso, aunque no funcionará si se llama realmente.
    console.warn("Supabase credentials missing in createClient (Server)")
  }

  return createServerClient(
    supabaseUrl || '',
    supabaseAnonKey || '',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // El middleware se encargará de esto si falla en un Server Component
          }
        },
      },
    }
  )
}