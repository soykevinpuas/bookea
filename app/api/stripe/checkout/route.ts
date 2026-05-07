import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/server';
import { createCheckoutSession, PRICE_IDS } from '@/lib/stripe';

// ============================================
// 7.1 - Stripe Checkout API: Endpoint para iniciar proceso de compra
// Crea sesiones de checkout de Stripe para suscripciones y compras de libros
// ============================================

export async function POST(request: NextRequest) {
  try {
    // 7.1.1 - Verificar autenticación del usuario
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // 7.1.2 - Extraer tipo de compra y ID del libro del body
    const body = await request.json();
    const { type, bookId } = body;

    // 7.1.2 - Determinar la URL base dinámicamente
    const { origin: baseUrl } = request.nextUrl;

    // 7.1.3 - Manejo de suscripción mensual
    if (type === 'subscription') {
      const session = await createCheckoutSession({
        priceId: PRICE_IDS.premium,
        userId: user.id,
        userEmail: user.email!,
        successUrl: `${baseUrl}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}/catalog?payment=cancelled`,
        mode: 'subscription',
      });
      return NextResponse.json({ url: session.url });
    }

    // 7.1.4 - Validación de bookId para compras de libros
    if (!bookId) {
      return NextResponse.json({ error: 'Book ID es requerido para compras' }, { status: 400 });
    }

    // 7.1.5 - Obtener precio DESDE LA BASE DE DATOS para prevenir manipulación (anti-spoofing)
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('title, price_digital, price_physical, price_bundle')
      .eq('id', bookId)
      .single();

    if (bookError || !book) {
      return NextResponse.json({ error: 'Libro no encontrado' }, { status: 404 });
    }

    // 7.1.6 - Determinar precio y descripción según tipo de compra
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

    // 7.1.7 - Crear datos del precio (Stripe requiere centavos)
    const priceData = {
      currency: 'mxn',
      product_data: {
        name: `${book.title} - ${descriptionType}`,
      },
      unit_amount: exactPrice * 100, // Importante: Stripe procesa en centavos
    };

    // 7.1.8 - Crear sesión de checkout de Stripe
    const session = await createCheckoutSession({
      priceData,
      userId: user.id,
      userEmail: user.email!,
      bookId,
      successUrl: `${baseUrl}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/book/${bookId}?payment=cancelled`,
      mode: 'payment',
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error('CRITICAL: Error creando sesión de checkout:', error);
    return NextResponse.json(
      { error: 'Error al crear la sesión de pago' },
      { status: 500 }
    );
  }
}
