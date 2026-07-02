import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import type { Stripe } from 'stripe';
import { getStripeClient } from '@/lib/stripe';
import { createAdminClient } from '@/lib/server';
import { addToLibrary } from '@/lib/books';

// Contratos internos del webhook; la UI no debe depender de estos detalles.
type SupabaseAdminClient = ReturnType<typeof createAdminClient>;
type UserRole = 'free' | 'subscriber' | 'admin' | 'vendedor';
type PurchaseType = 'digital_permanent' | 'physical' | 'bundle' | 'subscription';
type CartItemType = 'digital' | 'physical';

interface UserSubscriptionRow {
  id: string;
  role: UserRole;
  subscriptionEndsAt: string | null;
}

interface CartPurchaseItem {
  bookId: string;
  type: CartItemType;
  cartItemId: string;
  quantity: number;
}

interface ShippingInfo {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

interface PhysicalOrderInput {
  userId: string;
  bookId: string;
  stripePaymentId: string;
  quantity: number;
  shipping: ShippingInfo;
  total: number;
}

interface SupabaseErrorLike {
  message: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}

type DecrementedPhysicalOrderResult =
  | { success: true; orderId: string; alreadyProcessed: boolean }
  | { success: false; error: string };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVILEGED_ROLES: ReadonlySet<UserRole> = new Set(['admin', 'vendedor']);

// Error con status HTTP para distinguir payload invalido de fallos internos.
class WebhookProcessingError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'WebhookProcessingError';
    this.statusCode = statusCode;
  }
}

function invalidWebhookPayload(message: string): WebhookProcessingError {
  return new WebhookProcessingError(message, 400);
}

// Helpers de parsing defensivo: Stripe metadata llega como strings no confiables.
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readRequiredString(record: Record<string, unknown>, key: string): string {
  const value = readString(record[key]);
  if (!value) {
    throw invalidWebhookPayload(`Campo requerido ausente o invalido: ${key}`);
  }
  return value;
}

function readRequiredUuid(value: unknown, fieldName: string): string {
  const text = readString(value);
  if (!text || !UUID_REGEX.test(text)) {
    throw invalidWebhookPayload(`UUID invalido en ${fieldName}`);
  }
  return text;
}

function readOptionalDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function assertNoSupabaseError(error: SupabaseErrorLike | null, operation: string): void {
  if (!error) return;

  const details = error.details ? ` Details: ${error.details}` : '';
  const hint = error.hint ? ` Hint: ${error.hint}` : '';
  throw new WebhookProcessingError(`${operation}: ${error.message}.${details}${hint}`);
}

function getMetadataValue(
  metadata: Stripe.Metadata | null | undefined,
  key: string
): string | null {
  return readString(metadata?.[key]);
}

function parseJsonMetadata(rawValue: string, fieldName: string): unknown {
  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    throw invalidWebhookPayload(`Metadata JSON invalida: ${fieldName}`);
  }
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'free' || value === 'subscriber' || value === 'admin' || value === 'vendedor';
}

function normalizeUserSubscriptionRow(value: unknown): UserSubscriptionRow {
  if (!isRecord(value)) {
    throw new WebhookProcessingError('Respuesta invalida consultando usuario');
  }

  const role = isUserRole(value.role) ? value.role : 'free';

  return {
    id: readRequiredUuid(value.id, 'users.id'),
    role,
    subscriptionEndsAt: typeof value.subscription_ends_at === 'string' ? value.subscription_ends_at : null,
  };
}

function normalizeUserIdentityRow(value: unknown): Pick<UserSubscriptionRow, 'id' | 'role'> {
  if (!isRecord(value)) {
    throw new WebhookProcessingError('Respuesta invalida consultando usuario');
  }

  return {
    id: readRequiredUuid(value.id, 'users.id'),
    role: isUserRole(value.role) ? value.role : 'free',
  };
}

// Valida tipos de compra permitidos antes de conceder acceso o crear orden.
function isPurchaseType(value: string): value is PurchaseType {
  return value === 'digital_permanent' || value === 'physical' || value === 'bundle' || value === 'subscription';
}

