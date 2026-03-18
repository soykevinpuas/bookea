import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Standard pure JS client if needed elsewhere
import { createClient as createStandardClient } from '@supabase/supabase-js'
export const supabase = createStandardClient(supabaseUrl, supabaseAnonKey)

// The Next.js SSR-aware client for browser components like Header
export const createClientClient = () => createBrowserClient(supabaseUrl, supabaseAnonKey)
