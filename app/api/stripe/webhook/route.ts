import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/server';

// ============================================
// 7.2 - Stripe Webhook: Endpoint para recibir eventos de Stripe
// Procesa pagos exitosos, suscripciones y cancelaciones
// ============================================

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = (await headers()).get('stripe-signature')!;

  let event;

  // 7.2.1 - Verificar firma del webhook para seguridad
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Verificación de firma webhook fallida:', err);
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    switch (event.type) {
      // ============================================
      // 7.2.2 - Checkout completado: Procesar compra o suscripción
      // ============================================
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const bookId = session.metadata?.bookId;
        const customerId = session.customer as string;

        if (!userId) {
          console.error('Webhook error: No userId en metadata');
          return NextResponse.json({ error: 'No userId in metadata' }, { status: 400 });
        }

        // 7.2.2.1 - Procesar suscripción mensual
        if (session.mode === 'subscription') {
          // Actualizar rol a suscriptor
          const { error: roleError } = await supabase
            .from('users')
            .update({ role: 'subscriber' })
            .eq('id', userId);

          if (roleError) {
            console.error('Error actualizando rol a suscriptor:', roleError);
            return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
          }

          // Crear créditos de suscripción (5 libros/mes)
          const { data: existingSub, error: selectError } = await supabase
            .from('subscription_credits')
            .select('*')
            .eq('user_id', userId)
            .single();

          if (selectError && selectError.code !== 'PGRST116') {
            console.error('Error verificando créditos existentes:', selectError);
            return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
          }

          if (!existingSub) {
            const { error: insertCreditsError } = await supabase.from('subscription_credits').insert({
              user_id: userId,
              cycle_start: new Date().toISOString().split('T')[0],
              credits_remaining: 5,
            });

            if (insertCreditsError) {
              console.error('Error insertando créditos:', insertCreditsError);
              return NextResponse.json({ error: 'Database insert failed' }, { status: 500 });
            }
          }
        }

        // 7.2.2.2 - Procesar compra de libro individual
        if (session.mode === 'payment' && bookId) {
          const { data: existingAccess } = await supabase
            .from('user_books')
            .select('*')
            .eq('user_id', userId)
            .eq('book_id', bookId)
            .single();

          if (!existingAccess) {
            const { error: insertAccessError } = await supabase.from('user_books').insert({
              user_id: userId,
              book_id: bookId,
              access_type: 'permanent',
            });

            if (insertAccessError) {
              console.error('Error insertando acceso:', insertAccessError);
              return NextResponse.json({ error: 'Database insert failed' }, { status: 500 });
            }
          }
        }

        // 7.2.2.3 - Guardar Customer ID de Stripe para portal de facturación
        if (customerId) {
          await supabase
            .from('users')
            .update({ stripe_customer_id: customerId })
            .eq('id', userId);
        }

        break;
      }

      // ============================================
      // 7.2.3 - Suscripción cancelada: Revocar acceso
      // ============================================
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        
        const { data: users, error: userSelectError } = await supabase
          .from('users')
          .select('id')
          .eq('stripe_customer_id', subscription.customer)
          .single();

        if (userSelectError) {
          console.error('Error encontrando usuario:', userSelectError);
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (users) {
          await supabase
            .from('users')
            .update({ role: 'free' })
            .eq('id', users.id);
        }

        break;
      }

      // 7.2.4 - Pago fallido: Solo logging
      case 'invoice.payment_failed': {
        console.warn('Pago fallido:', event.data.object.id);
        break;
      }

      default:
        console.log(`Tipo de evento no manejado: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Error inesperado en webhook:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
