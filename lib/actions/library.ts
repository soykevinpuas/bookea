'use server'

import { createClient } from '@/lib/server'
import { addToLibrary as libAddToLibrary, removeFromLibrary as libRemoveFromLibrary } from '@/lib/books'
import { revalidatePath } from 'next/cache'

export async function addToLibraryAction(bookId: string, accessType: 'subscription' | 'permanent' = 'subscription') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'No autorizado' }
  }

  try {
    const result = await libAddToLibrary(supabase, user.id, bookId, accessType)
    if (result) {
      revalidatePath('/dashboard')
      revalidatePath(`/book/${bookId}`)
      return { success: true, record: result }
    }
    return { success: false, error: 'No se pudo añadir a la biblioteca' }
  } catch (error) {
    console.error('Error in addToLibraryAction:', error)
    return { success: false, error: 'Error del servidor' }
  }
}

export async function removeFromLibraryAction(bookId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'No autorizado' }
  }

  try {
    const success = await libRemoveFromLibrary(supabase, user.id, bookId)
    if (success) {
      revalidatePath('/dashboard')
      revalidatePath(`/book/${bookId}`)
      return { success: true }
    }
    return { success: false, error: 'No se pudo quitar de la biblioteca' }
  } catch (error) {
    console.error('Error in removeFromLibraryAction:', error)
    return { success: false, error: 'Error del servidor' }
  }
}
