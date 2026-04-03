import Stripe from 'stripe';

// ============================================
// 6.7 - Stripe: Configuración y utilerías para integración con Stripe Payments
// Maneja creación de sesiones de checkout y portal de facturación
// ============================================

// 6.7.1 - Instancia global del cliente Stripe (con protección para el build)
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("⚠️ ALERTA: STRIPE_SECRET_KEY ausente durante el build o ejecución.");
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2026-02-25.clover',
  typescript: true,
});

// 6.7.2 - Mapeo de IDs de precios de Stripe (desde variables de entorno)
// Útiles para suscripciones y productos predefinidos
export const PRICE_IDS = {
  subscription: process.env.STRIPE_SUBSCRIPTION_PRICE_ID || 'price_monthly_99',
  digital_permanent: process.env.STRIPE_DIGITAL_PERMANENT_PRICE_ID || 'price_digital_49',
  physical_basic: process.env.STRIPE_PHYSICAL_PRICE_ID || 'price_physical_199',
  bundle: process.env.STRIPE_BUNDLE_PRICE_ID || 'price_bundle_229',
};

// 6.7.3 - Función para crear sesión de checkout de Stripe
// Soporta tanto pagos únicos como suscripciones
export async function createCheckoutSession({
  priceId,
  priceData,
  userId,
  userEmail,
  bookId,
  successUrl,
  cancelUrl,
  mode = 'payment',
}: {
  priceId?: string;
  priceData?: Stripe.Checkout.SessionCreateParams.LineItem.PriceData;
  userId: string;
  userEmail: string;
  bookId?: string;
  successUrl: string;
  cancelUrl: string;
  mode?: 'payment' | 'subscription';
}) {
  // Crear sesión de checkout con metadata para webhook
  const session = await stripe.checkout.sessions.create({
    mode,
    payment_method_types: ['card'],
    customer_email: userEmail,
    line_items: [
      priceData 
        ? { price_data: priceData, quantity: 1 } 
        : { price: priceId, quantity: 1 }
    ],
    metadata: {
      userId,
      bookId: bookId || '',
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return session;
}

// 6.7.4 - Función para crear sesión del portal de facturación
// Permite a usuarios gestionar sus suscripciones y métodos de pago
export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}
