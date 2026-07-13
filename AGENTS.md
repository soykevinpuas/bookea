# Guia Rapida para Agentes - Bookea

Lee esto antes de tocar codigo.

## Primero

1. Revisa `git status --short`.
2. Lee `README.md`, `rules.md` y el archivo especifico que vas a cambiar.
3. Si tocas DB, stock, roles, RLS, auth o Realtime, lee `docs/DATABASE.md`, revisa migraciones recientes y corre `supabase migration list` para confirmar que local y remoto no esten desincronizados.
4. Si tocas pagos, lee `app/api/stripe/webhook/route.ts`, `app/api/stripe/checkout/route.ts` y `lib/actions/subscriptions.ts`.
5. Si tocas lector/offline, lee `app/(app)/reader/[id]/page.tsx`, `lib/reading.ts`, `lib/highlights.ts`, `lib/bookmarks.ts`, `lib/downloads.ts` y `public/sw.js`.

## Reglas de Seguridad

- No concedas accesos digitales desde cliente directo.
- No insertes ordenes fisicas desde cliente directo.
- No bajes privilegios de `admin` o `vendedor` a `subscriber` en flujos de Stripe.
- No desactives RLS.
- No uses precios enviados desde el cliente.
- No cambies migraciones antiguas para produccion; agrega una nueva.

## Rutas Criticas

- Auth/session: `proxy.ts`, `lib/server.ts`, `lib/auth-provider.tsx`.
- Catalogo/acceso: `lib/books.ts`, `hooks/useBooks.ts`.
- Stripe: `lib/stripe.ts`, `app/api/stripe/*`, `lib/actions/subscriptions.ts`.
- Admin/vendedor: `lib/sellers.ts`, `lib/actions/sellers.ts`, `app/admin/page.tsx`, `app/vendedor/page.tsx`.
- Gamificacion: `types/coins.ts`, `lib/actions/coins.ts`, `components/book/CoinRedemptionModal.tsx`.
- Offline: `public/sw.js`, `lib/downloads.ts`, `lib/sync.ts`.

## Comentarios

Comenta exports, reglas de negocio y bloques con efectos externos. No comentes cada etiqueta JSX ni cada variable obvia. Si ves comentarios numericos viejos incorrectos, reemplazalos por una explicacion breve y actual.

## Verificacion

Antes de cerrar:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Registra cambios relevantes en `bitacora.md`. Si agregaste deuda o encontraste una advertencia importante, deja nota en `docs/AUDIT_LOG.md`.
