import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
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

  // Manejo defensivo: si getUser falla (red, cold start), dejar pasar la request
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    // Si falla, dejamos pasar — el layout del cliente maneja el estado no-auth
    console.warn('⚠️ Middleware: getUser falló, dejando pasar:', err)
  }

  // Protección de rutas (basado en proxy.ts anterior)
  const { pathname } = request.nextUrl
  const protectedPaths = ['/dashboard', '/reader', '/admin', '/catalog', '/profile', '/vendedor']
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

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:json|svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
