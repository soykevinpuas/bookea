# BOOKEA - Testing Guide

Estado actual: el proyecto no tiene framework de tests instalado ni scripts `test` en `package.json`. Por ahora la verificacion disponible es:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## 1. Prioridad de Pruebas

Cuando se instale la suite, probar primero lo que rompe dinero, acceso o datos:

- Stripe Checkout, webhook y fallback `verifySubscriptionAction`.
- Acceso a libros en `hasBookAccess` y `user_books`.
- Stock fisico, `admin_stock`, `seller_inventory` y ordenes fisicas.
- Roles `free`, `subscriber`, `admin`, `vendedor`.
- RLS/RPCs sensibles de Supabase.
- Lector EPUB: progreso, highlights, bookmarks y offline.

## 2. Stack Recomendado

| Herramienta | Uso |
| --- | --- |
| Vitest | Unit tests de helpers y server actions desacopladas. |
| React Testing Library | Componentes y hooks de UI. |
| Playwright | Flujos reales: auth, checkout, lector, admin/vendedor. |
| Stripe CLI | Webhooks locales. |
| Supabase CLI | Base local y migraciones. |

Scripts sugeridos cuando se instalen:

```json
{
  "test": "vitest",
  "test:watch": "vitest --watch",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

## 3. Casos Criticos

### Acceso Digital

- Libro no premium: usuario autenticado puede acceder o reclamar.
- Libro premium: requiere subscriber activo, admin/vendedor, compra permanente, regalo o canje vigente.
- Canje de moneda vencido no da acceso.
- Cache offline de acceso no debe elevar privilegios.

### Stripe

- Suscripcion activa `subscriber` sin degradar `admin` o `vendedor`.
- Compra digital agrega `user_books` permanente.
- Compra fisica crea `orders_physical` y descuenta stock una sola vez.
- Bundle concede digital y fisico.
- Webhook duplicado no duplica orden ni descuento.

### Inventario

- Admin solo usa su `admin_stock`.
- `assign_stock` descuenta admin y suma vendedor.
- `sell_book` usa bloqueo concurrente y elimina inventario en cero.
- `paid_at` marca pagos pendientes sin borrar ventas.

### Lector

- Guarda/restaura CFI y `scroll_top`.
- Highlights/bookmarks funcionan online y con fallback local.
- Service worker no rompe RSC ni navegacion offline.

## 4. Tarjetas Stripe de Prueba

```text
Pago exitoso:        4242 4242 4242 4242
Pago rechazado:      4000 0000 0000 0002
Requiere 3D Secure:  4000 0025 0000 3155
Fecha: cualquiera futura
CVC: cualquier 3 digitos
CP: cualquier 5 digitos
```
