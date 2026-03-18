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

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const bookId = session.metadata?.bookId;
      const customerId = session.customer as string;

      if (session.mode === 'subscription') {
        await supabase
          .from('users')
          .update({ role: 'subscriber' })
          .eq('id', userId);

        const { data: existingSub } = await supabase
          .from('subscription_credits')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (!existingSub) {
          await supabase.from('subscription_credits').insert({
            user_id: userId,
            cycle_start: new Date().toISOString().split('T')[0],
            credits_remaining: 5,
          });
        }
      }

      if (session.mode === 'payment' && bookId) {
        await supabase.from('user_books').insert({
          user_id: userId,
          book_id: bookId,
          access_type: 'permanent',
        });
      }

      if (customerId) {
        await supabase
          .from('users')
          .update({ stripe_customer_id: customerId })
          .eq('id', userId);
      }

      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      
      const { data: users } = await supabase
        .from('users')
        .select('id')
        .eq('stripe_customer_id', subscription.customer)
        .single();

      if (users) {
        await supabase
          .from('users')
          .update({ role: 'free' })
          .eq('id', users.id);
      }

      break;
    }

    case 'invoice.payment_failed': {
      console.log('Payment failed for invoice:', event.data.object.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
