'use server'

import type { Stripe } from 'stripe'
import { createClient, createAdminClient } from '@/lib/server'
import { getStripeClient } from '@/lib/stripe'
import { revalidatePath } from 'next/cache'
import { addToLibrary } from '@/lib/books'

// Contratos internos para verificar pagos despues del redirect de Stripe.
type SupabaseAdminClient = ReturnType<typeof createAdminClient>
type UserRole = 'free' | 'subscriber' | 'admin' | 'vendedor'
type PurchaseType = 'digital_permanent' | 'physical' | 'bundle' | 'subscription'
type CartItemType = 'digital' | 'physical'

interface CartPurchaseItem {
  bookId: string
  type: CartItemType
  cartItemId: string
  quantity: number
}

interface ShippingInfo {
  name: string
  address: string
  city: string
  state: string
  zip: string
  phone: string
}

interface UserSubscriptionRow {
  role: UserRole
  subscriptionEndsAt: string | null
}

interface SupabaseErrorLike {
  message: string
  details?: string | null
  hint?: string | null
}

type PaymentVerificationResult =
  | { success: true; type: 'subscription' }
  | { success: true; type: 'payment'; items: string[] }
  | { success: false; pending: true }
  | { success: false; error: string }

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PRIVILEGED_ROLES: ReadonlySet<UserRole> = new Set(['admin', 'vendedor'])

// Helpers de parsing defensivo: Stripe metadata llega como strings no confiables.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function readRequiredString(record: Record<string, unknown>, key: string): string {
  const value = readString(record[key])
  if (!value) throw new Error(`Campo requerido ausente o invalido: ${key}`)
  return value
}

function readRequiredUuid(value: unknown, fieldName: string): string {
  const text = readString(value)
  if (!text || !UUID_REGEX.test(text)) {
    throw new Error(`UUID invalido en ${fieldName}`)
  }
  return text
}

function assertNoSupabaseError(error: SupabaseErrorLike | null, operation: string): void {
  if (!error) return
  const details = error.details ? ` Details: ${error.details}` : ''
  const hint = error.hint ? ` Hint: ${error.hint}` : ''
  throw new Error(`${operation}: ${error.message}.${details}${hint}`)
}

function getMetadataValue(metadata: Stripe.Metadata | null | undefined, key: string): string | null {
  return readString(metadata?.[key])
}

function parseJsonMetadata(rawValue: string, fieldName: string): unknown {
  try {
    return JSON.parse(rawValue) as unknown
  } catch {
    throw new Error(`Metadata JSON invalida: ${fieldName}`)
  }
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'free' || value === 'subscriber' || value === 'admin' || value === 'vendedor'
}

function parsePurchaseType(rawValue: string | null): PurchaseType {
  if (!rawValue) return 'digital_permanent'
  if (
    rawValue === 'digital_permanent' ||
    rawValue === 'physical' ||
    rawValue === 'bundle' ||
    rawValue === 'subscription'
  ) {
    return rawValue
  }
  throw new Error(`Tipo de compra invalido: ${rawValue}`)
}

function parseCartItemType(value: unknown, fieldName: string): CartItemType {
  if (value === 'digital' || value === 'physical') return value
  throw new Error(`Tipo de item invalido en ${fieldName}`)
}

function parsePositiveInteger(value: unknown, fieldName: string, defaultValue = 1): number {
  if (value === undefined || value === null || value === '') return defaultValue
  const numberValue = typeof value === 'string' ? Number(value) : value
  if (typeof numberValue !== 'number' || !Number.isInteger(numberValue) || numberValue <= 0) {
    throw new Error(`Cantidad invalida en ${fieldName}`)
  }
  return numberValue
}

function parseCartItems(metadata: Stripe.Metadata | null | undefined): CartPurchaseItem[] {
  const rawItems = getMetadataValue(metadata, 'items')
  if (!rawItems) return []

  const parsedItems = parseJsonMetadata(rawItems, 'items')
  if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
    throw new Error('Metadata items debe ser un arreglo no vacio')
  }

  return parsedItems.map((item, index) => {
    if (!isRecord(item)) throw new Error(`Item de carrito invalido en items[${index}]`)
    return {
      bookId: readRequiredUuid(item.book_id, `items[${index}].book_id`),
      type: parseCartItemType(item.type, `items[${index}].type`),
      cartItemId: readRequiredString(item, 'cart_item_id'),
      quantity: parsePositiveInteger(item.quantity, `items[${index}].quantity`),
    }
  })
}

