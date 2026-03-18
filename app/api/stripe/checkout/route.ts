import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/server';
import { createCheckoutSession, PRICE_IDS } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { type, bookId } = body;

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    if (type === 'subscription') {
      const session = await createCheckoutSession({
        priceId: PRICE_IDS.subscription,
        userId: user.id,
        userEmail: user.email!,
        successUrl: `${baseUrl}/dashboard?payment=success`,
        cancelUrl: `${baseUrl}/catalog?payment=cancelled`,
        mode: 'subscription',
      });
      return NextResponse.json({ url: session.url });
    }

    if (!bookId) {
      return NextResponse.json({ error: 'Book ID is required for purchases' }, { status: 400 });
    }

    // Securely get the price from DB instead of trusting the client payload
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('title, price_digital, price_physical, price_bundle')
      .eq('id', bookId)
      .single();

    if (bookError || !book) {
      return NextResponse.json({ error: 'Libro no encontrado' }, { status: 404 });
    }

    let exactPrice = 0;
    let descriptionType = '';

    switch (type) {
      case 'digital_permanent':
        exactPrice = book.price_digital || 49;
        descriptionType = 'Digital';
        break;
      case 'physical':
        exactPrice = book.price_physical || 199;
        descriptionType = 'Físico';
        break;
      case 'bundle':
        exactPrice = book.price_bundle || 229;
        descriptionType = 'Bundle (Físico + Digital)';
        break;
      default:
        return NextResponse.json({ error: 'Tipo de compra inválido' }, { status: 400 });
    }

    const priceData = {
      currency: 'mxn',
      product_data: {
        name: `${book.title} - ${descriptionType}`,
      },
      unit_amount: exactPrice * 100, // Stripe expects minimum units (cents)
    };

    const session = await createCheckoutSession({
      priceData,
      userId: user.id,
      userEmail: user.email!,
      bookId,
      successUrl: `${baseUrl}/dashboard?payment=success`,
      cancelUrl: `${baseUrl}/book/${bookId}?payment=cancelled`,
      mode: 'payment',
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Error al crear la sesión de pago' },
      { status: 500 }
    );
  }
}
