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
    const secretKey = process.env.STRIPE_SECRET_KEY;
    console.log(`[DIAGNÓSTICO] Verificando pago con clave que empieza por: ${secretKey.substring(0, 15)}...`);
    
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    const stripeId = (await stripe.accounts.retrieve()).id;

    if (session.payment_status === 'paid') {
      // Calcular fecha de vencimiento (30 días a partir de hoy)
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + 30);

      // Obtener el rol ACTUAL de la tabla users (no de Supabase Auth metadata)
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();
      
      const currentRole = userData?.role || 'free';
      const newRole = currentRole === 'admin' ? 'admin' : 'subscriber';

      // Actualizar la base de datos
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          role: newRole,
          subscription_ends_at: endsAt.toISOString()
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      // ASIGNAR CRÉDITOS
      const { data: existingCredits } = await supabase
        .from('subscription_credits')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existingCredits) {
        await supabase.from('subscription_credits').insert({
          user_id: user.id,
          cycle_start: new Date().toISOString().split('T')[0],
          credits_remaining: 5,
        });
      }

      revalidatePath('/')
      revalidatePath('/dashboard')
      
      return { 
        success: true, 
        accountId: stripeId,
        keyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 15) 
      }
    }

    return { 
      success: false, 
      error: 'El pago aún no se ha procesado.', 
      accountId: stripeId,
      keyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 15)
    }
  } catch (error: any) {
    console.error('Error verificando suscripción:', error)
    return { success: false, error: error.message }
  }
}
