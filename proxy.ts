import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const AUTH_USER_TIMEOUT_MS = 1200

// Proxy de sesion: refresca cookies de Supabase y protege rutas privadas.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  // Mantener esta lista sincronizada con las rutas autenticadas reales.
  const protectedPaths = ['/dashboard', '/reader', '/admin', '/catalog', '/profile', '/vendedor']
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path))
  const isAuthPath = pathname === '/login' || pathname === '/register'

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  if (!isProtectedPath && !isAuthPath) {
    return response
  }

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
  let hasCookieSession = false
  let authCheckUnavailable = false

  try {
    const { data } = await supabase.auth.getSession()
    hasCookieSession = !!data.session?.user
  } catch {
    // getUser abajo decide si la sesion existe realmente.
  }

  let authUserTimer: ReturnType<typeof setTimeout> | null = null
  try {
    const userCheck = await Promise.race([
      supabase.auth.getUser().then(({ data, error }) => ({
        user: data.user ?? null,
        error,
        timedOut: false,
      })),
      new Promise<{ user: null; error: null; timedOut: true }>((resolve) => {
        authUserTimer = setTimeout(() => resolve({ user: null, error: null, timedOut: true }), AUTH_USER_TIMEOUT_MS)
      }),
    ])
    if (userCheck.error || userCheck.timedOut) authCheckUnavailable = true
    user = userCheck.user
  } catch {
    authCheckUnavailable = true
  } finally {
    if (authUserTimer) clearTimeout(authUserTimer)
  }

  if (!user && isProtectedPath) {
    if (hasCookieSession && authCheckUnavailable) {
      return response
    }

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
