'use server'

import { createClient } from '@/lib/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: data.email,
    options: {
      // Esta es la URL a la que regresará el usuario tras dar clic en su correo
      emailRedirectTo: 'http://localhost:3000/auth/confirm',
    },
  })

  if (error) {
    console.error('Error al iniciar sesión:', error.message)
    redirect('/error')
  }

  revalidatePath('/', 'layout')
  redirect('/login?message=Revisa tu correo para entrar')
}