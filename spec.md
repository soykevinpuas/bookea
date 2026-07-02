# BOOKEA - Product Spec Actual

Version de referencia: 2026-07-01.

## 1. Producto

Bookea es una plataforma para leer libros digitales EPUB, comprar accesos digitales permanentes, comprar libros fisicos, gestionar suscripciones premium y operar inventario con admins y vendedores.

Mercado objetivo actual: Mexico. Moneda: MXN.

## 2. Usuarios

| Tipo | Descripcion |
| --- | --- |
| Visitante | Puede ver landing y contenido publico disponible. |
| Free | Usuario autenticado con acceso a libros gratuitos/no premium y compras propias. |
| Subscriber | Usuario con suscripcion activa y acceso premium digital. |
| Admin | Gestiona catalogo, usuarios, stock, ventas, ordenes y vendedores. |
| Vendedor | Vende stock asignado por un admin y solicita mas inventario. |

## 3. Modelo de Ingresos

- Suscripcion mensual premium: Price ID de Stripe en `STRIPE_SUBSCRIPTION_PRICE_ID`; UI actual muestra $99 MXN.
- Compra digital permanente: precio por libro en `books.price_digital`; fallback tecnico `29`.
- Compra fisica: precio por libro en `books.price_physical`; fallback tecnico `299`.
- Bundle fisico + digital: precio en `books.price_bundle`; fallback tecnico `319`.

Regla: la app siempre calcula el precio desde DB/env en backend, nunca desde el payload del cliente.

## 4. Funciones Implementadas

### Catalogo

- Grid/lista de libros.
- Filtros por busqueda, categoria y disponibilidad digital/fisica.
- Carrito para compra digital/fisica.
- Detalle de libro con reviews, compra, acceso y canje.

### Lector EPUB

- Renderizado con `epubjs`.
- Progreso por CFI, porcentaje y scroll.
- Temas `light`, `dark`, `retro`, `navy`.
- Highlights, notas y bookmarks.
- Fallback offline para progreso, highlights, bookmarks y metadata.

### Pagos

- Stripe Checkout para suscripciones y pagos unicos.
- Stripe Billing Portal.
- Webhook idempotente con `webhook_events`.
- Fallback post-redirect en `verifySubscriptionAction`.
- Orden fisica y descuento de stock dentro de RPC transaccional.

### Admin

- Metricas e ingresos.
- Gestion de libros.
- Gestion de usuarios/roles.
- Gestion de stock propio por admin.
- Solicitudes de vendedores.
- Pagos pendientes a vendedores.
- Vista de vendedores y detalle por vendedor.

### Vendedor

- Inventario asignado.
- Registro de ventas.
- Ingresos y pagos pendientes.
- Solicitudes de stock.

### Comunidad y Retencion

- Reviews y ratings.
- Rachas de lectura.
- Monedas por hitos/reviews/referidos.
- Canje de monedas por acceso temporal.
- Referidos.
- Avatar personalizable.

### PWA

- Manifest standalone.
- Service worker propio.
- Cache de EPUBs y assets de lectura.
- Splash screen.

## 5. Base de Datos

Ver `docs/DATABASE.md` para detalle. Entidades principales:

- `users`, `profiles`.
- `books`, `authors`, `user_books`.
- `reading_progress`, `highlights`, `bookmarks`.
- `reviews`, `comments`, `comment_likes`.
- `cart_items`, `orders_physical`.
- `admin_stock`, `seller_inventory`, `seller_sales`, `stock_requests`, `stock_request_items`.
- `coins`, `coin_transactions`, `coin_redemptions`, `streak_milestones`, `referrals`, `monthly_limits_tracker`.
- `webhook_events`, `analytics_events`.

## 6. Seguridad

- RLS activo en tablas publicas.
- `user_books` no acepta escrituras directas del cliente.
- `orders_physical` no acepta inserts directos del cliente.
- RPCs `SECURITY DEFINER` incluyen validaciones de auth/rol y `search_path`.
- Stripe webhook/fallback son idempotentes.
- Admin y vendedor son roles privilegiados y no deben degradarse por pagos.

## 7. Roadmap Pendiente

- Suite de tests automatizados.
- Refactor modular del lector/admin/vendedor.
- Wishlist visible y alertas.
- Descuentos/cupones en UI.
- Regalos entre usuarios.
- Compartir citas como imagen.
- Recomendaciones "tambien te puede gustar".
- Notificaciones push.

## 8. Criterio de Coherencia

Cada cambio funcional debe actualizar:

- `rules.md` si cambia una regla.
- `docs/PROJECT_MASTER.md` si cambia arquitectura/rutas.
- `docs/DATABASE.md` si cambia DB/RLS/RPC.
- `test.md` si cambia estrategia de verificacion.
- `bitacora.md` siempre que sea una correccion, feature o cambio estructural.
