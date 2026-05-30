import { createClient } from '@/lib/supabase/server'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'email' | 'recovery' | 'invite' | null
  const next = searchParams.get('next') ?? '/'

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })

    if (!error) {
      if (type === 'invite') {
        return NextResponse.redirect(new URL('/aceitar-convite', siteUrl))
      }
      return NextResponse.redirect(new URL(next, siteUrl))
    }
  }

  return NextResponse.redirect(new URL('/entrar?erro=link-invalido', siteUrl))
}