function parsePurchaseType(rawValue: string | null): PurchaseType {
  if (!rawValue) {
    return 'digital_permanent';
  }

  if (!isPurchaseType(rawValue)) {
    throw invalidWebhookPayload(`Tipo de compra invalido: ${rawValue}`);
  }

  return rawValue;
}

function parseCartItemType(value: unknown, fieldName: string): CartItemType {
  if (value === 'digital' || value === 'physical') {
    return value;
  }

  throw invalidWebhookPayload(`Tipo de item invalido en ${fieldName}`);
}

function parsePositiveInteger(value: unknown, fieldName: string, defaultValue = 1): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const numberValue = typeof value === 'string' ? Number(value) : value;
  if (typeof numberValue !== 'number' || !Number.isInteger(numberValue) || numberValue <= 0) {
    throw invalidWebhookPayload(`Cantidad invalida en ${fieldName}`);
  }

  return numberValue;
}

// Parsea items serializados por checkout de carrito.
function parseCartItems(metadata: Stripe.Metadata | null | undefined): CartPurchaseItem[] {
  const rawItems = getMetadataValue(metadata, 'items');
  if (!rawItems) {
    return [];
  }

  const parsedItems = parseJsonMetadata(rawItems, 'items');
  if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
    throw invalidWebhookPayload('Metadata items debe ser un arreglo no vacio');
  }

  return parsedItems.map((item, index) => {
    if (!isRecord(item)) {
      throw invalidWebhookPayload(`Item de carrito invalido en items[${index}]`);
    }

    return {
      bookId: readRequiredUuid(item.book_id, `items[${index}].book_id`),
      type: parseCartItemType(item.type, `items[${index}].type`),
      cartItemId: readRequiredString(item, 'cart_item_id'),
      quantity: parsePositiveInteger(item.quantity, `items[${index}].quantity`),
    };
  });
}

// Shipping es obligatorio para cualquier item fisico.
function parseRequiredShippingInfo(metadata: Stripe.Metadata | null | undefined): ShippingInfo {
  const rawShipping = getMetadataValue(metadata, 'shipping');
  if (!rawShipping) {
    throw invalidWebhookPayload('Metadata shipping requerida para orden fisica');
  }

  const parsedShipping = parseJsonMetadata(rawShipping, 'shipping');
  if (!isRecord(parsedShipping)) {
    throw invalidWebhookPayload('Metadata shipping debe ser un objeto');
  }

  return {
    name: readRequiredString(parsedShipping, 'name'),
    address: readRequiredString(parsedShipping, 'address'),
    city: readRequiredString(parsedShipping, 'city'),
    state: readRequiredString(parsedShipping, 'state'),
    zip: readRequiredString(parsedShipping, 'zip'),
    phone: readRequiredString(parsedShipping, 'phone'),
  };
}

// Stripe puede entregar customer/subscription como id string u objeto expandido.
function getCustomerId(customer: Stripe.Checkout.Session.CustomerDetails | string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (typeof customer === 'string') {
    return customer;
  }

  if (isRecord(customer)) {
    return readString(customer.id);
  }

  return null;
}

function getSubscriptionId(subscription: string | Stripe.Subscription | null): string | null {
  if (typeof subscription === 'string') {
    return subscription;
  }

  return subscription?.id ?? null;
}

// Lee fin de periodo compatible con distintas formas de objeto Stripe.Subscription.
function getLegacyNumericField(value: unknown, key: string): number | null {
  if (!isRecord(value)) {
    return null;
  }

  const rawValue = value[key];
  return typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : null;
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const legacyPeriodEnd = getLegacyNumericField(subscription, 'current_period_end');
  const itemPeriodEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((periodEnd) => Number.isFinite(periodEnd) && periodEnd > 0);

  const periodEnd = legacyPeriodEnd ?? (itemPeriodEnds.length > 0 ? Math.max(...itemPeriodEnds) : null);

  return periodEnd ? new Date(periodEnd * 1000) : null;
}

async function getStripeSubscriptionEnd(
  stripeClient: Stripe,
  subscriptionId: string | null
): Promise<Date | null> {
  if (!subscriptionId) {
    return null;
  }

  const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
  return getSubscriptionPeriodEnd(subscription);
}