function parseRequiredShippingInfo(metadata: Stripe.Metadata | null | undefined): ShippingInfo {
  const rawShipping = getMetadataValue(metadata, 'shipping')
  if (!rawShipping) throw new Error('Metadata shipping requerida para orden fisica')

  const parsedShipping = parseJsonMetadata(rawShipping, 'shipping')
  if (!isRecord(parsedShipping)) throw new Error('Metadata shipping debe ser un objeto')

  return {
    name: readRequiredString(parsedShipping, 'name'),
    address: readRequiredString(parsedShipping, 'address'),
    city: readRequiredString(parsedShipping, 'city'),
    state: readRequiredString(parsedShipping, 'state'),
    zip: readRequiredString(parsedShipping, 'zip'),
    phone: readRequiredString(parsedShipping, 'phone'),
  }
}

function readOptionalDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.length === 0) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getLegacyNumericField(value: unknown, key: string): number | null {
  if (!isRecord(value)) return null
  const rawValue = value[key]
  return typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : null
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const legacyPeriodEnd = getLegacyNumericField(subscription, 'current_period_end')
  const itemPeriodEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((periodEnd) => Number.isFinite(periodEnd) && periodEnd > 0)
  const periodEnd = legacyPeriodEnd ?? (itemPeriodEnds.length > 0 ? Math.max(...itemPeriodEnds) : null)
  return periodEnd ? new Date(periodEnd * 1000) : null
}

function getSubscriptionId(subscription: string | Stripe.Subscription | null): string | null {
  if (typeof subscription === 'string') return subscription
  return subscription?.id ?? null
}

function calculateFallbackSubscriptionEnd(existingEnd: Date | null): Date {
  const now = new Date()
  const fallbackEnd = new Date(existingEnd && existingEnd > now ? existingEnd : now)
  fallbackEnd.setDate(fallbackEnd.getDate() + 30)
  return fallbackEnd
}

function normalizeUserSubscriptionRow(value: unknown): UserSubscriptionRow {
  if (!isRecord(value)) throw new Error('Respuesta invalida consultando usuario')
  return {
    role: isUserRole(value.role) ? value.role : 'free',
    subscriptionEndsAt: typeof value.subscription_ends_at === 'string' ? value.subscription_ends_at : null,
  }
}

// Lee rol y fin de suscripcion usando service-role para evitar falsos negativos por RLS.
async function getUserSubscriptionRow(
  supabase: SupabaseAdminClient,
  userId: string
): Promise<UserSubscriptionRow> {
  const { data, error } = await supabase
    .from('users')
    .select('role, subscription_ends_at')
    .eq('id', userId)
    .single()

  assertNoSupabaseError(error, 'Error consultando usuario para verificar pago')
  return normalizeUserSubscriptionRow(data)
}

// Activa o extiende suscripcion sin degradar roles privilegiados.
async function setSubscriptionActive(
  supabase: SupabaseAdminClient,
  userId: string,
  currentUser: UserSubscriptionRow,
  endsAt: Date
): Promise<void> {
  const updatePayload: {
    role?: UserRole
    subscription_ends_at: string
  } = {
    subscription_ends_at: endsAt.toISOString(),
  }

  if (!PRIVILEGED_ROLES.has(currentUser.role)) {
    updatePayload.role = 'subscriber'
  }

  const { error } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', userId)

  assertNoSupabaseError(error, 'Error actualizando suscripcion despues de pago')
}

// Concede acceso permanente a un libro desde un flujo de pago verificado.
async function grantPermanentBookAccess(
  supabase: SupabaseAdminClient,
  userId: string,
  bookId: string
): Promise<void> {
  const result = await addToLibrary(supabase, userId, bookId, 'permanent')
  if (isRecord(result) && typeof result.error === 'string') {
    throw new Error(`Error concediendo acceso permanente: ${result.error}`)
  }
}

