'use server'

import { createClient } from '@/lib/server'
import { createAdminClient } from '@/lib/server'
import { addToLibrary as libAddToLibrary, removeFromLibrary as libRemoveFromLibrary, type LibraryAccessType } from '@/lib/books'
import { revalidatePath } from 'next/cache'

export async function addToLibraryAction(bookId: string, accessType: LibraryAccessType = 'subscription') {
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
    const adminDb = createAdminClient()

    // 1. Verificar si el libro existe y si es gratuito
    const { data: bookCheck, error: bookError } = await adminDb.from('books').select('id, price_digital, is_premium').eq('id', bookId).single();
    if (bookError || !bookCheck) {
      console.error("[addToLibraryAction] Book not found:", bookId, bookError);
      return { success: false, error: `El libro no existe o no fue encontrado en la base de datos.` }
    }

    const { data: userData, error: userError } = await adminDb
      .from('users')
      .select('role, subscription_ends_at')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return { success: false, error: 'No se pudo validar tu cuenta' }
    }

    const endsAt = userData.subscription_ends_at ? new Date(userData.subscription_ends_at) : null
    const hasSubscriptionAccess =
      userData.role === 'admin' ||
      userData.role === 'vendedor' ||
      (userData.role === 'subscriber' && (!endsAt || endsAt > new Date()))

    // Validar access_type: 'permanent' solo para libros gratuitos
    if (accessType === 'permanent' && (bookCheck.is_premium !== false || (bookCheck.price_digital || 0) > 0)) {
      return { success: false, error: 'No tienes permiso para añadir este libro permanentemente' }
    }

    if (accessType === 'subscription' && bookCheck.is_premium !== false && !hasSubscriptionAccess) {
      return { success: false, error: 'Necesitas una suscripción activa para añadir este libro' }
    }

    const result = await libAddToLibrary(adminDb, user.id, bookId, accessType)
    
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
    const adminDb = createAdminClient()
    const result = await libRemoveFromLibrary(adminDb, user.id, bookId)
    if (result.success) {
      revalidatePath('/dashboard')
      revalidatePath(`/book/${bookId}`)
      return { success: true }
    }
    return { success: false, error: result.error || 'No se pudo quitar de la biblioteca' }
  } catch (error: unknown) {
    console.error('Error in removeFromLibraryAction:', error)
    return { success: false, error: 'Error al procesar la solicitud' }
  }
}
