# BOOKEA - Reglas del Proyecto

Estas reglas son para agentes y desarrolladores. Si una tarea toca codigo, documentacion o base de datos, debe quedar coherente con este archivo.

Ultima revision: 2026-07-01.

## 1. Stack Actual

- Next.js 16.1.6 con App Router.
- React 19.2.3 y TypeScript strict.
- Tailwind CSS 4.
- Supabase para Auth, PostgreSQL, Storage y Realtime.
- Stripe para suscripciones, compras digitales/fisicas y portal de facturacion.
- epubjs para el lector.
- Zustand para estado global local.
- TanStack Query para cache/fetching del cliente.
- Resend para emails.
- Three.js/React Three Fiber para elementos 3D.

No cambies stack ni agregues librerias sin justificarlo en la tarea y documentarlo.

## 2. Estructura Real del Repo

```text
app/
  (auth)/                 Login, registro, reset y update password.
  (app)/                  Vistas autenticadas: dashboard, catalogo, libro, reader, perfil, ordenes, suscripcion.
  (legal)/                Terminos y aviso de privacidad.
  admin/                  Panel admin real: dashboard, libros, usuarios, ordenes, vendedores.
  vendedor/               Panel vendedor real: inventario, ventas, ingresos y solicitudes.
  api/                    Rutas backend: Stripe, cart, analytics, streak, admin, vendedor, diccionario.
components/
  avatars/                Motor de avatar.
  book/                   Modales/acciones especificas de libro.
  community/              Reviews y ratings.
  gamification/           Rachas, monedas y quiz.
  profile/                Perfil, avatar y referidos.
  providers/              Providers de transiciones.
  ui/                     Componentes reutilizables.
hooks/                    Hooks de datos y UX.
lib/                      Clientes, acciones servidor y logica de negocio compartida.
stores/                   Stores Zustand.
types/                    Contratos TypeScript compartidos.
supabase/migrations/      Fuente de verdad de schema, RLS y RPCs.
public/                   PWA, iconos, service worker y assets estaticos.
```

Carpetas como `components/admin`, `components/catalog`, `components/reader`, `app/admin/inventory` y `app/admin/marketing` existen como placeholders. No las documentes como implementadas hasta que tengan codigo real.

## 3. Roles y Acceso

Roles validos en `public.users.role`:

- `free`: cuenta gratuita.
- `subscriber`: suscripcion activa si `subscription_ends_at` es nulo o futura.
- `admin`: administra catalogo, usuarios, stock, vendedores y ventas.
- `vendedor`: vende inventario asignado por un admin.

Reglas:

- Las rutas bajo `(app)`, `admin` y `vendedor` se protegen en `proxy.ts`.
- Admin y vendedor tienen acceso digital privilegiado en `hasBookAccess`.
- Los cambios de rol deben pasar por RPC/admin server action, no por cliente directo.

## 4. Base de Datos

- Toda modificacion de DB va en `supabase/migrations/`.
- RLS debe mantenerse activo en tablas publicas.
- Las tablas sensibles no deben aceptar escrituras directas del cliente si existe un flujo server/RPC.
- `public.user_books` solo permite SELECT del usuario/admin; altas y cambios de acceso pasan por server actions, webhooks o RPCs validados.
- `public.orders_physical` se crea desde Stripe/webhook/fallback server, no desde cliente.
- El stock fisico actual se reparte por `admin_stock`; `books.stock_physical` se sincroniza como suma.

## 5. Pagos y Precios

- Moneda: MXN.
- Suscripcion mensual: `STRIPE_SUBSCRIPTION_PRICE_ID`, mostrada como $99 MXN en UI actual.
- Compras digitales/fisicas/bundle toman precio desde `books`.
- Fallbacks defensivos en codigo: digital `29`, fisico `299`, bundle `319`.
- Nunca confies en precio enviado desde cliente; checkout lee precio desde DB.
- El webhook de Stripe debe permanecer idempotente mediante `webhook_events`.

## 6. Lector y Offline

- El lector EPUB vive en `app/(app)/reader/[id]/page.tsx`.
- El progreso se guarda en `reading_progress` y fallback local `bookea-offline-progress`.
- Highlights y bookmarks tienen fallback local.
- EPUBs y portadas se cachean con `public/sw.js`.
- No agregues logs permanentes al lector salvo que sean errores accionables.

## 7. Comentarios de Codigo

Usa comentarios breves y utiles. El objetivo es explicar intencion, reglas de negocio y bordes raros, no narrar sintaxis obvia.

Debe haber comentario o JSDoc en:

- Modulos con logica de negocio.
- Exports publicos: componentes, hooks, server actions, helpers compartidos, tipos complejos.
- Efectos o bloques que dependan de Supabase RLS, Stripe, cache offline, service worker, epubjs o concurrencia.
- Workarounds por Next/Supabase/Stripe/epubjs.

Evita comentarios en:

- JSX evidente.
- `useState` o variables autoexplicativas.
- Estilos Tailwind que ya se leen por si solos.

Si encuentras comentarios numericos viejos o incorrectos, actualizalos o reemplazalos por texto claro. No inventes indices si no aportan.

## 8. Convencion de Commits

Usar prefijos:

```text
feat:
fix:
docs:
refactor:
style:
chore:
test:
```

Los mensajes de commit deben escribirse en espanol.

## 9. Documentacion Obligatoria

Actualiza documentacion cuando cambie:

- Flujo de pagos, acceso, stock, roles o auth.
- Schema, RLS o RPCs.
- Estructura de carpetas.
- Scripts o comandos.
- Comportamiento de PWA/offline.

Archivos relevantes:

- `README.md` para onboarding.
- `AGENTS.md` para instrucciones rapidas de colaboradores.
- `docs/PROJECT_MASTER.md` para arquitectura.
- `docs/DATABASE.md` para Supabase.
- `docs/AUDIT_LOG.md` para auditorias y deuda tecnica.
- `bitacora.md` para historial de cambios.

## 10. Verificacion Antes de Cerrar

Como minimo ejecuta:

```bash
npm run lint
npx tsc --noEmit
```

Si no puedes ejecutar algo, dilo en el resumen final y registra el riesgo.

## 11. Deuda Tecnica Conocida

- ESLint permite warnings de `any` y reglas React Hooks para no bloquear fixes; no lo uses como permiso para agregar deuda nueva.
- Hay muchas pantallas legacy con `<img>` donde Next recomienda `next/image`.
- No hay suite de tests instalada aunque `test.md` define la estrategia.
- Algunas pantallas grandes (`reader`, admin, vendedor) necesitan refactor por modulos, pero no deben partirse sin pruebas o verificacion manual.