// Lee precio fisico/bundle desde DB y usa fallback solo si el campo esta vacio.
async function getPhysicalBookPrice(
  supabase: SupabaseAdminClient,
  bookId: string,
  priceColumn: 'price_physical' | 'price_bundle'
): Promise<number> {
  const { data, error } = await supabase
    .from('books')
    .select('price_physical, price_bundle')
    .eq('id', bookId)
    .single()

  assertNoSupabaseError(error, 'Error consultando precio fisico')

  const priceRow: unknown = data
  if (!isRecord(priceRow)) throw new Error(`Libro no encontrado: ${bookId}`)

  const rawPrice = priceRow[priceColumn]
  if (typeof rawPrice === 'number' && Number.isFinite(rawPrice) && rawPrice >= 0) {
    return rawPrice
  }

  return priceColumn === 'price_bundle' ? 319 : 299
}

// Normaliza la respuesta de la RPC transaccional de orden fisica.
function assertPhysicalOrderFulfilled(value: unknown): void {
  if (!isRecord(value) || value.success !== true) {
    const message = isRecord(value) && typeof value.error === 'string'
      ? value.error
      : 'Respuesta invalida de fulfill_physical_order_from_stripe'
    throw new Error(message)
  }
}

// Crea orden fisica y descuenta stock dentro de Supabase.
async function fulfillPhysicalOrder(
  supabase: SupabaseAdminClient,
  input: {
    userId: string
    bookId: string
    stripePaymentId: string
    quantity: number
    shipping: ShippingInfo
    total: number
  }
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
  })

  assertNoSupabaseError(error, 'Error cumpliendo orden fisica')
  assertPhysicalOrderFulfilled(data)
}

// Limpia items ya pagados para que el carrito no vuelva a cobrarlos.
async function removeProcessedCartItems(
  supabase: SupabaseAdminClient,
  cartItemIds: string[]
): Promise<void> {
  if (cartItemIds.length === 0) return

  const { error } = await supabase
    .from('cart_items')
    .delete()
    .in('id', cartItemIds)

  assertNoSupabaseError(error, 'Error limpiando carrito despues del pago')
}

// Devuelve nombres legibles para mostrar confirmacion al usuario.
async function getItemNames(
  supabase: SupabaseAdminClient,
  items: CartPurchaseItem[]
): Promise<string[]> {
  const bookIds = [...new Set(items.map((item) => item.bookId))]
  const { data, error } = await supabase
    .from('books')
    .select('id, title')
    .in('id', bookIds)

  if (error) {
    console.warn('[verifySubscriptionAction] Error consultando nombres de libros:', error.message)
  }

  const rows: Array<{ id: string; title: string }> = Array.isArray(data)
    ? data
        .filter(isRecord)
        .map((book) => ({
          id: readString(book.id) ?? '',
          title: readString(book.title) ?? 'Libro',
        }))
        .filter((book) => book.id.length > 0)
    : []

  return items.map((item) => {
    const book = rows.find((row) => row.id === item.bookId)
    const label = item.type === 'physical' ? 'Fisico' : 'Digital'
    return book ? `${book.title} (${label})` : `Libro (${label})`
  })
}

// Verifica una sesion de suscripcion y activa el rol si Stripe ya marco pago.
async function handleVerifiedSubscription(
  supabase: SupabaseAdminClient,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  userId: string
): Promise<PaymentVerificationResult> {
  const userData = await getUserSubscriptionRow(supabase, userId)

  if (userData.role === 'subscriber' || PRIVILEGED_ROLES.has(userData.role)) {
    revalidatePath('/')
    revalidatePath('/dashboard')
    return { success: true, type: 'subscription' }
  }

  if (session.payment_status !== 'paid') {
    return { success: false, pending: true }
  }

  const subscriptionId = getSubscriptionId(session.subscription)
  let endsAt = calculateFallbackSubscriptionEnd(readOptionalDate(userData.subscriptionEndsAt))

  if (subscriptionId) {
    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId)
    endsAt = getSubscriptionPeriodEnd(stripeSubscription) ?? endsAt
  }

  await setSubscriptionActive(supabase, userId, userData, endsAt)

  revalidatePath('/')
  revalidatePath('/dashboard')
  return { success: true, type: 'subscription' }
}

