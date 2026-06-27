import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/server';
import { addToLibrary } from '@/lib/books';

// ============================================
// 7.2 - Stripe Webhook: Endpoint para recibir eventos de Stripe
// Procesa pagos exitosos, suscripciones y cancelaciones
// Usa createAdminClient (service_role) porque Stripe envía webhooks
// sin cookies de usuario — la autenticación ya viene en la metadata
// de la sesión (userId). La firma criptográfica de Stripe protege
// contra requests maliciosos.
// ============================================

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

async function getStripeSubscriptionEnd(subscriptionId: string | null | undefined) {
  if (!subscriptionId) return null;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const periodEnd = (subscription as any).current_period_end as number | undefined;
  return periodEnd ? new Date(periodEnd * 1000) : null;
}

export async function POST(request: NextRequest) {
  if (!webhookSecret) {
    console.error('CRITICAL: STRIPE_WEBHOOK_SECRET is not configured on the server.');
    return NextResponse.json({ error: 'Webhook configuration error' }, { status: 500 });
  }

  const body = await request.text();
  const signature = (await headers()).get('stripe-signature');

  if (!signature) {
    console.error('Verificación de firma webhook fallida: stripe-signature header missing');
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 });
  }

  let event;

  // 7.2.1 - Verificar firma del webhook para seguridad
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Verificación de firma webhook fallida:', err);
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Idempotency: skip if already processed
  const { data: existingEvent } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle();

  if (existingEvent) {
    console.log('[webhook] Evento ya procesado, saltando:', event.id);
    return NextResponse.json({ received: true, idempotent: true });
  }

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

        if (session.mode === 'payment' && session.payment_status !== 'paid') {
          console.warn('[webhook] Checkout de pago completado sin payment_status=paid, saltando grants:', session.id);
          break;
        }

        // 7.2.2.1 - Procesar suscripción mensual
        if (session.mode === 'subscription') {
          // Leer fecha actual de expiración para extender desde ahí
          const { data: userRow } = await supabase
            .from('users')
            .select('subscription_ends_at')
            .eq('id', userId)
            .single();

          const subscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : (session.subscription as { id?: string } | null)?.id;
          const stripeEndsAt = await getStripeSubscriptionEnd(subscriptionId);
          const now = new Date();
          const existingEnd = userRow?.subscription_ends_at ? new Date(userRow.subscription_ends_at) : null;
          const fallbackEnd = new Date(existingEnd && existingEnd > now ? existingEnd : now);
          fallbackEnd.setDate(fallbackEnd.getDate() + 30);
          const endsAt = stripeEndsAt || fallbackEnd;

          // Idempotencia: si ya expira en >= la nueva fecha, saltar
          if (existingEnd && existingEnd >= endsAt) {
            console.log('[webhook] Suscripción ya procesada, saltando');
          } else {
            const { error: roleError } = await supabase
              .from('users')
              .update({ role: 'subscriber', subscription_ends_at: endsAt.toISOString() })
              .eq('id', userId);

            if (roleError) {
              console.error('Error actualizando rol a suscriptor:', roleError);
              return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
            }
          }
        }

        // 7.2.2.2 - Procesar compra de carrito (múltiples items)
        const cartItemsStr = session.metadata?.items;
        if (session.mode === 'payment' && cartItemsStr) {
          let items: { book_id: string; type: string; cart_item_id: string; quantity?: number }[];
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
              await addToLibrary(supabase, userId, item.book_id, 'permanent');
            } else if (item.type === 'physical') {
              const quantity = item.quantity || 1;
              const { data: existingOrder } = await supabase
                .from('orders_physical')
                .select('id')
                .eq('stripe_payment_id', session.id)
                .eq('book_id', item.book_id)
                .maybeSingle();
              if (existingOrder) continue;
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
                shipping_cost: 0,
                total: price * quantity,
                stripe_payment_id: session.id,
              });
              const { data: decResult } = await supabase.rpc('decrement_admin_stock', { p_book_id: item.book_id, p_quantity: quantity });
              const dec = (decResult as any) || {};
              if (!dec.success) console.error('Error decrementando stock en webhook:', dec.error);
            }
          }

          await supabase.from('cart_items').delete().eq('user_id', userId);
        }

        // 7.2.2.2b - Procesar compra de libro individual (legacy)
        if (session.mode === 'payment' && bookId && !cartItemsStr) {
          const purchaseType = session.metadata?.purchaseType || 'digital_permanent';

          // Para digital o bundle, concedemos el acceso permanente al libro digital
          if (purchaseType === 'digital_permanent' || purchaseType === 'bundle') {
            const result = await addToLibrary(supabase, userId, bookId, 'permanent');
            if (result && 'error' in result) {
              console.error('Error concediendo acceso permanente:', result.error);
              return NextResponse.json({ error: 'Database insert failed' }, { status: 500 });
            }
          }

          // Para físico o bundle, creamos la orden física de forma segura en el servidor
          if (purchaseType === 'physical' || purchaseType === 'bundle') {
            const { data: existingOrder } = await supabase
              .from('orders_physical')
              .select('id')
              .eq('stripe_payment_id', session.id)
              .maybeSingle();

            if (!existingOrder) {
              const shippingStr = session.metadata?.shipping;
              let shippingInfo: Record<string, string> | null = null;
              if (shippingStr) {
                try {
                  shippingInfo = JSON.parse(shippingStr);
                } catch (e) {
                  console.error('Error parseando información de envío en webhook:', e);
                }
              }

              const { data: bookPrice } = await supabase
                .from('books')
                .select('price_physical')
                .eq('id', bookId)
                .single();
              
              const price = (bookPrice?.price_physical || 299);

              const { error: orderError } = await supabase.from('orders_physical').insert({
                user_id: userId,
                book_id: bookId,
                status: 'pending',
                name: shippingInfo?.name || '',
                address: shippingInfo?.address || '',
                city: shippingInfo?.city || '',
                state: shippingInfo?.state || '',
                zip: shippingInfo?.zip || '',
                phone: shippingInfo?.phone || '',
                shipping_cost: 0,
                total: price,
                stripe_payment_id: session.id,
              });

              if (orderError) {
                console.error('Error creando orden física en webhook:', orderError);
                return NextResponse.json({ error: 'Order creation failed' }, { status: 500 });
              }

              try {
                const qty = parseInt(session.metadata?.quantity || '1');
                const { data: decResult } = await supabase.rpc('decrement_admin_stock', { p_book_id: bookId, p_quantity: qty });
                const result = (decResult as any) || {};
                if (!result.success) console.error('Error decrementando stock en webhook:', result.error);
              } catch (stockErr) {
                console.error('Error decrementando stock en webhook:', stockErr);
              }
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
        const subscription = event.data.object as any;
        const subCustomerId = subscription.customer as string;
        const subEmail = subscription.customer_email as string | undefined;

        let userQuery = supabase
          .from('users')
          .select('id')
          .eq('stripe_customer_id', subCustomerId)
          .maybeSingle();

        const { data: users } = await userQuery;

        // Fallback: buscar por email si no se encontró por stripe_customer_id
        if (!users && subEmail) {
          const { data: userByEmail } = await supabase
            .from('users')
            .select('id')
            .eq('email', subEmail)
            .maybeSingle();
          if (userByEmail) {
            await supabase
              .from('users')
              .update({ role: 'free', subscription_ends_at: null, stripe_customer_id: subCustomerId })
              .eq('id', userByEmail.id);
          }
        } else if (users) {
          await supabase
            .from('users')
            .update({ role: 'free', subscription_ends_at: null })
            .eq('id', users.id);
        }

        break;
      }

      // 7.2.4 - Suscripción actualizada: Extender/renovar período
      case 'customer.subscription.updated': {
        const sub = event.data.object as any;
        const customerId = sub.customer as string;
        const status = sub.status;
        const periodEnd = sub.current_period_end as number;

        if (status === 'active' || status === 'trialing') {
          const { data: users } = await supabase
            .from('users')
            .select('id, subscription_ends_at')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();

          if (users) {
            const endsAt = new Date(periodEnd * 1000).toISOString();
            const existingEnd = users.subscription_ends_at ? new Date(users.subscription_ends_at) : null;
            if (!existingEnd || existingEnd < new Date(periodEnd * 1000)) {
              await supabase
                .from('users')
                .update({ role: 'subscriber', subscription_ends_at: endsAt })
                .eq('id', users.id);
            }
          }
        }
        break;
      }

      // 7.2.5 - Pago fallido: Solo logging
      case 'invoice.payment_failed': {
        console.warn('Pago fallido:', event.data.object.id);
        break;
      }

      default:
        console.log(`Tipo de evento no manejado: ${event.type}`);
    }

    // Record idempotency (fire-and-forget, non-blocking)
    try {
      await supabase.from('webhook_events').upsert({
        id: event.id,
        event_type: event.type,
      }, { onConflict: 'id', ignoreDuplicates: true });
    } catch (e) {
      console.error('[webhook] Error guardando idempotencia:', e);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Error inesperado en webhook:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
