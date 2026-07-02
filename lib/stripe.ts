import { Stripe } from 'stripe';

// Instancia lazy para evitar inicializar Stripe durante builds sin secretos.
let stripeInstance: Stripe | null = null;
const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2026-02-25.clover';

// Crea/reutiliza el cliente Stripe solo en runtime servidor.
export function getStripeClient(): Stripe {
  if (stripeInstance) {
    return stripeInstance;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY no está configurada");
  }

  stripeInstance = new Stripe(secretKey.trim(), {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
    maxNetworkRetries: 2,
  });

  return stripeInstance;
}

// Proxy compatible con imports legacy tipo stripe.checkout.sessions.create.
export const stripe = new Proxy({} as Stripe, {
  get(target, prop, receiver) {
    const client = getStripeClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

// Price IDs configurados en Stripe; el de pagos unicos se calcula desde DB.
export const PRICE_IDS = {
  premium: process.env.STRIPE_SUBSCRIPTION_PRICE_ID,
};

// Crea sesiones Checkout para suscripciones o pagos unicos con metadata auditada.
export async function createCheckoutSession({
  priceId,
  priceData,
  userId,
  userEmail,
  bookId,
  successUrl,
  cancelUrl,
  mode = 'payment',
  metadata = {},
}: {
  priceId?: string;
  priceData?: Stripe.Checkout.SessionCreateParams.LineItem.PriceData;
  userId: string;
  userEmail: string;
  bookId?: string;
  successUrl: string;
  cancelUrl: string;
  mode?: 'payment' | 'subscription';
  metadata?: Stripe.MetadataParam;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();
  const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = priceData
    ? { price_data: priceData, quantity: 1 }
    : { price: priceId, quantity: 1 };

  if (!priceData && !priceId) {
    throw new Error('Stripe checkout requiere priceId o priceData');
  }

  const session = await stripe.checkout.sessions.create({
    mode,
    payment_method_types: ['card'],
    customer_email: userEmail,
    line_items: [lineItem],
    metadata: {
      userId,
      bookId: bookId || '',
      ...metadata,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return session;
}

// Crea portal de facturacion para que el usuario gestione su suscripcion.
export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}
