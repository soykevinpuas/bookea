'use server'

import { createClient } from '@/lib/server'
import { getStripeClient } from '@/lib/stripe'
import { revalidatePath } from 'next/cache'

/**
 * Verifica una sesión de Stripe y actualiza el rol del usuario si el pago fue exitoso.
 * Esto sirve como alternativa automática a los Webhooks.
 */
export async function verifySubscriptionAction(sessionId: string) {
  if (!sessionId) return { success: false, error: 'No session ID provided' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'No autorizado' }

  try {
    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status === 'paid') {
      // Calcular fecha de vencimiento (30 días a partir de hoy)
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + 30);

      // Actualizar el rol del usuario a suscriptor en la base de datos
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          role: 'subscriber',
          subscription_ends_at: endsAt.toISOString()
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      // ASIGNAR CRÉDITOS (Igual que en el webhook)
      const { data: existingCredits } = await supabase
        .from('subscription_credits')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existingCredits) {
        await supabase.from('subscription_credits').insert({
          user_id: user.id,
          cycle_start: new Date().toISOString().split('T')[0],
          credits_remaining: 5, // 5 libros al mes
        });
      }

      revalidatePath('/')
      revalidatePath('/dashboard')
      
      return { success: true }
    }

    return { success: false, error: 'El pago aún no se ha procesado.' }
  } catch (error: any) {
    console.error('Error verificando suscripción:', error)
    return { success: false, error: error.message }
  }
}
