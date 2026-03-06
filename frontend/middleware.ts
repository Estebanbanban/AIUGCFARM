import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()

  // Require auth only for app routes; marketing/docs/blog stay public.
  const protectedPrefixes = ['/dashboard', '/generate', '/history', '/personas', '/products', '/settings']
  const requiresAuth = protectedPrefixes.some((prefix) =>
    request.nextUrl.pathname === prefix ||
    request.nextUrl.pathname.startsWith(`${prefix}/`)
  )

  if (!user && requiresAuth) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Admin route protection
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Check short-lived cookie to avoid DB query on every admin navigation
    const adminVerified = request.cookies.get('x-admin-verified')?.value === '1'
    if (!adminVerified) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (!profile || profile.role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      // Cache the admin verification for 5 minutes
      supabaseResponse.cookies.set('x-admin-verified', '1', {
        path: '/admin',
        maxAge: 300, // 5 minutes
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })
    }
  }

  return supabaseResponse
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] }
