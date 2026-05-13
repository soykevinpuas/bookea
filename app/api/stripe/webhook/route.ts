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
          const endsAt = new Date();
          endsAt.setDate(endsAt.getDate() + 30);

          const { error: roleError } = await supabase
            .from('users')
            .update({ role: 'subscriber', subscription_ends_at: endsAt.toISOString() })
            .eq('id', userId);

          if (roleError) {
            console.error('Error actualizando rol a suscriptor:', roleError);
            return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
          }
        }

        // 7.2.2.2 - Procesar compra de carrito (múltiples items)
        const cartItemsStr = session.metadata?.items;
        if (session.mode === 'payment' && cartItemsStr) {
          let items: { book_id: string; type: string; cart_item_id: string }[];
          try {
            items = JSON.parse(cartItemsStr);
          } catch {
            console.error('Error parseando items del carrito');
            return NextResponse.json({ error: 'Invalid cart items' }, { status: 400 });
          }

          let shippingInfo: Record<string, string> | null = null;
          const shippingStr = session.metadata?.shipping;
          if (shippingStr) {
            try { shippingInfo = JSON.parse(shippingStr); } catch {}
          }

          for (const item of items) {
            if (item.type === 'digital') {
              const { data: existing } = await supabase
                .from('user_books')
                .select('*')
                .eq('user_id', userId)
                .eq('book_id', item.book_id)
                .maybeSingle();
              if (!existing) {
                await supabase.from('user_books').insert({
                  user_id: userId,
                  book_id: item.book_id,
                  access_type: 'permanent',
                });
              }
            } else if (item.type === 'physical') {
              const { data: bookPrice } = await supabase
                .from('books')
                .select('price_physical')
                .eq('id', item.book_id)
                .single();
              const price = (bookPrice?.price_physical || 299);
              await supabase.from('orders_physical').insert({
                user_id: userId,
                book_id: item.book_id,
                status: 'pending',
                name: shippingInfo?.name || '',
                address: shippingInfo?.address || '',
                city: shippingInfo?.city || '',
                state: shippingInfo?.state || '',
                zip: shippingInfo?.zip || '',
                phone: shippingInfo?.phone || '',
                shipping_cost: 50,
                total: price + 50,
                stripe_payment_id: session.id,
              });
              await supabase.rpc('decrement_stock', { p_book_id: item.book_id });
            }
          }

          await supabase.from('cart_items').delete().eq('user_id', userId);
        }

        // 7.2.2.2b - Procesar compra de libro individual (legacy)
        if (session.mode === 'payment' && bookId && !cartItemsStr) {
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
