'use server'

import { createClient } from '@/lib/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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
    console.error('Error al iniciar sesión:', error.message)
    redirect('/error')
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

  const { error, data: signupData } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
  })

  if (error) {
    console.error('Error al registrar:', error)
    redirect('/error')
  }

  console.log('Usuario creado:', signupData.user)
  console.log('Session:', signupData.session)

  revalidatePath('/', 'layout')
  redirect('/login?message=Cuenta creada. Inicia sesión.')
}