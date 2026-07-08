import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Proxy de sesion: refresca cookies de Supabase y protege rutas privadas.
export async function proxy(request: NextRequest) {
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
          for (const { name, value } of cookiesToSet) {
            if (value) request.cookies.set(name, value)
          }
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          for (const { name, value } of cookiesToSet) {
            if (value) response.cookies.set(name, value)
          }
        },
      },
    }
  )

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user ?? null
  } catch {
    // Si Supabase falla, tratamos la ruta protegida como no autenticada.
  }

  const { pathname } = request.nextUrl
  // Mantener esta lista sincronizada con las rutas autenticadas reales.
  const protectedPaths = ['/dashboard', '/reader', '/admin', '/catalog', '/profile', '/vendedor']
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path))
  const isAuthPath = pathname === '/login' || pathname === '/register'

  if (!user && isProtectedPath) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(redirectUrl)
  }

  if (user && isAuthPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:json|svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
