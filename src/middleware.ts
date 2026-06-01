import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get('cookie') ?? '').map(
            ({ name, value }) => ({ name, value: value ?? '' })
          )
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            response.cookies.set(name, value)
          )
        },
      },
    }
  )

  // getClaims() validates JWT signature — required for secure server-side auth
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  const role = claims?.app_metadata?.role as string | undefined
  const pathname = request.nextUrl.pathname

  // Rule A — Unauthenticated access to protected routes → redirect to /entrar
  const isOwnerRoute = pathname.startsWith('/dashboard')
  const isBarberRoute = pathname.startsWith('/agenda')

  if ((isOwnerRoute || isBarberRoute) && (!claims || error)) {
    return NextResponse.redirect(new URL('/entrar', request.url))
  }

  // Rule B — Authenticated user accessing auth pages → redirect to their dashboard.
  // Only redirect when a role is present. An authenticated user WITHOUT a role
  // (profile/hook not set yet) must be allowed to stay on /entrar — otherwise the
  // layout bounces them back here and we get an infinite 307 redirect loop.
  const isAuthPage = pathname === '/entrar' || pathname === '/cadastro'
  if (isAuthPage && claims && !error && role) {
    const redirectTo = role === 'barber' ? '/agenda' : '/dashboard'
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  // Rule C — Role mismatch: barber on owner route → redirect to /agenda
  if (isOwnerRoute && role === 'barber') {
    return NextResponse.redirect(new URL('/agenda', request.url))
  }

  // Rule D — Owner without barbershop_id on /dashboard routes → redirect to /onboarding
  // Note: Rule E (redirect /onboarding → /dashboard) only fires when barbershop_id IS present,
  // preventing an infinite redirect loop during onboarding JWT refresh lag.
  const barbershop_id = claims?.app_metadata?.barbershop_id as string | undefined
  if (isOwnerRoute && role === 'owner' && claims && !error && !barbershop_id) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  // Rule E — Owner with barbershop_id trying to access /onboarding → redirect to /dashboard
  // One-direction only — prevents loop: after step 1, old JWT may lack barbershop_id
  // so we only redirect /onboarding → /dashboard when barbershop_id IS present in JWT.
  const isOnboardingRoute = pathname.startsWith('/onboarding')
  if (isOnboardingRoute && role === 'owner' && claims && !error && barbershop_id) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|auth/).*)',
  ],
}
