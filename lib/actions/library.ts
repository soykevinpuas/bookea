'use server'

import { createClient } from '@/lib/server'
import { addToLibrary as libAddToLibrary, removeFromLibrary as libRemoveFromLibrary } from '@/lib/books'
import { revalidatePath } from 'next/cache'

export async function addToLibraryAction(bookId: string, accessType: 'subscription' | 'permanent' = 'subscription') {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error("[addToLibraryAction] NO USER SESSION FOUND ON SERVER:", authError);
    return { success: false, error: 'Tu sesión ha expirado o no se detecta en el servidor. Por favor, reinicia sesión.' }
  }

  try {
    console.log(`[addToLibraryAction] User ${user.id} adding book ${bookId}`);
    const result = await libAddToLibrary(supabase, user.id, bookId, accessType)
    if (result) {
      console.log(`[addToLibraryAction] Successfully added book ${bookId}`);
      revalidatePath('/dashboard')
      revalidatePath(`/book/${bookId}`)
      return { success: true, record: result }
    }
    return { success: false, error: 'La base de datos no devolvió el registro. Verifique el ID del libro.' }
  } catch (error: any) {
    console.error('Error in addToLibraryAction:', error)
    return { success: false, error: `Error del servidor: ${error.message || 'Desconocido'}` }
  }
}

export async function removeFromLibraryAction(bookId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'No autorizado' }
  }

  try {
    console.log(`[removeFromLibraryAction] Removing book ${bookId} for user ${user.id}`);
    const success = await libRemoveFromLibrary(supabase, user.id, bookId)
    if (success) {
      console.log(`[removeFromLibraryAction] Successfully removed book ${bookId}`);
      revalidatePath('/dashboard')
      revalidatePath(`/book/${bookId}`)
      return { success: true }
    }
    return { success: false, error: 'No se pudo quitar de la biblioteca' }
  } catch (error: any) {
    console.error('Error in removeFromLibraryAction:', error)
    return { success: false, error: `Error del servidor: ${error.message || 'Desconocido'}` }
  }
}
