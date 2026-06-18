import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/server'
import { redirect } from 'next/navigation'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'

  // Validar que next sea una URL relativa (mismo origen)
  const safeNext = next.startsWith('/') ? next : '/dashboard'

  if (token_hash && type) {
    const supabase = await createClient()
    const otpType = type === 'magiclink' ? 'email' : type

    const { error } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash,
    })
    
    if (!error) {
      redirect(safeNext)
    }
  }

  // Si algo falla, lo mandamos a una página de error
  redirect('/error')
}