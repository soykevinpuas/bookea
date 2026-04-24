import { Stripe } from 'stripe';

/**
 * 6.7.1 - Instancia global del cliente Stripe.
 * Usamos una inicialización segura para evitar fallos durante el build.
 */
let stripeInstance: Stripe | null = null;

/**
 * 6.7.1 - Obtiene la instancia del cliente Stripe (Lazy Loading).
 * Garantiza que las variables de entorno estén cargadas antes de la inicialización.
 */
export function getStripeClient() {
  if (stripeInstance) return stripeInstance;
  
  // Acceso directo a process.env para mayor confiabilidad
  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  
  if (!secretKey || secretKey === "sk_test_dummy") {
    // Solo permitir dummy en fase de build
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return new Stripe('sk_test_dummy', { apiVersion: '2024-06-20' as any, typescript: true });
    }
    // Si llegamos aquí en runtime, algo anda mal con el entorno
    console.error("[getStripeClient] ERROR: STRIPE_SECRET_KEY no encontrada en process.env");
    throw new Error("Clave API de Stripe no configurada en el servidor.");
  }

  stripeInstance = new Stripe(secretKey.trim(), {
    apiVersion: '2024-06-20' as any,
    typescript: true,
  });

  return stripeInstance;
}

/**
 * 6.7.1b - Exportación compatible habilitando Lazy Loading.
 * Permite usar 'stripe.checkout.sessions.create' de forma transparente 
 * sin inicializar el cliente hasta que sea realmente invocado.
 */
export const stripe = new Proxy({} as Stripe, {
  get(target, prop, receiver) {
    const client = getStripeClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

// 6.7.2 - Mapeo de IDs de precios de Stripe (desde variables de entorno)
// Útiles para suscripciones y productos predefinidos
export const PRICE_IDS = {
  // Plan mensual Premium (Suscripción)
  // NOTA: Se actualizó de STRIPE_PREMIUM_PRICE_ID a STRIPE_SUBSCRIPTION_PRICE_ID para coincidir con el .env.local
  premium: process.env.STRIPE_SUBSCRIPTION_PRICE_ID || 'price_monthly_99',
  
  // Otros productos (Pagos únicos)
  digital_permanent: process.env.STRIPE_DIGITAL_PERMANENT_PRICE_ID || 'price_1TDdl0EKGOOZEccNCLD8qa2F',
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
  const stripe = getStripeClient();
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
  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}
