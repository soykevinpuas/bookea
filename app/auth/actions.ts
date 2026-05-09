'use server'

import { createClient } from '@/lib/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sendWelcomeEmail } from '@/lib/email'

// 2.3 - Auth Actions: Endpoints del servidor (Server Actions) para Login y Registro
export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  })

  if (error) {
    if (error.message?.includes('Email not confirmed')) {
      redirect('/login?error=Correo no confirmado. Revisa tu bandeja de entrada.')
    }
    if (error.message?.includes('Invalid login credentials')) {
      redirect('/login?error=Correo o contraseña incorrectos')
    }
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function register(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const referrerId = formData.get('referrer_id') as string | null

  const { error, data: signupData } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
  })

  if (error) {
    console.error('Error al registrar:', error)
    redirect('/error')
  }

  // 2.3.1 - Tracking de analytics: nuevo registro
  try {
    await supabase.rpc('track_event', {
      event_name: 'user_signed_up',
      event_data: JSON.stringify({ method: 'email', referred: !!referrerId }),
      user_email: data.email,
    })
  } catch (trackError) {
    console.warn('[Analytics] Error al trackear registro:', trackError)
  }

  // 2.3.2 - Enviar correo de bienvenida
  if (signupData?.user) {
    await sendWelcomeEmail(data.email, data.email.split('@')[0])
  }

  // 2.3.3 - Procesar referido si existe
  if (referrerId && signupData?.user) {
    try {
      await supabase.rpc('track_referral', {
        p_referrer_id: referrerId,
        p_referred_id: signupData.user.id,
      })
    } catch (referralError) {
      console.warn('[Referral] Error procesando referido:', referralError)
    }
  }

  revalidatePath('/', 'layout')
  redirect('/login?message=Cuenta creada. Inicia sesión.')
}