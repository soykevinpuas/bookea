# Arquitectura de Datos - Bookea

Supabase PostgreSQL es la fuente de verdad para usuarios, catalogo, accesos, lectura, pagos, inventario y gamificacion. Las migraciones viven en `supabase/migrations/` y deben tratarse como historial inmutable.

## 1. Tablas Principales

### Usuarios

- `users`: extiende Supabase Auth. Campos clave: `id`, `email`, `role`, `stripe_customer_id`, `subscription_ends_at`, `assigned_admin_id`.
- `profiles`: datos publicos/editables del usuario: nombre, avatar, bio, racha y total de libros.

Roles actuales: `free`, `subscriber`, `admin`, `vendedor`.

### Catalogo y Acceso

- `books`: un registro por libro con metadatos, portada, EPUB, precios digital/fisico/bundle, stock fisico agregado, premium/activo y autor.
- `authors`: catalogo de autores con RLS de lectura publica.
- `user_books`: accesos digitales por usuario/libro. Tipos: `subscription`, `permanent`, `gift`, `coin_redemption`.
- `reading_progress`: CFI, porcentaje, `scroll_top` y ultima lectura.
- `highlights`: subrayados y notas.
- `bookmarks`: marcadores del lector.

### Comunidad y Gamificacion

- `reviews`: calificaciones 1-5 y contenido por libro.
- `comments` y `comment_likes`: comentarios publicos y likes.
- `coins`, `coin_transactions`, `coin_redemptions`: saldos, movimientos y canjes.
- `streak_milestones`: hitos de racha.
- `referrals`: referidos.
- `monthly_limits_tracker`: limites anti-abuso.
- `badges` y `user_badges`: sistema historico de insignias.

### Comercio e Inventario

- `cart_items`: carrito por usuario.
- `orders_physical`: ordenes fisicas confirmadas por Stripe, con `quantity`, `stripe_payment_id` y `stock_decremented_at`.
- `admin_stock`: stock fisico en almacen por admin/libro. Su suma sincroniza `books.stock_physical`.
- `seller_inventory`: stock activo asignado a vendedores. Para vistas operativas de admin, el stock total disponible es `admin_stock + seller_inventory` de sus vendedores.
- `seller_sales`: ventas reportadas por vendedor, con `sale_price`, `paid_at` y `admin_id`.
- `stock_requests`: solicitudes de stock del vendedor.
- `stock_request_items`: items de cada solicitud.
- `webhook_events`: idempotencia de Stripe.
- `discounts` y `wishlist`: tablas existentes para descuentos/lista de deseos, con uso limitado en UI actual.
- `analytics_events`: eventos de analitica.

## 2. RLS y Escrituras Sensibles

Reglas vigentes:

- RLS permanece activo en tablas publicas.
- `user_books` permite SELECT propio/admin; no permite insertar/actualizar/borrar desde cliente.
- `orders_physical` no permite inserts directos de cliente; las ordenes nacen desde Stripe/webhook/RPC.
- Tablas de gamificacion no aceptan escrituras directas para premios/canjes; las RPCs validan limites.
- `admin_stock` se limita al admin propietario.
- Sellers no deben insertar ventas/inventario directo; el flujo pasa por RPC/server actions.

## 3. RPCs Criticas

| RPC | Uso |
| --- | --- |
| `is_admin()` | Evita recursion RLS al validar admins. |
| `is_active_subscriber(user_uuid)` | Valida suscripcion activa y roles privilegiados. |
| `admin_change_user_role(target_user_id, new_role)` | Cambia roles y asigna vendedor al admin caller. |
| `assign_stock`, `assign_stock_batch` | Mueve stock de admin a vendedor. |
| `revert_assign_stock`, `remove_seller_stock` | Regresa o retira stock vendedor. |
| `sell_book` | Registra venta vendedor con bloqueo `FOR UPDATE` y elimina inventario en cero. |
| `create_stock_request` | Crea solicitud e items desde flujo vendedor. |
| `deliver_stock_request`, `cancel_stock_request` | Gestiona solicitudes de stock. |
| `adjust_admin_stock` | Ajusta stock del admin propietario. |
| `decrement_admin_stock` | Descuenta stock fisico en compras Stripe. |
| `fulfill_physical_order_from_stripe` | Crea orden fisica y descuenta stock en una transaccion. |
| `add_coins`, `redeem_coin`, `get_user_coins` | Gamificacion y canjes. |
| `update_streak_and_check_milestones` | Actualiza rachas y monedas por hitos. |
| `track_event` | Inserta analitica desde flujo controlado. |
| `handle_new_user`, `handle_new_user_coins` | Inicializacion post-registro. |

## 4. Migraciones Clave

- `001_initial_schema.sql`: base de usuarios, libros, progreso, comunidad, ordenes y RLS inicial.
- `019_remove_subscription_credits.sql`: elimina el modelo de 5 creditos por ciclo.
- `022_disable_client_orders_insert.sql`: impide ordenes fisicas falsas desde cliente.
- `023_add_scroll_top_and_bookmarks.sql`: agrega scroll y bookmarks.
- `025_seller_system.sql`: introduce vendedor, inventario y solicitudes.
- `043_add_auth_checks_to_all_rpcs.sql`: endurece RPCs `SECURITY DEFINER`.
- `047_audit_fixes_seller_security.sql`: cierra escrituras directas de vendedores.
- `050_multi_admin_tracking.sql`: asigna vendedores/ventas a admins.
- `054_admin_stock.sql`: stock por admin.
- `056_stripe_fixes_idempotency.sql`: `webhook_events` y descuento admin.
- `059_harden_user_books_access.sql`: cierra escrituras directas de `user_books`.
- `060_harden_stock_admin_ownership.sql`: ownership de stock por admin.
- `062_harden_stripe_physical_fulfillment.sql`: fulfillment fisico transaccional.
- `063_remove_zero_seller_inventory_on_sale.sql`: elimina filas de inventario vendedor en cero.
- `064_enable_realtime_stock_catalog.sql`: publica `books` y `admin_stock` en Realtime para refrescar stock en cliente.

## 5. Reglas para Cambios de Schema

1. Crea una migracion nueva; no edites una migracion ya aplicada salvo que la tarea sea preparar un reset local.
2. Incluye RLS, indices y grants en la misma migracion cuando aplique.
3. Si agregas una tabla sensible, decide desde el inicio si el cliente puede escribir o si debe pasar por RPC/server action.
4. Actualiza `types/*`, `docs/DATABASE.md`, `docs/PROJECT_MASTER.md` y `bitacora.md`.