function calculateFallbackSubscriptionEnd(existingEnd: Date | null): Date {
  const now = new Date();
  const fallbackEnd = new Date(existingEnd && existingEnd > now ? existingEnd : now);
  fallbackEnd.setDate(fallbackEnd.getDate() + 30);
  return fallbackEnd;
}

// Consulta el usuario con service-role; el webhook no depende de RLS del cliente.
async function getUserSubscriptionRow(
  supabase: SupabaseAdminClient,
  userId: string
): Promise<UserSubscriptionRow> {
  const { data, error } = await supabase
    .from('users')
    .select('id, role, subscription_ends_at')
    .eq('id', userId)
    .maybeSingle();

  assertNoSupabaseError(error, 'Error consultando usuario para suscripcion');

  if (!data) {
    throw new WebhookProcessingError(`Usuario no encontrado para webhook: ${userId}`);
  }

  return normalizeUserSubscriptionRow(data);
}

// Activa/renueva suscripcion y conserva roles admin/vendedor.
async function setSubscriptionActive(
  supabase: SupabaseAdminClient,
  user: UserSubscriptionRow,
  endsAt: Date,
  customerId: string | null
): Promise<void> {
  const existingEnd = readOptionalDate(user.subscriptionEndsAt);
  const shouldExtendSubscription = !existingEnd || existingEnd < endsAt;
  const shouldPersistCustomer = Boolean(customerId);

  if (!shouldExtendSubscription && !shouldPersistCustomer) {
    return;
  }

  const updatePayload: {
    subscription_ends_at?: string;
    stripe_customer_id?: string;
    role?: UserRole;
  } = {};

  if (shouldExtendSubscription) {
    updatePayload.subscription_ends_at = endsAt.toISOString();
  }

  if (customerId) {
    updatePayload.stripe_customer_id = customerId;
  }

  if (!PRIVILEGED_ROLES.has(user.role)) {
    updatePayload.role = 'subscriber';
  }

  const { error } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', user.id);

  assertNoSupabaseError(error, 'Error actualizando suscripcion de usuario');
}

// Guarda customer id para portal y eventos futuros.
async function persistCustomerId(
  supabase: SupabaseAdminClient,
  userId: string,
  customerId: string | null
): Promise<void> {
  if (!customerId) {
    return;
  }

  const { error } = await supabase
    .from('users')
    .update({ stripe_customer_id: customerId })
    .eq('id', userId);

  assertNoSupabaseError(error, 'Error guardando customer id de Stripe');
}

// Concede acceso digital permanente desde un pago confirmado.
async function grantPermanentBookAccess(
  supabase: SupabaseAdminClient,
  userId: string,
  bookId: string
): Promise<void> {
  const result = await addToLibrary(supabase, userId, bookId, 'permanent');

  if (isRecord(result) && typeof result.error === 'string') {
    throw new WebhookProcessingError(`Error concediendo acceso permanente: ${result.error}`);
  }
}

// Obtiene precio de DB y usa fallback defensivo solo si falta el campo.
async function getPhysicalBookPrice(
  supabase: SupabaseAdminClient,
  bookId: string,
  priceColumn: 'price_physical' | 'price_bundle'
): Promise<number> {
  const { data, error } = await supabase
    .from('books')
    .select('price_physical, price_bundle')
    .eq('id', bookId)
    .single();

  assertNoSupabaseError(error, 'Error consultando precio fisico');

  const priceRow: unknown = data;

  if (!isRecord(priceRow)) {
    throw new WebhookProcessingError(`Libro no encontrado al cumplir orden fisica: ${bookId}`);
  }

  const rawPrice = priceRow[priceColumn];
  if (typeof rawPrice === 'number' && Number.isFinite(rawPrice) && rawPrice >= 0) {
    return rawPrice;
  }

  return priceColumn === 'price_bundle' ? 319 : 299;
}

function parsePhysicalOrderResult(value: unknown): DecrementedPhysicalOrderResult {
  if (!isRecord(value)) {
    return { success: false, error: 'Respuesta invalida de fulfill_physical_order_from_stripe' };
  }

  if (value.success === true) {
    return {
      success: true,
      orderId: readRequiredUuid(value.order_id, 'fulfill_physical_order_from_stripe.order_id'),
      alreadyProcessed: value.already_processed === true,
    };
  }

  return {
    success: false,
    error: typeof value.error === 'string' ? value.error : 'Error desconocido cumpliendo orden fisica',
  };
}

