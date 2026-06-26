'use server'

import { createClient, createAdminClient } from '@/lib/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sendWelcomeEmail } from '@/lib/email'
import { getStripeClient } from '@/lib/stripe'

// 2.3 - Auth Actions: Server Action para Registro
export async function register(formData: FormData) {
  const supabase = await createClient()
  let admin: ReturnType<typeof createAdminClient> | null = null
  try { admin = createAdminClient() } catch { /* fallback al client normal */ }

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  }

  if (data.password !== data.confirmPassword) {
    redirect('/register?error=Las contraseñas no coinciden')
  }

  const referrerId = formData.get('referrer_id') as string | null

  const doSignUp = async () => {
    if (admin) {
      return await admin.auth.signUp({ email: data.email, password: data.password })
    }
    return await supabase.auth.signUp({ email: data.email, password: data.password })
  }

  const { error, data: signupData } = await doSignUp()

  if (error) {
    console.error('Error al registrar:', error)
    const messages: Record<string, string> = {
      'User already registered': 'Este correo ya está registrado. Inicia sesión.',
      'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
      'Signups not allowed': 'Los registros están deshabilitados temporalmente.',
      'Email rate limit exceeded': 'Demasiados intentos. Espera un momento e intenta de nuevo.',
      'Database error saving new user': 'Error al crear usuario. Corre el siguiente SQL en Supabase Dashboard > SQL Editor:\n\nCREATE OR REPLACE FUNCTION public.handle_new_user()\nRETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = \'\' AS $$\nBEGIN\n    INSERT INTO public.users (id, email, role) VALUES (NEW.id, NEW.email, \'free\');\n    INSERT INTO public.profiles (user_id, id) VALUES (NEW.id, NEW.id);\n    RETURN NEW;\nEND;\n$$;',
    };
    const friendly = Object.entries(messages).find(([key]) => error.message?.includes(key))?.[1];
    redirect(`/register?error=${encodeURIComponent(friendly || error.message || 'Error desconocido')}`)
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

  // 2.3.2 - Crear customer en Stripe para portal de facturación
  if (signupData?.user) {
    try {
      const stripe = getStripeClient()
      const customer = await stripe.customers.create({
        email: data.email,
        name: data.email.split('@')[0],
      })
      await supabase
        .from('users')
        .update({ stripe_customer_id: customer.id })
        .eq('id', signupData.user.id)
    } catch (stripeError) {
      console.warn('[Stripe] Error creando customer:', stripeError)
    }
  }

  // 2.3.3 - Enviar correo de bienvenida
  if (signupData?.user) {
    await sendWelcomeEmail(data.email, data.email.split('@')[0])
  }

  // 2.3.4 - Procesar referido si existe
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