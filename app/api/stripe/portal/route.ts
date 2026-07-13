import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/server';

function isMissingStripeCustomer(error: unknown) {
  if (typeof error !== 'object' || error === null) return false;
  const stripeError = error as { type?: unknown; code?: unknown };
  return stripeError.type === 'StripeInvalidRequestError' && stripeError.code === 'resource_missing';
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener el ID de cliente de Stripe desde la base de datos
    const { data: userData } = await supabase
      .from('users')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single();

    let stripeCustomerId = userData?.stripe_customer_id;

    // Si no hay customer de Stripe, crearlo automáticamente
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userData?.email || user.email,
      });
      stripeCustomerId = customer.id;
      await supabase
        .from('users')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', user.id);
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bookea-nine.vercel.app';

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${baseUrl}/profile`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    // Si el customer no existe en Stripe (ej. test vs live mismatch),
    // crear uno nuevo y actualizar la DB
    if (isMissingStripeCustomer(error)) {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const customer = await stripe.customers.create({
          email: user?.email,
        });
        await supabase.from('users').update({ stripe_customer_id: customer.id }).eq('id', user?.id);
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bookea-nine.vercel.app';
        const session = await stripe.billingPortal.sessions.create({
          customer: customer.id,
          return_url: `${baseUrl}/profile`,
        });
        return NextResponse.json({ url: session.url });
      } catch (retryError: unknown) {
        console.error('Error creating portal session after retry:', retryError);
        return NextResponse.json(
          { error: 'Error al crear la sesión del portal de cliente' },
          { status: 500 }
        );
      }
    }

    console.error('Error creating portal session:', error);
    return NextResponse.json(
      { error: 'Error al crear la sesión del portal de cliente' },
      { status: 500 }
    );
  }
}