// Crea la orden fisica y descuenta stock dentro de una RPC transaccional.
async function fulfillPhysicalOrder(
  supabase: SupabaseAdminClient,
  input: PhysicalOrderInput
): Promise<void> {
  const { data, error } = await supabase.rpc('fulfill_physical_order_from_stripe', {
    p_user_id: input.userId,
    p_book_id: input.bookId,
    p_stripe_payment_id: input.stripePaymentId,
    p_quantity: input.quantity,
    p_name: input.shipping.name,
    p_address: input.shipping.address,
    p_city: input.shipping.city,
    p_state: input.shipping.state,
    p_zip: input.shipping.zip,
    p_phone: input.shipping.phone,
    p_shipping_cost: 0,
    p_total: input.total,
  });

  assertNoSupabaseError(error, 'Error cumpliendo orden fisica');

  const result = parsePhysicalOrderResult(data);
  if (!result.success) {
    throw new WebhookProcessingError(result.error);
  }
}

// Elimina items del carrito solo despues de procesar pago.
async function removeProcessedCartItems(
  supabase: SupabaseAdminClient,
  cartItemIds: string[]
): Promise<void> {
  if (cartItemIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from('cart_items')
    .delete()
    .in('id', cartItemIds);

  assertNoSupabaseError(error, 'Error limpiando carrito despues del pago');
}

// Idempotencia: evita reprocesar reintentos de Stripe.
async function hasProcessedWebhookEvent(
  supabase: SupabaseAdminClient,
  eventId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('id', eventId)
    .maybeSingle();

  assertNoSupabaseError(error, 'Error consultando idempotencia de webhook');
  return Boolean(data);
}

// Registra evento procesado aun cuando Stripe vuelva a enviarlo.
async function recordProcessedWebhookEvent(
  supabase: SupabaseAdminClient,
  event: Stripe.Event
): Promise<void> {
  const { error } = await supabase
    .from('webhook_events')
    .upsert(
      {
        id: event.id,
        event_type: event.type,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );

  assertNoSupabaseError(error, 'Error guardando idempotencia de webhook');
}

// Maneja checkout de suscripcion completado.
async function handleSubscriptionCheckoutCompleted(
  supabase: SupabaseAdminClient,
  stripeClient: Stripe,
  session: Stripe.Checkout.Session,
  userId: string,
  customerId: string | null
): Promise<void> {
  const user = await getUserSubscriptionRow(supabase, userId);
  const existingEnd = readOptionalDate(user.subscriptionEndsAt);
  const subscriptionId = getSubscriptionId(session.subscription);
  const stripeEndsAt = await getStripeSubscriptionEnd(stripeClient, subscriptionId);
  const endsAt = stripeEndsAt ?? calculateFallbackSubscriptionEnd(existingEnd);

  await setSubscriptionActive(supabase, user, endsAt, customerId);
}

// Maneja checkout moderno de carrito con items serializados en metadata.
async function handleCartCheckoutCompleted(
  supabase: SupabaseAdminClient,
  session: Stripe.Checkout.Session,
  userId: string,
  items: CartPurchaseItem[]
): Promise<void> {
  const hasPhysicalItem = items.some((item) => item.type === 'physical');
  const shipping = hasPhysicalItem ? parseRequiredShippingInfo(session.metadata) : null;

  for (const item of items) {
    if (item.type === 'digital') {
      await grantPermanentBookAccess(supabase, userId, item.bookId);
      continue;
    }

    if (!shipping) {
      throw invalidWebhookPayload('Shipping requerido para item fisico');
    }

    const price = await getPhysicalBookPrice(supabase, item.bookId, 'price_physical');
    await fulfillPhysicalOrder(supabase, {
      userId,
      bookId: item.bookId,
      stripePaymentId: session.id,
      quantity: item.quantity,
      shipping,
      total: price * item.quantity,
    });
  }

  await removeProcessedCartItems(
    supabase,
    items.map((item) => item.cartItemId)
  );
}

// Maneja checkout legacy de un solo libro.
async function handleLegacyBookCheckoutCompleted(
  supabase: SupabaseAdminClient,
  session: Stripe.Checkout.Session,
  userId: string,
  bookId: string
): Promise<void> {
  const purchaseType = parsePurchaseType(getMetadataValue(session.metadata, 'purchaseType'));

  if (purchaseType === 'digital_permanent' || purchaseType === 'bundle') {
    await grantPermanentBookAccess(supabase, userId, bookId);
  }

  if (purchaseType === 'physical' || purchaseType === 'bundle') {
    const shipping = parseRequiredShippingInfo(session.metadata);
    const quantity = parsePositiveInteger(getMetadataValue(session.metadata, 'quantity'), 'metadata.quantity');
    const priceColumn = purchaseType === 'bundle' ? 'price_bundle' : 'price_physical';
    const price = await getPhysicalBookPrice(supabase, bookId, priceColumn);

    await fulfillPhysicalOrder(supabase, {
      userId,
      bookId,
      stripePaymentId: session.id,
      quantity,
      shipping,
      total: price * quantity,
    });
  }
}

// Decide si una sesion completada es suscripcion, carrito o compra legacy.
async function handleCheckoutCompleted(
  supabase: SupabaseAdminClient,
  stripeClient: Stripe,
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = readRequiredUuid(getMetadataValue(session.metadata, 'userId'), 'metadata.userId');
  const customerId = getCustomerId(session.customer);

  if (session.mode === 'payment' && session.payment_status !== 'paid') {
    console.warn('[webhook] Checkout payment completed without paid status, skipping grants:', session.id);
    return;
  }

  if (session.mode === 'subscription') {
    await handleSubscriptionCheckoutCompleted(supabase, stripeClient, session, userId, customerId);
    return;
  }

  const cartItems = parseCartItems(session.metadata);
  if (session.mode === 'payment' && cartItems.length > 0) {
    await handleCartCheckoutCompleted(supabase, session, userId, cartItems);
    await persistCustomerId(supabase, userId, customerId);
    return;
  }

  const bookId = getMetadataValue(session.metadata, 'bookId');
  if (session.mode === 'payment' && bookId) {
    await handleLegacyBookCheckoutCompleted(
      supabase,
      session,
      userId,
      readRequiredUuid(bookId, 'metadata.bookId')
    );
    await persistCustomerId(supabase, userId, customerId);
  }
}

// Extrae email solo de clientes no eliminados.
function extractCustomerEmail(customer: Stripe.Customer | Stripe.DeletedCustomer): string | null {
  if ('deleted' in customer && customer.deleted) {
    return null;
  }

  return customer.email ?? null;
}

async function fetchCustomerEmail(stripeClient: Stripe, customerId: string): Promise<string | null> {
  const customer = await stripeClient.customers.retrieve(customerId);
  return extractCustomerEmail(customer);
}

// Busca usuario por customer id guardado.
async function findUserByStripeCustomerId(
  supabase: SupabaseAdminClient,
  customerId: string
): Promise<Pick<UserSubscriptionRow, 'id' | 'role'> | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, role')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  assertNoSupabaseError(error, 'Error buscando usuario por customer id');
  return data ? normalizeUserIdentityRow(data) : null;
}

// Busca usuario por email cuando Stripe no puede asociarse por customer id.
async function findUserByEmail(
  supabase: SupabaseAdminClient,
  email: string
): Promise<Pick<UserSubscriptionRow, 'id' | 'role'> | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, role')
    .eq('email', email)
    .maybeSingle();

  assertNoSupabaseError(error, 'Error buscando usuario por email');
  return data ? normalizeUserIdentityRow(data) : null;
}

