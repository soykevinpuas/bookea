import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // 1.1 - Respuesta base
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // 1.2 - Si faltan variables clave, dejar pasar (evita errores en build)
  if (!supabaseUrl || !supabaseAnonKey) {
    return response
  }

  // 1.3 - Configuración del cliente Supabase (SSR)
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 1.4 - Obtención de sesión con manejo de errores para evitar 401 en assets estáticos
  let user = null
  try {
    const { data } = await supabase.auth.getSession()
    user = data.session?.user || null
  } catch (error) {
    console.error("Middleware Auth Error:", error)
  }

  // 1.5 - Protección de rutas
  const protectedPaths = ['/dashboard', '/reader', '/admin']
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path))
  const isAuthPath = pathname === '/login' || pathname === '/register'

  if (!user && isProtectedPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

// 1.6 - Matcher optimizado: ignora archivos estáticos, api interna y archivos de sistema
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|manifest.json|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
