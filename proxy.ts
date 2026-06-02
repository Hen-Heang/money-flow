import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/auth/callback']
// Exact-match public routes (prefix match would be too broad, e.g. '/' matches everything)
const PUBLIC_EXACT = ['/']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths through without auth check. The landing page ('/') handles
  // its own redirect for authenticated users in app/page.tsx.
  if (PUBLIC_EXACT.includes(pathname) || PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'YOUR_SUPABASE_URL') {
    return supabaseResponse
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Auth check failed (e.g. network/SSL error) — let request through
    return supabaseResponse
  }

  // Unauthenticated → redirect to login, preserving intended destination
  if (!user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Already logged in and hitting login page → redirect to dashboard
  if (pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|icons|manifest.json|sw.js|api).*)',
  ],
}
