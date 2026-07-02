# Bookea

Bookea es una plataforma de lectura digital y venta de libros para Mexico. La app permite explorar un catalogo, leer EPUBs en navegador, guardar progreso, notas, subrayados y marcadores, comprar accesos digitales o fisicos con Stripe, y operar paneles de administracion y vendedores.

## Estado Actual

- App Next.js con App Router, React 19 y TypeScript strict.
- Autenticacion con Supabase Auth y sesiones SSR mediante `@supabase/ssr`.
- Catalogo, detalle de libro, dashboard, lector EPUB, perfil, suscripcion, carrito y ordenes.
- Panel admin para libros, usuarios, inventario, ventas, solicitudes, pagos y vendedores.
- Panel vendedor para inventario asignado, ventas, ingresos y solicitudes de stock.
- Pagos con Stripe Checkout, Billing Portal y webhook idempotente.
- PWA con `manifest.json`, service worker propio y cache offline de EPUBs/portadas.
- Gamificacion con rachas, monedas, canjes, referidos y quiz de finalizacion.
- Base de datos Supabase con RLS, migraciones versionadas y RPCs `SECURITY DEFINER` para flujos sensibles.

## Stack

| Capa | Tecnologia |
| --- | --- |
| Framework | Next.js 16.1.6, App Router |
| UI | React 19.2.3, Tailwind CSS 4, lucide-react, framer-motion |
| Datos | Supabase PostgreSQL, Auth, Realtime/Storage |
| Estado/cache | TanStack Query, Zustand |
| Pagos | Stripe |
| Lector | epubjs |
| 3D/visual | Three.js, React Three Fiber, Drei |
| Email | Resend |

## Arranque Local

```bash
npm install
npm run dev
```

La app arranca normalmente en `http://localhost:3000`.

Variables minimas para desarrollo:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_SUBSCRIPTION_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_SITE_URL=
```

## Comandos

```bash
npm run dev       # servidor local
npm run lint      # ESLint
npx tsc --noEmit  # validacion TypeScript
npm run build     # build de Next.js
```

Nota: hoy no existen scripts de test en `package.json`. La guia de testing esta en `test.md` como deuda tecnica planificada.

## Documentacion Viva

- `AGENTS.md`: guia rapida para cualquier agente o dev que toque el repo.
- `rules.md`: reglas operativas, arquitectura y convenciones que deben respetarse.
- `docs/PROJECT_MASTER.md`: mapa tecnico del sistema actual.
- `docs/DATABASE.md`: entidades, RLS, RPCs y migraciones relevantes.
- `docs/UX_UI.md`: temas, UI y PWA.
- `docs/AUDIT_LOG.md`: auditorias, hallazgos y deuda tecnica.
- `bitacora.md`: historial cronologico de cambios.
- `spec.md`: especificacion de producto alineada al estado actual y roadmap.

## Regla Principal

Si el codigo y un documento se contradicen, verifica el codigo, actualiza el documento y registra el cambio en `bitacora.md`. Las migraciones de Supabase son la fuente de verdad para la base de datos.