// Procesa pago de carrito: digitales conceden acceso, fisicos crean orden.
async function handleVerifiedCartPayment(
  supabase: SupabaseAdminClient,
  session: Stripe.Checkout.Session,
  userId: string,
  items: CartPurchaseItem[]
): Promise<PaymentVerificationResult> {
  const hasPhysicalItem = items.some((item) => item.type === 'physical')
  const shipping = hasPhysicalItem ? parseRequiredShippingInfo(session.metadata) : null

  for (const item of items) {
    if (item.type === 'digital') {
      await grantPermanentBookAccess(supabase, userId, item.bookId)
      continue
    }

    if (!shipping) throw new Error('Shipping requerido para item fisico')

    const price = await getPhysicalBookPrice(supabase, item.bookId, 'price_physical')
    await fulfillPhysicalOrder(supabase, {
      userId,
      bookId: item.bookId,
      stripePaymentId: session.id,
      quantity: item.quantity,
      shipping,
      total: price * item.quantity,
    })
  }

  await removeProcessedCartItems(
    supabase,
    items.map((item) => item.cartItemId)
  )

  const itemNames = await getItemNames(supabase, items)
  revalidatePath('/')
  revalidatePath('/dashboard')
  return { success: true, type: 'payment', items: itemNames }
}

// Procesa checkout legacy de un solo libro.
async function handleVerifiedSingleBookPayment(
  supabase: SupabaseAdminClient,
  session: Stripe.Checkout.Session,
  userId: string,
  bookId: string
): Promise<PaymentVerificationResult> {
  const purchaseType = parsePurchaseType(getMetadataValue(session.metadata, 'purchaseType'))

  if (purchaseType === 'digital_permanent' || purchaseType === 'bundle') {
    await grantPermanentBookAccess(supabase, userId, bookId)
  }

  if (purchaseType === 'physical' || purchaseType === 'bundle') {
    const shipping = parseRequiredShippingInfo(session.metadata)
    const quantity = parsePositiveInteger(getMetadataValue(session.metadata, 'quantity'), 'metadata.quantity')
    const priceColumn = purchaseType === 'bundle' ? 'price_bundle' : 'price_physical'
    const price = await getPhysicalBookPrice(supabase, bookId, priceColumn)

    await fulfillPhysicalOrder(supabase, {
      userId,
      bookId,
      stripePaymentId: session.id,
      quantity,
      shipping,
      total: price * quantity,
    })
  }

  const { data: book, error } = await supabase
    .from('books')
    .select('title')
    .eq('id', bookId)
    .single()

  if (error) {
    console.warn('[verifySubscriptionAction] Error consultando nombre de libro:', error.message)
  }

  const bookTitle = isRecord(book) ? readString(book.title) : null

  revalidatePath('/')
  revalidatePath('/dashboard')
  return { success: true, type: 'payment', items: [bookTitle ?? 'Libro'] }
}

/**
 * Verifica el estado de un pago despues del redirect desde Stripe Checkout.
 * Si el webhook aun no proceso el pago, lo procesa como fallback idempotente.
 */
export async function verifySubscriptionAction(sessionId: string): Promise<PaymentVerificationResult> {
  if (!sessionId) return { success: false, error: 'No session ID provided' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'No autorizado' }

  try {
    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.metadata?.userId !== user.id) {
      return { success: false, error: 'Esta sesion de pago no te pertenece' }
    }

    const userId = user.id
    const adminDb = createAdminClient()

    if (session.mode === 'subscription') {
      return await handleVerifiedSubscription(adminDb, stripe, session, userId)
    }

    if (session.mode === 'payment' && session.payment_status === 'paid') {
      const cartItems = parseCartItems(session.metadata)
      if (cartItems.length > 0) {
        return await handleVerifiedCartPayment(adminDb, session, userId, cartItems)
      }

      const bookId = getMetadataValue(session.metadata, 'bookId')
      if (bookId) {
        return await handleVerifiedSingleBookPayment(
          adminDb,
          session,
          userId,
          readRequiredUuid(bookId, 'metadata.bookId')
        )
      }
    }

    return { success: false, pending: true }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Error verificando pago:', message)
    return { success: false, error: 'Error al verificar el pago' }
  }
}
