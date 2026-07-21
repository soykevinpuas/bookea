# Proyecto Bookea - Mapa Maestro

Este documento describe el estado real del codigo al 2026-07-01. Si contradice al codigo, actualiza este documento en la misma tarea.

## 1. Vision

Bookea es una app SaaS de lectura y venta de libros para Mexico. Combina catalogo digital, lector EPUB, compras con Stripe, PWA offline, gamificacion y operacion de inventario fisico con admins y vendedores.

## 2. Superficies de Usuario

| Superficie | Ruta | Estado |
| --- | --- | --- |
| Landing | `app/page.tsx` + `components/LandingHero.tsx` | Implementada con portadas y libro 3D. |
| Auth | `app/(auth)` y `app/auth/*` | Login, registro, reset, update y confirmacion. |
| Catalogo | `app/(app)/catalog/page.tsx` | Grid/lista, filtros, carrito y acceso a detalle. |
| Detalle de libro | `app/(app)/book/[id]/page.tsx` | Compra digital/fisica, reviews, acceso y canjes. |
| Lector | `app/(app)/reader/[id]/page.tsx` | EPUB, temas, progreso, notas, highlights y bookmarks. |
| Dashboard | `app/(app)/dashboard/page.tsx` | Biblioteca, pago post-Stripe y lectura reciente. |
| Perfil | `app/(app)/profile/page.tsx` | Avatar, facturacion, biblioteca, ordenes, progreso, referidos y seguridad. |
| Suscripcion | `app/(app)/subscribe/page.tsx` | Checkout de suscripcion mensual. |
| Admin | `app/admin/*` | Metricas, libros, usuarios, ordenes, stock, vendedores y pagos. |
| Vendedor | `app/vendedor/*` | Stock asignado, ventas, ingresos y solicitudes. |
| Legal | `app/(legal)/*` | Terminos y aviso de privacidad. |

## 3. Backend en App Router

| Ruta | Responsabilidad |
| --- | --- |
| `app/api/stripe/checkout/route.ts` | Crea sesiones de checkout desde precios de DB/env. |
| `app/api/stripe/webhook/route.ts` | Procesa pagos y suscripciones de forma idempotente. |
| `app/api/stripe/portal/route.ts` | Crea portal de facturacion. |
| `app/api/cart/*` | Lee, modifica y paga carrito. |
| `app/api/books/claim-free/route.ts` | Reclama libros gratuitos usando cliente admin. |
| `app/api/books/[id]/quiz/route.ts` | Genera quiz de finalizacion. |
| `app/api/dictionary/route.ts` | Define palabras con Wiktionary/Gemini fallback. |
| `app/api/streak/route.ts` | Actualiza rachas. |
| `app/api/admin/*` | Datos y cambios de rol admin. |
| `app/api/vendedor/*` | Dashboard y libros solicitables para vendedor. |
| `app/api/analytics/track/route.ts` | Registro de eventos. |
| `app/api/account/delete/route.ts` | Eliminacion de cuenta. |

## 4. Modulos de Negocio

| Modulo | Archivo | Notas |
| --- | --- | --- |
| Supabase SSR/admin | `lib/server.ts` | Cliente SSR con cookies y cliente service-role. |
| Supabase cliente | `lib/supabase.ts` | Singleton browser para Auth/Realtime. |
| Cache reactiva | `lib/providers.tsx`, `lib/query-keys.ts`, `lib/realtime-cache.ts`, `components/StockRealtimeSync.tsx` | Las mutaciones propias son optimistas; Realtime aplica filas confirmadas directamente y React Query revalida joins en segundo plano. |
| Catálogo resiliente | `hooks/useBooks.ts`, `lib/books.ts`, `components/ui/AppImage.tsx` | Conserva el último dato útil durante latencia, reutiliza libros para el detalle y protege portadas con fallback local. |
| Libros/acceso | `lib/books.ts` | Catalogo, biblioteca, acceso premium/free/canje. |
| Stripe | `lib/stripe.ts` | Cliente lazy, checkout y portal. |
| Verificacion post-pago | `lib/actions/subscriptions.ts` | Fallback idempotente cuando el webhook aun no corrio. |
| Vendedores | `lib/sellers.ts` y `lib/actions/sellers.ts` | Stock, ventas, solicitudes y pagos pendientes. |
| Rachas/monedas | `lib/streaks.ts`, `lib/actions/coins.ts` | Sesiones de lectura, monedas, canjes y anti-abuso. |
| Offline | `lib/downloads.ts`, `lib/sync.ts` | Cache local y sincronizacion. |
| Highlights/bookmarks | `lib/highlights.ts`, `lib/bookmarks.ts` | Datos online y fallback local. |
| Reviews | `lib/reviews.ts` | Reviews con perfil publico. |
| Perfil | `lib/profiles.ts`, `lib/actions/profile.ts` | Avatar, nombre y resumen consolidado. |

## 5. Datos y Seguridad

La fuente de verdad de base de datos son las migraciones en `supabase/migrations`.

Puntos actuales importantes:

- `users.role` acepta `free`, `subscriber`, `admin`, `vendedor`.
- `users.assigned_admin_id` conecta vendedores con su admin.
- `admin_stock` reparte stock por admin y sincroniza `books.stock_physical`.
- `seller_inventory`, `seller_sales`, `stock_requests`, `stock_request_items` soportan el flujo vendedor.
- `webhook_events` guarda idempotencia de Stripe.
- `orders_physical` incluye `quantity` y `stock_decremented_at`.
- `user_books` quedo endurecida: el cliente solo lee, no concede accesos.

## 6. Pagos

Flujos:

1. Suscripcion: UI llama `/api/stripe/checkout` con `type: "subscription"` y Price ID desde env.
2. Compra individual: checkout lee precio desde `books` y manda metadata a Stripe.
3. Carrito: checkout empaqueta items y shipping en metadata.
4. Webhook: concede acceso digital, crea orden fisica y descuenta stock en RPC transaccional.
5. Dashboard: `verifySubscriptionAction` confirma pago como fallback si el webhook tarda.

Regla critica: el cliente nunca decide el precio final ni concede acceso.

## 7. PWA y Offline

- `app/layout.tsx` declara `manifest: "/manifest.json"`.
- `public/manifest.json` define app standalone.
- `public/sw.js` precachea iconos/home, cachea EPUBs con Cache First y portadas Supabase con Network First.
- El lector y la biblioteca usan caches locales para progreso, metadata, highlights y bookmarks.

## 8. UI y Temas

Temas activos: `light`, `dark`, `retro`, `navy`.

Providers principales:

- `ThemeProvider`
- `QueryProvider`
- `AuthProvider`
- `ReaderColorSync`
- `PwaListener`
- `SplashScreen`
- `BottomNavWrapper`
- `PanelManager`

## 9. Riesgos Tecnicos

- `app/(app)/reader/[id]/page.tsx`, `app/admin/page.tsx` y `app/vendedor/page.tsx` son archivos grandes y sensibles.
- ESLint reporta warnings de `any` y `<img>`, pero no errores.
- No hay pruebas automatizadas instaladas.
- Parte de la documentacion historica anterior mezclaba features futuras con estado implementado; este archivo debe mantenerse como mapa verificado.
