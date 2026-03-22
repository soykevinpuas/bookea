import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/server';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = (await headers()).get('stripe-signature')!;

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const bookId = session.metadata?.bookId;
        const customerId = session.customer as string;

        if (!userId) {
          console.error('Webhook error: No userId in session metadata');
          return NextResponse.json({ error: 'No userId in metadata' }, { status: 400 });
        }

        if (session.mode === 'subscription') {
          // 1. Actualizar rol a suscriptor
          const { error: roleError } = await supabase
            .from('users')
            .update({ role: 'subscriber' })
            .eq('id', userId);

          if (roleError) {
            console.error('Error updating user role to subscriber:', roleError);
            return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
          }

          // 2. Manejar créditos de suscripción (Idempotente)
          const { data: existingSub, error: selectError } = await supabase
            .from('subscription_credits')
            .select('*')
            .eq('user_id', userId)
            .single();

          if (selectError && selectError.code !== 'PGRST116') { // PGRST116 is "no rows found"
            console.error('Error checking existing subscription credits:', selectError);
            return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
          }

          if (!existingSub) {
            const { error: insertCreditsError } = await supabase.from('subscription_credits').insert({
              user_id: userId,
              cycle_start: new Date().toISOString().split('T')[0],
              credits_remaining: 5,
            });

            if (insertCreditsError) {
              console.error('Error inserting subscription credits:', insertCreditsError);
              return NextResponse.json({ error: 'Database insert failed' }, { status: 500 });
            }
          }
        }

        if (session.mode === 'payment' && bookId) {
          // 3. Dar acceso permanente al libro (Evitar duplicados)
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
              console.error('Error inserting book access:', insertAccessError);
              return NextResponse.json({ error: 'Database insert failed' }, { status: 500 });
            }
          }
        }

        // 4. Guardar el Customer ID de Stripe
        if (customerId) {
          const { error: customerError } = await supabase
            .from('users')
            .update({ stripe_customer_id: customerId })
            .eq('id', userId);

          if (customerError) {
            console.error('Error updating stripe_customer_id:', customerError);
            // No retornamos 500 aquí para no bloquear el flujo si lo anterior salió bien, 
            // pero lo ideal es loggearlo.
          }
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        
        const { data: users, error: userSelectError } = await supabase
          .from('users')
          .select('id')
          .eq('stripe_customer_id', subscription.customer)
          .single();

        if (userSelectError) {
          console.error('Error finding user for deleted subscription:', userSelectError);
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (users) {
          const { error: demoteError } = await supabase
            .from('users')
            .update({ role: 'free' })
            .eq('id', users.id);

          if (demoteError) {
            console.error('Error demoting user to free role:', demoteError);
            return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
          }
        }

        break;
      }

      case 'invoice.payment_failed': {
        console.warn('Payment failed for invoice:', event.data.object.id);
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Unexpected error in webhook handler:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
