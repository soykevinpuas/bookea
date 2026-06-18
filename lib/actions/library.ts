'use server'

import { createClient } from '@/lib/server'
import { addToLibrary as libAddToLibrary, removeFromLibrary as libRemoveFromLibrary } from '@/lib/books'
import { revalidatePath } from 'next/cache'

export async function addToLibraryAction(bookId: string, accessType: 'subscription' | 'permanent' = 'subscription') {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error("[addToLibraryAction] NO USER SESSION FOUND ON SERVER:", authError);
    return { 
      success: false, 
      error: 'Sesión no detectada. Intenta cerrar sesión y volver a entrar.' 
    }
  }

  try {
    // 1. Verificar si el libro existe y si es gratuito
    const { data: bookCheck, error: bookError } = await supabase.from('books').select('id, price_digital, is_premium').eq('id', bookId).single();
    if (bookError || !bookCheck) {
      console.error("[addToLibraryAction] Book not found:", bookId, bookError);
      return { success: false, error: `El libro no existe o no fue encontrado en la base de datos.` }
    }

    // Validar access_type: 'permanent' solo para libros gratuitos
    if (accessType === 'permanent' && (bookCheck.is_premium !== false || (bookCheck.price_digital || 0) > 0)) {
      return { success: false, error: 'No tienes permiso para añadir este libro permanentemente' }
    }

    const result = await libAddToLibrary(supabase, user.id, bookId, accessType)
    
    // Si el resultado es un objeto con error o es nulo
    if (result && 'error' in result) {
      return { success: false, error: 'Error al añadir el libro a la biblioteca' }
    }

    if (result && 'id' in result) {
      revalidatePath('/dashboard')
      revalidatePath(`/book/${bookId}`)
      return { success: true, record: result }
    }
    
    return { success: false, error: 'No se pudo añadir el libro a la biblioteca' }
  } catch (error: unknown) {
    console.error('Error in addToLibraryAction:', error)
    return { success: false, error: 'Error al procesar la solicitud' }
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
  } catch (error: unknown) {
    console.error('Error in removeFromLibraryAction:', error)
    return { success: false, error: 'Error al procesar la solicitud' }
  }
}