// Revoca suscripcion sin degradar roles privilegiados.
async function revokeSubscriptionAccess(
  supabase: SupabaseAdminClient,
  user: Pick<UserSubscriptionRow, 'id' | 'role'>,
  customerId: string | null
): Promise<void> {
  const updatePayload: {
    role?: UserRole;
    subscription_ends_at: null;
    stripe_customer_id?: string;
  } = {
    subscription_ends_at: null,
  };

  if (!PRIVILEGED_ROLES.has(user.role)) {
    updatePayload.role = 'free';
  }

  if (customerId) {
    updatePayload.stripe_customer_id = customerId;
  }

  const { error } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', user.id);

  assertNoSupabaseError(error, 'Error revocando suscripcion cancelada');
}

// Procesa cancelacion/eliminacion de suscripcion.
async function handleSubscriptionDeleted(
  supabase: SupabaseAdminClient,
  stripeClient: Stripe,
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId = getCustomerId(subscription.customer);
  if (!customerId) {
    throw invalidWebhookPayload('customer.subscription.deleted sin customer id');
  }

  const userByCustomerId = await findUserByStripeCustomerId(supabase, customerId);
  if (userByCustomerId) {
    await revokeSubscriptionAccess(supabase, userByCustomerId, null);
    return;
  }

  const expandedEmail = isRecord(subscription.customer) ? readString(subscription.customer.email) : null;
  const customerEmail = expandedEmail ?? (await fetchCustomerEmail(stripeClient, customerId));

  if (!customerEmail) {
    console.warn('[webhook] Subscription deleted without matching user or customer email:', subscription.id);
    return;
  }

  const userByEmail = await findUserByEmail(supabase, customerEmail);
  if (!userByEmail) {
    console.warn('[webhook] Subscription deleted for unknown customer email:', customerEmail);
    return;
  }

  await revokeSubscriptionAccess(supabase, userByEmail, customerId);
}

