'use server'

import { createClient } from '@/lib/server'
import { revalidatePath } from 'next/cache'

/**
 * Verifica el ESTADO de una suscripción después del pago.
 * NO muta la base de datos — el webhook de Stripe es el único que escribe.
 * Solo consulta si el webhook ya procesó el pago exitosamente.
 */
export async function verifySubscriptionAction(sessionId: string) {
  if (!sessionId) return { success: false, error: 'No session ID provided' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'No autorizado' }

  try {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role === 'subscriber' || userData?.role === 'admin') {
      revalidatePath('/')
      revalidatePath('/dashboard')
      return { success: true }
    }

    return { success: false, pending: true, error: 'El pago aún se está procesando.' }
  } catch (error: unknown) {
    console.error('Error verificando suscripción:', error)
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    return { success: false, error: 'Error al verificar el pago' }
  }
}