// Procesa renovaciones o reactivaciones de suscripcion.
async function handleSubscriptionUpdated(
  supabase: SupabaseAdminClient,
  subscription: Stripe.Subscription
): Promise<void> {
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    return;
  }

  const customerId = getCustomerId(subscription.customer);
  if (!customerId) {
    throw invalidWebhookPayload('customer.subscription.updated sin customer id');
  }

  const user = await findUserByStripeCustomerId(supabase, customerId);
  if (!user) {
    console.warn('[webhook] Subscription updated for unknown customer:', customerId);
    return;
  }

  const periodEnd = getSubscriptionPeriodEnd(subscription);
  if (!periodEnd) {
    throw new WebhookProcessingError(`No se pudo leer current period end para subscription ${subscription.id}`);
  }

  const subscriptionUser = await getUserSubscriptionRow(supabase, user.id);
  await setSubscriptionActive(supabase, subscriptionUser, periodEnd, customerId);
}

// Router interno por tipo de evento Stripe.
async function processStripeEvent(
  supabase: SupabaseAdminClient,
  stripeClient: Stripe,
  event: Stripe.Event
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(supabase, stripeClient, event.data.object);
      return;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(supabase, stripeClient, event.data.object);
      return;

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(supabase, event.data.object);
      return;

    case 'invoice.payment_failed':
      console.warn('Pago fallido:', event.data.object.id);
      return;

    default:
      console.info(`Tipo de evento no manejado: ${event.type}`);
  }
}

// Entrada HTTP del webhook: verifica firma, aplica idempotencia y procesa evento.
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('CRITICAL: STRIPE_WEBHOOK_SECRET is not configured on the server.');
    return NextResponse.json({ error: 'Webhook configuration error' }, { status: 500 });
  }

  const body = await request.text();
  const signature = (await headers()).get('stripe-signature');

  if (!signature) {
    console.error('Verificacion de firma webhook fallida: stripe-signature header missing');
    return NextResponse.json({ error: 'Firma invalida' }, { status: 400 });
  }

  const stripeClient = getStripeClient();
  let event: Stripe.Event;

  try {
    event = stripeClient.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error: unknown) {
    console.error('Verificacion de firma webhook fallida:', getErrorMessage(error));
    return NextResponse.json({ error: 'Firma invalida' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const alreadyProcessed = await hasProcessedWebhookEvent(supabase, event.id);

    if (alreadyProcessed) {
      console.info('[webhook] Evento ya procesado, saltando:', event.id);
      return NextResponse.json({ received: true, idempotent: true });
    }

    await processStripeEvent(supabase, stripeClient, event);
    await recordProcessedWebhookEvent(supabase, event);

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const statusCode = error instanceof WebhookProcessingError ? error.statusCode : 500;
    console.error('Error procesando webhook:', getErrorMessage(error));
    return NextResponse.json({ error: 'Internal Server Error' }, { status: statusCode });
  }
}
