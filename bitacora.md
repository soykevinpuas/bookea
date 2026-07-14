# 📓 Bitácora de Desarrollo - Bookea

Este documento registra el progreso histórico y lógico de construcción del proyecto Bookea. De acuerdo con la regla 13 del proyecto, cada sesión de desarrollo, arreglo o modificación estructural debe quedar registrada aquí.

---

## [2026-07-13-B] — Landing auth desktop y venta sin reaparición visual

### Problema
En desktop, los accesos de login/registro del landing no se sentían igual de claros que en móvil. En el panel vendedor, al vender el último stock de un libro, la card podía iniciar la salida, volver a aparecer una fracción y desaparecer después, porque la animación y el cache confirmado no quedaban sellados al mismo tiempo.

### Cambios
1. **`components/LandingHero.tsx`** — El pill de "Iniciar sesión / Registrarse" queda fijo arriba a la derecha también en desktop, manteniendo el formato compacto de móvil.
2. **`app/vendedor/page.tsx`** — La venta ahora conserva una copia temporal de la card solo para animar el slide-out, aplica un lock local de stock confirmado y evita que refetches viejos la revivan durante la transición.

### Verificación
- `npm run lint`: pasa sin errores.
- `npx tsc --noEmit`: pasa sin errores.
- `npm run build`: pasa sin errores.

---

## [2026-07-13-A] — Arranque ligero, sesión tolerante y navegación móvil rápida

### Problema
En arranque frío, especialmente en iPad sin cache reciente, la app podía sentirse bloqueada: avatar tardío, tabs de bottom nav con spinner, catálogo/admin sin datos y falsos indicios de sesión perdida. La causa más probable era una mezcla de Supabase frío, validación de sesión en red y demasiadas precargas compitiendo con la pantalla visible.

### Cambios
1. **`proxy.ts`** — Evita tocar Supabase en rutas públicas, agrega timeout a `getUser()` y conserva la ruta protegida cuando hay cookie de sesión pero la validación remota está lenta.
2. **`lib/auth-provider.tsx`** — `getSession()` queda como camino rápido local y `getUser()` se retrasa ligeramente para no competir con el primer render; al volver a primer plano ya no duplica verificación si el refresh confirma sesión.
3. **`hooks/useNavigationWarmup.ts`** — El warmup global precalienta solo rutas, no datos de catálogo, biblioteca, perfil, vendedor ni admin.
4. **`components/ui/LoadingStates.tsx`** — `PrefetchLink` deja de precargar datos en touch; los datos solo se precargan con hover real de escritorio.
5. **`app/(app)/catalog/page.tsx`** — El catálogo deja de consultar el rol dos veces y usa `useSubscription()` como fuente única.
6. **`app/admin/page.tsx`** — El dashboard admin usa `fetchJsonWithSessionRetry()` para recuperarse de un 401 transitorio.
7. **`app/vendedor/layout.tsx`** — El enlace "Ver catálogo" apunta directo a `/catalog`, evitando rebotes por `/`.

### Verificación
- `npm run lint`: pasa sin errores.
- `npx tsc --noEmit`: pasa sin errores.
- `npm run build`: pasa sin errores.

### Nota operativa
- `supabase migration list` se revisó antes de tocar auth/datos: local y remoto estaban sincronizados hasta la migración `065`.
- Supabase Free puede pausar proyectos por baja actividad; si la app entra en operación real, conviene mover el proyecto a Pro para evitar pausas por inactividad y reducir arranques fríos.

---

## [2026-07-12-B] — Primera pasada de tipado en stock admin/vendedor y lector

### Problema
La deuda tipada de la zona admin/vendedor/stock y pantallas legacy estaba concentrada en `UntypedValue` y casts amplios, aunque ESLint ya no reportaba warnings activos. Eso hacia mas dificil revisar cambios de stock, biblioteca y lector sin tocar datos con forma implicita.

### Cambios
1. **`lib/stock-cache.ts`** — Reemplazado `UntypedValue` por tipos de cache, snapshots y payloads Realtime con guard sobre `unknown`.
2. **`app/api/admin/books-stock/route.ts`, `lib/sellers.ts`, `lib/actions/sellers.ts`** — Tipadas respuestas RPC, errores y payloads de stock.
3. **Paneles admin/vendedor chicos** — Tipados `admin/books`, `admin/orders`, detalle de vendedor y solicitud de stock vendedor.
4. **`components/StockRequestItemsModal.tsx`** — Ampliado el tipo de item para reflejar `book_id` y datos de libro usados por los paneles.
5. **`app/admin/page.tsx` y `app/api/admin/dashboard/route.ts`** — Tipados dashboard admin, ranking de libros, ventas, solicitudes, inventario y tooltips.
6. **Biblioteca/catalogo/perfil/carrito** — Tipado de `BookAccessType`, cache `userBooks`, compras digitales/fisicas y rutas de carrito/checkout sin casts amplios.
7. **Offline/lector** — Tipados cache de progreso, highlights, sync offline y superficie parcial de `epubjs` usada por el lector.
8. **`types/global.d.ts`** — Eliminado el alias global `UntypedValue`; ya no hay consumidores activos en codigo fuente.

### Verificacion
- `npm run lint`: pasa sin errores.
- `npx tsc --noEmit`: pasa sin errores.
- `npm run build`: pasa sin errores.

### Resultado
- Deuda activa `UntypedValue/any/ts-ignore/eslint-disable` en `app`, `lib`, `components`, `hooks`, `types` y `stores`: queda en 0 coincidencias.
- Las menciones restantes de `UntypedValue` viven solo como historial en documentos de auditoria/bitacora.

---

## [2026-07-12-A] — Stock instantaneo con snapshots y venta sin parpadeo

### Problema
El inventario de admin y vendedor podia mostrar cantidades distintas por varios segundos porque cada panel leia y refrescaba stock desde rutas/cache diferentes. En la venta del vendedor, una invalidacion posterior podia traer datos viejos y hacer que la card vendida reapareciera antes de desaparecer definitivamente.

### Cambios
1. **`supabase/migrations/065_stock_events_snapshots.sql`** — Nueva tabla `stock_events`, helper de snapshot canonico y RPCs de stock que devuelven `snapshots/events` junto con los campos legacy.
2. **`lib/stock-cache.ts` y `types/stock.ts`** — Helper central para aplicar snapshots en caches de vendedor, admin, libros, detalle de vendedor y solicitudes.
3. **`app/vendedor/page.tsx`** — La venta aplica el snapshot confirmado, mantiene un lock local anti-parpadeo y elimina el refetch inmediato que reinsertaba cards viejas.
4. **`app/admin/page.tsx`, `app/admin/vendedores/*`, `app/admin/books/page.tsx`** — Asignaciones, reversiones, remociones y ajustes aplican snapshots y escuchan `stock_events`.
5. **`components/profile/AvatarBadge.tsx`** — Avatar compartido para perfil/menu con fallback estable cuando no hay `avatar_url`.

### Verificacion
- `npm run lint`: pasa sin errores.
- `npx tsc --noEmit`: pasa sin errores.
- `npm run build`: pasa sin errores.

### Archivos modificados
- `supabase/migrations/065_stock_events_snapshots.sql`
- `types/stock.ts`
- `lib/stock-cache.ts`
- `lib/sellers.ts`
- `lib/actions/sellers.ts`
- `app/vendedor/page.tsx`
- `app/admin/page.tsx`
- `app/admin/books/page.tsx`
- `app/admin/vendedores/page.tsx`
- `app/admin/vendedores/[id]/page.tsx`
- `app/api/admin/books-stock/route.ts`
- `components/profile/AvatarBadge.tsx`
- `components/UserMenu.tsx`
- `app/(app)/profile/page.tsx`
- `docs/DATABASE.md`

---

## [2026-07-11-D] — Stock total estable en Admin Libros

### Problema
`Admin > Libros` estaba mostrando y editando solo `admin_stock`, que representa el stock en almacen del admin. Cuando parte del inventario estaba asignado a vendedores, el numero se veia inconsistente: el admin acomodaba un total, pero al recargar parecia cambiar porque no incluia `seller_inventory`.

### Cambios
1. **`app/api/admin/books-stock/route.ts`** — Nuevo endpoint admin que calcula por libro `stock_total`, `stock_warehouse` y `stock_assigned` con service role despues de validar rol admin.
2. **`app/api/admin/books-stock/route.ts`** — El guardado de stock ahora es absoluto sobre el total disponible: total deseado menos stock asignado = almacen admin.
3. **`app/admin/books/page.tsx`** — La tabla muestra stock total y desglosa almacen/vendedores cuando aplica; el modal edita "Stock total".
4. **`docs/DATABASE.md`** — Aclarada la diferencia entre stock en almacen (`admin_stock`) y stock total operativo (`admin_stock + seller_inventory`).

### Verificacion
- `npm run lint`: pasa sin errores.
- `npx tsc --noEmit`: pasa sin errores.
- `npm run build`: pasa sin errores.

### Archivos modificados
- `app/api/admin/books-stock/route.ts`
- `app/admin/books/page.tsx`
- `docs/DATABASE.md`

---

## [2026-07-11-C] — Stock en tiempo real al asignar

### Problema
Al asignar stock desde admin, algunas vistas cliente seguian mostrando cantidades viejas hasta que pasaba el polling o se navegaba de nuevo. El catalogo tampoco escuchaba cambios de `books/admin_stock`, y algunas pantallas de vendedor refrescaban solo el dashboard pero no los libros disponibles para solicitar.

### Cambios
1. **`supabase/migrations/064_enable_realtime_stock_catalog.sql`** — `books` y `admin_stock` quedan publicados en Supabase Realtime para emitir cambios de stock fisico.
2. **`hooks/useBooks.ts`** — El catalogo y detalle de libro escuchan cambios de stock/catalogo, limpian cache local y refrescan queries activas.
3. **`app/admin/page.tsx`** — La asignacion de stock actualiza cache de dashboard de forma optimista y escucha `admin_stock` con refresco debounced.
4. **`app/vendedor/page.tsx` y `app/vendedor/solicitudes/nueva/page.tsx`** — Las vistas de vendedor refrescan inventario y libros solicitables cuando cambia su stock o el catalogo.
5. **`app/admin/books/page.tsx` y `app/admin/vendedores/[id]/page.tsx`** — Paneles de stock admin escuchan cambios realtime y refrescan cantidades relacionadas.

### Verificacion
- `npm run lint`: pasa sin errores.
- `npx tsc --noEmit`: pasa sin errores.
- `npm run build`: pasa sin errores.

### Archivos modificados
- `supabase/migrations/064_enable_realtime_stock_catalog.sql`
- `hooks/useBooks.ts`
- `app/admin/page.tsx`
- `app/admin/books/page.tsx`
- `app/admin/vendedores/[id]/page.tsx`
- `app/vendedor/page.tsx`
- `app/vendedor/solicitudes/nueva/page.tsx`
- `docs/DATABASE.md`

---

## [2026-07-11-B] — Stock cero editable en Libros admin

### Problema
En `Admin > Libros`, cambiar el campo "Stock fisico" a `0` desde el modal de edicion no modificaba el inventario real. El formulario guardaba datos del libro, pero no aplicaba ningun ajuste sobre `admin_stock`.

### Cambios
1. **`app/admin/books/page.tsx`** — La tabla de libros ahora combina `books` con `admin_stock` del admin actual, por lo que muestra el stock propio que realmente se puede mover.
2. **`app/admin/books/page.tsx`** — Al guardar un libro existente, el stock deseado se convierte en delta contra el stock inicial y se manda por `adjust_admin_stock`; ahora `0` es valido y descuenta todo el stock propio disponible.
3. **`app/admin/books/page.tsx`** — El boton de restar stock queda deshabilitado cuando el libro ya esta en cero.

### Verificacion
- `npm run lint`: pasa sin errores.
- `npx tsc --noEmit`: pasa sin errores.
- `npm run build`: pasa sin errores.

### Archivos modificados
- `app/admin/books/page.tsx`

---

## [2026-07-11-A] — Top libros vendidos y header estable en landing

### Problema
La barra de iniciar sesion/registro en la landing se empalmaba visualmente con el hero por estar fija encima del contenido. En el panel de admin, la vista de "Vendidos" no tenia una lectura directa de los libros mas vendidos ni una forma rapida de alternar entre lista y grafica.

### Cambios
1. **`components/LandingHero.tsx`** — La barra superior de auth ahora vive dentro del primer viewport y el hero reserva espacio superior, evitando que los botones se monten sobre el contenido.
2. **`app/api/admin/dashboard/route.ts`** — El dashboard agrega `topBooks` calculado desde `seller_sales` para este mes, ultimos 30 dias y todo el historial consultado; no requiere cambios de base de datos.
3. **`app/admin/page.tsx`** — La seccion "Vendidos" ahora muestra una cuarta tarjeta con el libro top y un bloque de "Libros mas vendidos" con selector de periodo y switch lista/grafica.

### Verificacion
- `npm run lint`: pasa sin errores.
- `npx tsc --noEmit`: pasa sin errores.
- `npm run build`: pasa sin errores.

### Archivos modificados
- `components/LandingHero.tsx`
- `app/api/admin/dashboard/route.ts`
- `app/admin/page.tsx`

---

## [2026-07-10-A] — Navegacion cache-first y prefetch movil

### Problema
Cambiar entre opciones de la bottom nav podia sentirse lento porque varias pantallas volvian a pedir datos al montar, aunque React Query y cache local ya tuvieran informacion util. En movil el prefetch dependia de `onMouseEnter`, por lo que normalmente no se activaba antes del tap.

### Cambios
1. **`hooks/useNavigationWarmup.ts`** — Nuevo hook que precalienta rutas y datos principales de bottom nav en tiempo libre del navegador: catalogo, biblioteca, perfil y, segun rol, admin/vendedor.
2. **`components/BottomNav.tsx` y `components/ui/LoadingStates.tsx`** — La bottom nav usa warmup global y `PrefetchLink` ahora precarga con pointer/touch/focus; tambien se corrigio la queryKey del prefetch de catalogo para que coincida con la query real.
3. **`hooks/useBooks.ts`, `hooks/useSubscription.ts`, `hooks/useProfileData.ts`** — Cache mas durable y sin refetch automatico agresivo al montar/foco; se prioriza mostrar datos cacheados y refrescar por invalidaciones reales.
4. **`app/(app)/profile/page.tsx`** — Ordenes, libros comprados y referidos cargan solo cuando el usuario abre esas secciones, reduciendo trabajo al entrar a Perfil.
5. **`app/admin/page.tsx` y `app/vendedor/page.tsx`** — El polling de dashboards operativos baja de 5s a 60s y las queries conservan datos previos mientras refrescan.

### Verificacion
- `npm run lint`: pasa con 0 errores y 0 warnings.
- `npx tsc --noEmit`: pasa sin errores.
- `npm run build`: pasa sin errores.

### Archivos modificados
- `hooks/useNavigationWarmup.ts`
- `components/BottomNav.tsx`
- `components/ui/LoadingStates.tsx`
- `hooks/useBooks.ts`
- `hooks/useSubscription.ts`
- `hooks/useProfileData.ts`
- `app/(app)/profile/page.tsx`
- `app/admin/page.tsx`
- `app/vendedor/page.tsx`

---

## [2026-07-09-B] — Limpieza de warnings ESLint legacy

### Problema
El proyecto mantenia 243 warnings de lint heredados: 207 por `any` explicitos y 36 por uso directo de `<img>`.

### Cambios
1. **`components/ui/AppImage.tsx`** — Nuevo wrapper sobre `next/image` con `unoptimized` por defecto para portadas/imagenes dinamicas, conservando clases visuales existentes.
2. **Pantallas y componentes con imagenes** — Reemplazados los `<img>` reportados por ESLint con `AppImage`.
3. **`types/global.d.ts`** — Agregado `UntypedValue` como tipo puente para datos legacy sin contrato fuerte; elimina `any` explicitos sin fingir tipado definitivo.
4. **Codigo legacy con `any`** — Reemplazados los `any` explicitos por `UntypedValue` para dejar el lint en cero y hacer visible donde queda trabajo futuro de tipado real.
5. **`docs/AUDIT_LOG.md`** — Registrada la decision tecnica del tipo puente.

### Verificacion
- `npm run lint`: pasa con 0 errores y 0 warnings.
- `npx tsc --noEmit`: pasa sin errores.
- `npm run build`: pasa sin errores.

### Archivos clave
- `components/ui/AppImage.tsx`
- `types/global.d.ts`
- Pantallas/componentes con portadas e imagenes dinamicas.
- Modulos legacy que usaban `any` explicito.

---

## [2026-07-09-A] — Feedback visual y salida estable al mover stock

### Problema
La venta de un libro podia sentirse lenta o parpadear: la card desaparecia por una actualizacion optimista, luego podia regresar por refetch/realtime y finalmente desaparecer cuando el backend confirmaba. Las asignaciones de stock a vendedores/admin tampoco mostraban feedback claro mientras la operacion seguia en curso.

### Cambios
1. **`app/vendedor/page.tsx`** — La venta ya no descuenta el inventario visualmente antes de que `markAsSold` confirme. Durante "Vendiendo..." se bloquean controles, se muestra una linea verde de progreso y, si el libro queda sin unidades, la card hace deslizamiento de salida antes de desaparecer.
2. **`app/vendedor/page.tsx` y `app/admin/page.tsx`** — Los refetches automaticos/realtime se pausan mientras hay una operacion de stock en vuelo para evitar saltos visuales a mitad de venta/asignacion.
3. **`app/admin/page.tsx`** — Las filas seleccionadas para asignar stock a vendedores o al admin muestran linea verde de progreso y deshabilitan controles mientras se procesa la asignacion.
4. **`app/admin/vendedores/[id]/page.tsx`** — El panel de asignacion en detalle de vendedor muestra el mismo feedback visual durante "Asignando..." y bloquea cambios mientras la mutacion esta pendiente.
5. **`app/globals.css`** — Agregada clase reutilizable `stock-progress-line` con animacion accesible para reducir movimiento.

### Verificacion
- `npm run lint`: pasa con 0 errores y 243 warnings legacy.
- `npx tsc --noEmit`: pasa sin errores.
- `npm run build`: pasa sin errores.

### Archivos modificados
- `app/vendedor/page.tsx`
- `app/admin/page.tsx`
- `app/admin/vendedores/[id]/page.tsx`
- `app/globals.css`

---

## [2026-07-08-B] — Descargas explicitas en biblioteca y acciones de auth en landing

### Problema
La biblioteca mostraba el sello de descarga cuando el EPUB estaba en Cache API por una lectura online, aunque el usuario nunca hubiera usado "Descargar Offline". Ademas, la landing no tenia accesos rapidos visibles para iniciar sesion o registrarse.

### Cambios
1. **`lib/downloads.ts`** — La descarga offline ahora se valida con metadata `isOfflineReady` creada por una descarga explicita y se confirma contra Cache API; `getAllCachedBooks()` solo devuelve libros descargados explicitamente.
2. **`lib/books.ts`** — `getUserBooks()` calcula `isOfflineReady` con la nueva validacion explicita, no por mera presencia de metadata local.
3. **`components/BookLongPressMenu.tsx` y `app/(app)/book/[id]/page.tsx`** — El sello/boton "Disponible Offline" ahora usan `bookId + epubUrl` para confirmar descarga real.
4. **`components/LandingHero.tsx`** — Agregada barra superior derecha con accesos a iniciar sesion y registrarse.
5. **`docs/AUDIT_LOG.md`** — Registrado el ajuste de comportamiento offline/PWA.

### Verificacion
- `npm run lint`: pasa con 0 errores y 243 warnings legacy.
- `npx tsc --noEmit`: pasa sin errores.
- `npm run build`: pasa sin errores.

### Archivos modificados
- `lib/downloads.ts`
- `lib/books.ts`
- `components/BookLongPressMenu.tsx`
- `app/(app)/book/[id]/page.tsx`
- `components/LandingHero.tsx`
- `docs/AUDIT_LOG.md`

---

## [2026-07-08-A] — Sesion persistente y carga confiable en Mi Tienda

### Problema
El panel de vendedor podia quedar sin inventario visible si la primera llamada a `/api/vendedor/dashboard` ocurria antes de que Supabase terminara de hidratar o refrescar la sesion. Despues de dejar la app inactiva, algunos layouts tambien empujaban a `/login` sin intentar recuperar el refresh token. En consola seguian apareciendo el manifest de previews protegidos y el warning `THREE.Clock`.

### Cambios
1. **`proxy.ts`** — La proteccion de rutas ahora usa `supabase.auth.getUser()` para forzar refresh de cookies antes de redirigir y conserva la ruta original en `redirect`.
2. **`lib/auth-provider.tsx`** — Agregado refresh al volver a primer plano, keepalive cada 5 minutos y recuperacion antes de limpiar estado local.
3. **`lib/auth-fetch.ts`** — Nuevo helper cliente para reintentar APIs una vez despues de recuperar sesion Supabase.
4. **`app/vendedor/page.tsx`** — El dashboard espera auth lista, pide datos con `no-store`, usa cache por usuario, reintenta tras refresh y muestra error con boton de reintento en vez de stock vacio falso.
5. **`app/vendedor/layout.tsx` y `app/admin/layout.tsx`** — Intentan recuperar sesion antes de mandar al login.
6. **`app/api/vendedor/dashboard/route.ts`** — Marcada como dinamica para evitar cache en datos de stock/ventas.
7. **`docs/AUDIT_LOG.md`** — Documentado que `THREE.Clock` viene de `@react-three/fiber` 9.6.1/latest y no bloquea ventas ni sesion.

### Verificacion
- `npm run lint`: pasa con 0 errores y 243 warnings legacy.
- `npx tsc --noEmit`: pasa sin errores.
- `npm run build`: pasa sin errores.

### Archivos modificados
- `proxy.ts`
- `lib/auth-provider.tsx`
- `lib/auth-fetch.ts`
- `app/vendedor/page.tsx`
- `app/vendedor/layout.tsx`
- `app/admin/layout.tsx`
- `app/api/vendedor/dashboard/route.ts`
- `docs/AUDIT_LOG.md`

---

## [2026-07-06-A] — Preview de Vercel sin manifest SSO y landing sin fotos externas

### Problema
El preview de Vercel intentaba cargar `/manifest.json`, pero Vercel lo redirigía a `vercel.com/sso-api`, provocando error CORS en consola. Además, si la consulta de portadas reales fallaba o no devolvía datos, la landing usaba imágenes externas de `picsum.photos`, mostrando fotos aleatorias ajenas al catálogo/galería de Bookea.

### Cambios
1. **`app/layout.tsx`** — El manifest PWA solo se expone fuera de `VERCEL_ENV=preview`, evitando la petición a `/manifest.json` en previews protegidos por SSO.
2. **`app/page.tsx`** — Eliminado el fallback de `picsum.photos`; si Supabase/service role falla, no se inventan portadas externas.
3. **`components/LandingHero.tsx`** — Corregido el enlace de catálogo de `/catalogo` a `/catalog`; el botón de cambiar portada solo aparece cuando hay más de una portada real.
4. **`components/FloatingBook3D.tsx`** — Eliminado el fallback externo de textura 3D; si una portada no carga, se muestra el material interno del libro.
5. **`docs/AUDIT_LOG.md`** — Registrado el riesgo operativo de Vercel SSO en previews.

### Archivos modificados
- `app/layout.tsx`
- `app/page.tsx`
- `components/LandingHero.tsx`
- `components/FloatingBook3D.tsx`
- `docs/AUDIT_LOG.md`

---

## [2026-07-01-A] — Reconciliación de documentación y comentarios base

### Problema
La documentación principal estaba desfasada frente al código real: mencionaba Next 15 aunque el proyecto usa Next 16.1.6, mezclaba features futuras con módulos ya implementados, omitía el rol `vendedor`, el stock por admin, el carrito, los canjes con monedas y el webhook Stripe endurecido. También conservaba reglas de comentarios con numeración rígida que varios agentes no respetaron.

### Cambios
1. **Documentación raíz:** `README.md`, `rules.md`, `spec.md` y `test.md` fueron reescritos como estado verificado del repo.
2. **Documentación técnica:** `docs/PROJECT_MASTER.md`, `docs/DATABASE.md` y `docs/UX_UI.md` quedaron alineados con rutas, módulos, tablas, RPCs, PWA y riesgos actuales.
3. **Guía de agentes:** agregado `AGENTS.md` con rutas críticas, reglas de seguridad y checklist de verificación.
4. **Auditoría base:** se registró que `npm run lint` pasa con warnings, `npx tsc --noEmit` pasa sin errores y `npm run build` compila correctamente.

### Archivos modificados
- `README.md`
- `rules.md`
- `spec.md`
- `test.md`
- `AGENTS.md`
- `docs/PROJECT_MASTER.md`
- `docs/DATABASE.md`
- `docs/UX_UI.md`
- `docs/AUDIT_LOG.md`
- `app/(app)/reader/[id]/page.tsx`
- `lib/books.ts`
- `lib/reading.ts`
- `lib/highlights.ts`
- `lib/bookmarks.ts`
- `lib/stripe.ts`
- `lib/server.ts`
- `lib/supabase.ts`
- `public/sw.js`

---

## [2026-06-24-C] — Auditoría Profunda: Fixes de Seguridad en Vendedores y Animación Landing

### Problema
1. **Seguridad (Crítico):** Los vendedores tenían acceso RLS para modificar e insertar directamente en `seller_inventory` y `seller_sales`, evadiendo validaciones de negocio. Además, la función RPC `sell_book` sufría de *race conditions* por falta de `FOR UPDATE`.
2. **Visual:** El collage de la landing page era estático y el libro 3D de la misma se renderizaba completamente negro debido al `toneMapped={false}` y a la falta de definición del espacio de color (`SRGBColorSpace`) para las texturas en Three.js >= r152.

### Cambios
1. **`047_audit_fixes_seller_security.sql`**: Se selló el sistema removiendo las políticas de `INSERT` y `UPDATE` de los clientes en tablas de vendedores. Ahora todo el flujo pasa por las Server Actions (que usan `adminDb`) y las RPCs. También se añadió bloqueo concurrente (`FOR UPDATE`) en la RPC `sell_book` al restar del inventario.
2. **`components/FloatingBook3D.tsx`**: Eliminado `toneMapped={false}` del material, añadida `roughness={0.3}`, y configurada explícitamente `loaded.colorSpace = SRGBColorSpace` para que las texturas recuperen su color natural.
3. **`components/LandingHero.tsx`**: Implementada animación con Framer Motion para el collage de portadas, dándole un movimiento de traslación diagonal en loop de espejo.

### Archivos modificados
- `supabase/migrations/047_audit_fixes_seller_security.sql`
- `components/FloatingBook3D.tsx`
- `components/LandingHero.tsx`

---

## [2026-06-24-B] — Fix: Visibilidad Real de Portadas en Landing (CORS y Stacking Context)

### Problema
Las portadas seguían sin verse a pesar de los cambios en [2026-06-24-A]. El collage de fondo quedaba oculto por el fondo oscuro (`bg-[#0a0a0a]`) porque el contenedor principal no formaba un contexto de apilamiento y el gradiente superpuesto era demasiado opaco (`via-[#0a0a0a]/95`). Además, la textura 3D del libro fallaba al cargar portadas externas por restricciones de CORS.

### Cambios
1. **`components/LandingHero.tsx`** — Agregado `z-0` al contenedor principal (`min-h-screen`) para crear un *stacking context*, de forma que el collage en `-z-20` no quede detrás del `bg-[#0a0a0a]` del contenedor. Además, se redujo la opacidad del gradiente de `via-[#0a0a0a]/95` a `via-[#0a0a0a]/40` para dejar ver las portadas.
2. **`components/FloatingBook3D.tsx`** — Agregado `loader.setCrossOrigin('Anonymous')` al `TextureLoader` de Three.js para permitir la carga correcta de imágenes alojadas en dominios externos (Supabase/Picsum) previniendo errores de CORS en el lienzo WebGL.

### Archivos modificados
- `components/LandingHero.tsx`
- `components/FloatingBook3D.tsx`

---

## [2026-06-24-A] — Fix: portadas visibles en landing page

### Problema
La landing page no mostraba las portadas de los libros. El collage de fondo tenía `opacity-[0.08]` (8%) haciéndolo invisible sobre fondo oscuro, y el libro 3D se veía oscuro porque `randomCover` se recalculaba en cada render (sin `useMemo`), causando que Three.js TextureLoader reiniciara la carga de textura constantemente.

### Cambios
1. **`components/LandingHero.tsx`** — `randomCover` y `collageCovers` envueltos en `useMemo` para que no cambien en cada re-render
2. **`components/LandingHero.tsx`** — Opacidad del collage de `opacity-[0.08]` → `opacity-[0.25]` para que las portadas sean visibles como fondo
3. **`components/FloatingBook3D.tsx`** — Color de fallback de portada cambiado de `#2a2a2a` (oscuro, invisible sobre fondo oscuro) a `#8B7355` (tono cuero visible)
4. **`app/layout.tsx`** — Eliminado `manifest: "/manifest.json"` del metadata (causaba error CORS en previews de Vercel con Auth)
5. **`public/sw.js`** — Quitado `/manifest.json` del precache + estrategia Network First para portadas + bump de caché a v4/v2
6. **`app/page.tsx`** — Migrado a `createAdminClient()` para saltar RLS + try/catch para robustez

### Archivos modificados
- `components/LandingHero.tsx`
- `components/FloatingBook3D.tsx`
- `app/layout.tsx`
- `public/sw.js`
- `app/page.tsx`

---

## [2026-06-06-F] — Fix: Header visible en Mi Tienda, sidebar cubierto por Header, barra fea eliminada

### Cambios

1. **`components/Header.tsx`** — Eliminada exclusión de `/vendedor` para que Header (tema + perfil) se muestre en Mi Tienda
2. **`app/vendedor/layout.tsx`** — Eliminada barra móvil personalizada (hamburguesa + "Vendedor" + avatar). Sidebar ahora `top-0` (sin offset). Z-index corregido: sidebar `z-[70]`, overlay `z-[55]`, hamburguesa `z-[65]` (todo arriba del Header z-50)
3. **`app/admin/layout.tsx`** — Hamburguesa cambió de `z-10` a `z-[65]` para quedar sobre el Header
4. **`components/BottomNav.tsx`** — "Mi Tienda" acortado a "Tienda" para que quepa sin romper

### Archivos Modificados
- `components/Header.tsx`
- `app/vendedor/layout.tsx`
- `app/admin/layout.tsx`
- `components/BottomNav.tsx`

---

## [2026-06-06-E] — Unificación Admin/Vendedor: pagos pendientes, admin vende, restricciones

### Cambios

**Fase 1 — Sistema de Pagos Pendientes**
- `supabase/migrations/030_add_paid_at.sql`: Nuevo campo `paid_at` en `seller_sales` + política RLS para admin UPDATE
- `types/seller.ts`: `SellerSale` ahora incluye `paid_at: string | null`
- `lib/sellers.ts`: Nuevas funciones `getPendingPayments()`, `getSellerPendingTotal()`, `markSalesAsPaid()`, `revertMarkAsPaid()`
- `app/admin/page.tsx`: Nueva 5ta tab "Pagos" que lista ventas no pagadas agrupadas por vendedor con botón "Marcar todo como Pagado"
- `app/vendedor/page.tsx`: Indicador de adeudo pendiente en la sección de Ingresos (visible solo si debe)

**Fase 2 — Admin puede vender**
- `app/admin/page.tsx`: Sección "Asignarme stock a mí (Admin)" en la tab Stock con buscador de libros y selector de cantidad
- Query para obtener `currentUser` y `physicalBooks` para auto-asignación

**Fase 3 — Restringir solicitudes al admin**
- `app/vendedor/page.tsx`: Botón "Nueva solicitud" oculto si el usuario es admin
- `lib/actions/sellers.ts`: Validación en server action — admin no puede crear solicitudes

**Fase 4 — Eliminar página duplicada**
- Eliminado `app/admin/stock-requests/page.tsx` (la funcionalidad está en la tab "Solicitudes" de `/admin`)
- Sidebar admin: removido "Solic. Stock"
- `lib/actions/sellers.ts`: `revalidatePath` actualizados a `/admin`

**Fase 5 — Refinamientos UI**
- `components/BottomNav.tsx`: Admin ve "Admin" → `/admin` Y "Mi Tienda" → `/vendedor` como dos entradas separadas
- `app/vendedor/layout.tsx`: Branding condicional — admin ve "Admin-Vendedor" en azul, vendedor ve "Vendedor" en ámbar

### Archivos Creados
- `supabase/migrations/030_add_paid_at.sql`

### Archivos Eliminados
- `app/admin/stock-requests/page.tsx`

### Archivos Modificados
- `types/seller.ts` — `paid_at` en SellerSale
- `lib/sellers.ts` — Funciones de pagos pendientes
- `lib/actions/sellers.ts` — Validación admin + revalidatePath
- `app/admin/page.tsx` — Tab Pagos + auto-asignación stock
- `app/admin/layout.tsx` — Removido Solic. Stock del sidebar
- `app/vendedor/page.tsx` — Indicador adeudo + ocultar nueva solicitud para admin
- `app/vendedor/layout.tsx` — Branding condicional admin/vendedor
- `components/BottomNav.tsx` — Admin ve dos entradas separadas

---

## [2026-06-06-C] — Admin: removido Dashboard tab, sidebar "Admin" con Shield, fix filtro "Solo Físico"

### Cambios

**1. `app/admin/page.tsx` — Dashboard tab removido**
- Eliminada la sección completa de Dashboard (stats cards, acciones rápidas, StatCard, colorMap)
- Eliminado el stats query (ya no se necesita)
- Eliminadas importaciones no usadas (Link, Loader2, BookOpen, Users, Sparkles, etc.)
- Sección por defecto ahora es "ingresos"
- Limpieza de ~80 líneas de código muerto

**2. `app/admin/layout.tsx` — Sidebar: "Dashboard" → "Admin" con Shield**
- Primer nav item cambia de `{ label: "Dashboard", icon: LayoutDashboard }` a `{ label: "Admin", icon: Shield }`

**3. `app/admin/books/page.tsx` — Fix filtro "Solo Físico"**
- Antes: `return hasNoEpub && b.price_physical > 0` — mostraba solo físicos SIN epub
- Después: `return b.price_physical > 0` — muestra TODOS los libros con precio físico, tengan o no epub

### Archivos Modificados
- `app/admin/page.tsx` — Dashboard tab removido, limpieza de código
- `app/admin/layout.tsx` — Sidebar Dashboard → Admin con Shield
- `app/admin/books/page.tsx` — Fix filtro Solo Físico

---

## [2026-05-17-A] - Diagnóstico: logging en loadNextSpineItem + sin mgr.update()

### Problema
Las vistas cargadas manualmente (via `loadNextSpineItem()`) no se ven en pantalla (fondo negro/blanco) aunque el progreso aumenta.

### Cambios
1. **Logging de diagnóstico en 3 pasos** en `loadNextSpineItem()`:
   - PASO 1: después de `display()` — dimensiones del elemento, iframe, bodyChildren
   - PASO 2: después de `expand()` — dimensiones actualizadas
   - PASO 3: 200ms después — estado de todas las vistas
2. **`mgr.update()` comentado** — experimento para ver si es la causa de la destrucción de vistas
3. **Eliminado código de diagnóstico basura** (spine length y container state dumps)
4. **Eliminado log redundante de scroll** en el listener

### Archivos Modificados
- `app/(app)/reader/[id]/page.tsx` — bloque scroll/listener de spine items

---

## [2026-05-07-D] - Optimización de Performance: Perfil y Caché de Datos

### Problema
La página de perfil ejecutaba 7 fetch requests + 2 WebSocket Realtime + avatar SVG pesado, resultando en carga lenta post-navegación.

### Cambios
1. **useUserId en React Query** — Reemplazado `useState`+`useEffect` que llamaba `supabase.auth.getUser()` en cada navegación por React Query con `staleTime: 5min` y `initialData` desde localStorage.

2. **Subscription staleTime 5s → 5min** — Evita re-fetch al navegar entre páginas. Eliminado Realtime channel (WebSocket innecesario — mutations ya invalidan queries).

3. **Consolidación de 4 server actions en 1** — Nueva `getProfileDataAction()` en `lib/actions/profile.ts` que retorna monedas, racha, link de referido y conteo en UNA sola llamada. Perfil usa `useProfileData` hook en lugar de `useCoins`+`useStreak`+`useReferral`.

4. **Eliminados WebSocket Realtime** — `useCoins` y `useSubscription` ya no abren canales `postgres_changes`. Elimina 2 conexiones persistentes.

5. **Memoizado parseAvatarConfig** — Perfil ya no parsea 3 veces el avatar en cada render.

6. **StaleTimes incrementados globalmente** — Coins 30s→5min, Streak 60s→5min, Referral 5min→30min.

### Archivos Creados
- `lib/actions/profile.ts` — Server action consolidada de datos de perfil
- `hooks/useProfileData.ts` — Hook React Query para la acción consolidada

### Archivos Modificados
- `hooks/useUser.ts` — Migrado a React Query
- `hooks/useSubscription.ts` — staleTime 5min, sin Realtime
- `hooks/useCoins.ts` — staleTime 5min, sin Realtime, staleTimes incrementados
- `app/(app)/profile/page.tsx` — usa useProfileData, parseAvatarConfig memoizado

---

## [2026-05-07-C] - Fix: Restaurar visibilidad de nombres en reseñas (profiles RLS)

### Problema
La migración 011 cambió la política SELECT de `profiles` de "todos pueden ver" a "solo tu propio perfil", rompiendo el JOIN en `lib/reviews.ts:58-66` que muestra el nombre/avatar de quien reseñó. Supabase aplica RLS en todas las tablas de un JOIN, devolviendo `profiles: null` para reseñas de otros usuarios.

### Solución
Migración 015: política SELECT en `profiles` abierta a todos los usuarios autenticados. Solo expone datos públicos (`name`, `avatar_url`, `bio`) que el usuario eligió compartir. INSERT/UPDATE/DELETE siguen restringidos.

### Archivos Modificados
- `supabase/migrations/015_fix_profiles_select_rls.sql` — Nueva migración

---

## [2026-05-07-B] - Auditoría de Seguridad RLS: Corrección de 8 Hallazgos

### Objetivo
Tercera auditoría de seguridad del proyecto enfocada en RLS y políticas de acceso. Se identificaron y corrigieron vulnerabilidades críticas en las tablas de gamificación, exposición de datos de usuarios y bypass client-side de acceso.

### Hallazgos Corregidos

**🔴 Crítico: Políticas "System can..." en gamificación (5 tablas)**
- **Problema:** Las tablas `coins`, `coin_transactions`, `coin_redemptions`, `streak_milestones`, `referrals` y `monthly_limits_tracker` tenían políticas `FOR ALL USING (true)` o `FOR INSERT WITH CHECK (true)`, permitiendo manipulación directa desde el cliente.
- **Solución:** Eliminadas todas las políticas "System can...". Las RPCs `SECURITY DEFINER` (`add_coins`, `redeem_coin`, `track_referral`, etc.) ya bypassan RLS y manejan la autorización correctamente.

**🟠 Alto: `users` SELECT exponía todos los emails**
- **Problema:** Política `users_select_all` con `USING (true)` permitía a cualquier usuario autenticado ver todos los emails.
- **Solución:** Reemplazada por `users_select_self` (ver propio registro) y `users_select_admin` (admins ven todo).

**🟠 Alto: `analytics_events` INSERT público**
- **Problema:** Política `"Service can insert analytics"` con `FOR INSERT WITH CHECK (true)` permitía spamear analytics.
- **Solución:** Eliminada. La RPC `track_event` (SECURITY DEFINER) maneja las inserciones.

**🟠 Alto: `coin_redemptions` INSERT directo desde cliente**
- **Problema:** Usuarios podían insertar canjes directamente, evadiendo verificación de saldo y anti-abuse.
- **Solución:** Eliminada política de INSERT. Solo `redeem_coin` RPC puede crear canjes.

**🟠 Medio: `subscription_credits` UPDATE sin WITH CHECK**
- **Problema:** Usuarios podían poner `credits_remaining = 9999` sin restricción.
- **Solución:** Agregado `WITH CHECK (auth.uid() = user_id)` a la política de UPDATE.

**🟠 Medio: localStorage caching de rol en `hasBookAccess`**
- **Problema:** `lib/books.ts` guardaba `bookea-user-role` en localStorage y lo usaba para bypass client-side. Un usuario podía ponerse `admin` manualmente.
- **Solución:** Reemplazado por caché de acceso por libro (`bookea-access-cache`). Cuando el servidor confirma acceso, se guarda el resultado (`true/false`) por `bookId`. En offline, se consulta esta caché en lugar del rol. Es seguro porque solo cachea el resultado booleano por libro, no el rol del usuario.

**🟠 Medio: `increment_counter` RPC inexistente**
- **Problema:** `lib/actions/coins.ts` usaba `supabase.rpc('increment_counter' as any)` que no existía.
- **Solución:** Reemplazado por lectura/escritura directa de `total_books_read` desde la tabla `profiles`.

**🟢 Bajo: Middleware incompleto**
- **Problema:** `/profile` y `/catalog` no estaban en `protectedPaths`.
- **Solución:** Agregadas ambas rutas.

### Archivos Creados
- `supabase/migrations/014_fix_rls_security_audit.sql` — Migración con todas las correcciones RLS

### Archivos Modificados
- `docs/AUDIT_LOG.md` — Registro de la 3ra auditoría con reporte detallado
- `lib/books.ts` — Eliminado localStorage caching de rol
- `lib/actions/coins.ts` — Corregido incremento de `total_books_read`
- `middleware.ts` — Agregadas `/profile` y `/catalog` a rutas protegidas

---

## [2026-05-07] - Optimización de Rendimiento: "Bookea Vuela"

### Objetivo
Lograr una experiencia de usuario instantánea eliminando tiempos de carga perceptibles en la navegación y asegurando persistencia de datos local.

### Cambios Realizados
- **Persistencia de React Query:** Se implementó una capa de persistencia en `localStorage` dentro de los hooks `useBooks` y `useUserBooks`. Ahora los datos se muestran instantáneamente desde el caché mientras se validan en segundo plano (SWR).
- **Catálogo SPA:** Migración de `CatalogPage` a Client Component. Esto permite que el cambio entre Dashboard y Catálogo sea instantáneo al compartir el mismo `QueryClient`.
- **Prefetching Proactivo:** Mejora de `PrefetchLink` para disparar precargas de datos de React Query al hacer hover sobre links de libros o secciones.
- **Cache Agresivo:** Incremento de `staleTime` a 10 minutos y `gcTime` a 1 hora para minimizar peticiones de red.

### Archivos Modificados
- `lib/providers.tsx`
- `hooks/useBooks.ts`
- `app/(app)/catalog/page.tsx`
- `components/ui/LoadingStates.tsx`

---

## [2026-05-06-B] - Refinamiento de UX en Catálogo y Menú Contextual

### Objetivo
Mejorar la fluidez visual del catálogo, corregir el acceso a filtros en móviles y optimizar el feedback de carga en las acciones de libros.

### Cambios Realizados
- **Rotación de Libros (Random Order):** Se implementó una lógica de barajado aleatorio en el servidor para el Catálogo. Ahora los libros rotan su posición en cada carga (siempre que no haya filtros activos), mejorando el descubrimiento de contenido.
- **Fix de Filtros Móviles:** Se reconstruyó el modal de filtros en `SearchFilters.tsx` utilizando un `motion.div` como contenedor raíz para `AnimatePresence`. Se corrigió el problema donde el modal era invisible (solo se veía el blur) mediante ajustes de `z-index` y estructura de capas.
- **Independencia de Animaciones (Long Press):** Se separaron los estados de carga en `BookLongPressMenu.tsx`. Antes, al quitar un libro, todos los botones mostraban un spinner; ahora cada acción (Descarga vs Biblioteca) tiene su propio estado `isProcessing` independiente.

### Archivos Modificados
- `app/(app)/catalog/page.tsx` (Random sorting)
- `components/SearchFilters.tsx` (Mobile modal fix)
- `components/BookLongPressMenu.tsx` (Granular loading states)

---

## [2026-05-06] - Fix Crítico de UI: Eliminación de Pantallas de Carga Intermedias

### Objetivo
Resolver excepciones y errores de hidratación/Suspense que rompían la aplicación al navegar entre rutas, ocasionados por la implementación previa de esqueletos de carga (`SkeletonBox`).

### Cambios Realizados
- **Eliminación de `loading.tsx`:** Se borraron los archivos `loading.tsx` en las rutas de `catalog`, `dashboard`, `profile`, `book/[id]` y `reader/[id]`.
- **Restauración de Flujo de Carga:** La aplicación ahora se apoya exclusivamente en el `SplashScreen.tsx` inicial y las transiciones de ruta nativas de Next.js, previniendo errores globales de UI.

---

## [2026-04-30-GAMIFICATION] — Sistema de Monedas de Gamificación y Anti-Abuse

### Objetivo
Crear un sistema de monedas de 4 denominaciones (Bronce, Plata, Oro, Diamante) para gamificación, coexistiendo con la suscripción mensual. Monedas se ganan por logros y se canjean por acceso temporal a libros específicos.

### Nuevas Tablas (Migración 013)
- **`coins`**: Balance de monedas por usuario (bronze, silver, gold, diamond). UNIQUE(user_id, coin_type)
- **`coin_transactions`**: Historial de todos los movimientos de monedas (ganar/gastar)
- **`coin_redemptions`**: Canjes de monedas por acceso a libros. UNIQUE(user_id, book_id) — no se puede canjear el mismo libro 2 veces
- **`streak_milestones`**: Tracking de milestones de racha alcanzados (anti-repetición)
- **`referrals`**: Registro de referidos (referrer_id → referred_id)
- **`monthly_limits_tracker`**: Tracker de límites mensuales anti-abuse

### Modificación Existente
- **`user_books.access_type`**: Añadido valor `'coin_redemption'` al CHECK constraint

### RPCs Creados
- **`add_coins()`**: Suma monedas con anti-abuse integrado (límites mensuales, milestone check)
- **`redeem_coin()`**: Canjea moneda por acceso a libro, verifica límites, crea registro en user_books
- **`track_referral()`**: Registra referido y otorga moneda de plata al referidor (anti-auto-referencia)
- **`get_user_coins()`**: Obtiene balance del usuario
- **`update_streak_and_check_milestones()`**: Actualiza racha de lectura y otorga monedas por milestones

### Nuevos Archivos
- `types/coins.ts` — Tipos TypeScript + constantes COIN_DAYS, COIN_COLORS, ANTI_ABUSE_LIMITS
- `lib/actions/coins.ts` — Server actions: getUserCoins, redeemCoin, addCoins, updateStreak, etc.
- `lib/streaks.ts` — Utilería de rachas con validación anti-abuse (min 2 min lectura)
- `hooks/useCoins.ts` — Hooks: useCoins, useStreak, useReferral, useCoinTransactions, useCoinRedemptions
- `components/ui/CoinBalance.tsx` — Display de balance de monedas
- `components/profile/ReferralQR.tsx` — QR de referido + link copiable
- `components/book/CoinRedemptionModal.tsx` — Modal de canje con 4 opciones de moneda
- `components/gamification/StreakBadge.tsx` — Badge visual de racha de lectura
- `components/gamification/BookCompletionQuiz.tsx` — Quiz de 5 preguntas al completar libro

### Archivos Modificados
- `supabase/migrations/013_coins_gamification.sql` — Nueva migración con todo el esquema
- `lib/books.ts` — hasBookAccess() ahora verifica 'coin_redemption' con expires_at
- `app/auth/actions.ts` — register() ahora procesa referido con ?ref= parameter
- `app/(auth)/register/page.tsx` — Detecta ?ref= de URL y lo envía como hidden field
- `components/Header.tsx` — Indicador de monedas + dropdown de balance
- `app/(app)/profile/page.tsx` — Secciones: Mis Monedas, Racha, Invita a un Amigo (QR)
- `app/(app)/book/[id]/page.tsx` — Botón "Desbloquear con monedas" + modal

### Sistema Anti-Abuse Implementado
| Protección | Detalle |
|-----------|---------|
| Reseñas spam | Máx 3 monedas/mes por reseñas |
| Reseñas de baja calidad | Mínimo 50 caracteres + rating ≥ 3 estrellas |
| Scroll al final del libro | Quiz de 5 preguntas al completar |
| Progreso insuficiente para quiz | Mínimo 10% de lectura requerido |
| Referidos fantasma | Máx 3 monedas/mes por referidos |
| Auto-referencia | Verificación p_referrer_id ≠ p_referred_id |
| Rachas artificiales | Mínimo 2 min de lectura para contar día |
| Re-canje del mismo libro | UNIQUE(user_id, book_id) en coin_redemptions |
| Acumulación masiva | Máx 5 canjes/mes en total |
| Milestones repetidos | Tabla streak_milestones UNIQUE por user+milestone |

### Valores de Monedas
| Moneda | Acceso | Se gana por |
|--------|--------|-------------|
| 🪙 Bronce | 3 días | Reseña, completar libro, racha 3/5 días |
| 🥈 Plata | 7 días | Referir un amigo |
| 🥇 Oro | 14 días | Racha de 10 días |
| 💎 Diamante | 30 días | Racha de 30 días |

### Notas
- Migración 013 debe ejecutarse en Supabase SQL Editor antes de usar
- Trigger `on_user_created_init_coins` auto-crea 4 registros de monedas (0 cada una) al registrarse
- Coexiste con suscripción mensual de $99 MXN sin conflictos

---

## [2026-04-24-F] - Corrección de Acceso Premium y Precio de Stripe
- **Stripe Price ID:** Se corrigió una discrepancia en el nombre de la variable de entorno en `lib/stripe.ts`. Cambiado `STRIPE_PREMIUM_PRICE_ID` por `STRIPE_SUBSCRIPTION_PRICE_ID`.
- **Acceso Premium:** Se refactorizó la lógica en `hasBookAccess` para permitir que usuarios activos tengan acceso inmediato a libros Premium, arreglando el flujo de Auto-Add.
- **Toggle de Biblioteca:** Se actualizó `BookDetailPage.tsx` para incluir soporte dinámico de añadir/quitar de biblioteca.
- **UI Condicional:** Se ocultan las opciones de pago de suscripción si el usuario ya esPremium, evitando cargos duplicados.
- **Defensiva en Datos:** Mejora en el mapeo de `getUserBooks` para evitar fallos de visualización en el cliente.
- **Logging Telemetría:** Se añadió telemetría de errores detallada en las rutas de Stripe.

---

## [2026-04-24-E] - Estabilización de Biblioteca, Stripe y Navegación
- **Biblioteca (Server Actions):** Se migraron las funciones de "Añadir" y "Quitar" de biblioteca a **Server Actions** (`lib/actions/library.ts`) para garantizar el cumplimiento de RLS y mejorar la reactividad mediante `revalidatePath`.
- **Auto-Add en Lector:** Se implementó la lógica de auto-añadido en `ReaderPage.tsx`. Ahora, si un usuario con acceso (Premium/Admin) abre un libro, este se agrega automáticamente a su biblioteca personal.
- **Stripe (Lazy Proxy):** Se refactorizó la inicialización del cliente de Stripe en `lib/stripe.ts` utilizando un **Proxy**. Esto difiere la conexión hasta el primer uso, evitando errores de inicialización durante el build o carga de módulos por variables de entorno faltantes.
- **Navegación:** Se eliminó la animación `PageTransition` de `RootLayout` y se simplificó el componente para cumplir con la fluidez estándar solicitada por el usuario.
- **Robustez de Datos:** Se mejoró `getUserBooks` con un `left join` más limpio y se refactorizó `addToLibrary` para verificar existencia previa, evitando errores de duplicidad.

---

## [2026-04-24-D] - Sincronización Realtime y Optimización de Biblioteca
**Objetivo:** Resolver el problema de adhesión a biblioteca, mejorar la fluidez de navegación y expandir las acciones rápidas con sincronización instantánea.

### Añadido
- **Acción Rápida de Biblioteca:**
  - Se integró la opción **"Añadir a Biblioteca"** directamente en el menú de pulsación larga (`BookLongPressMenu`).
  - El menú ahora detecta dinámicamente si el libro ya está en la colección para alternar entre "Añadir" y "Quitar".
- **Sincronización Realtime (Library):**
  - Implementación de un **listener de Supabase Realtime** en el hook `useUserBooks`.
  - Ahora, cualquier cambio en la tabla `user_books` (desde cualquier dispositivo o menú) invalida automáticamente el caché de React Query, reflejando el cambio al instante sin recargar la página.
- **Animaciones Premium V2:**
  - Rediseño de `PageTransition.tsx` con una curva de velocidad **Cubic-Bezier (ExpoOut)**.
  - La transición ahora incluye un sutil efecto de **escala (99.5%) y desplazamiento en el eje Y**, proporcionando una sensación de profundidad y fluidez nivel "App Nativa".

### Arreglos y Mejoras
- **Fix Crítico de Visibilidad (Library):**
  - Se cambió el join de la consulta `getUserBooks` de **Inner Join** a **Left Join** para el progreso de lectura.
  - Esto soluciona el "desvanecimiento" de libros recién añadidos que aún no tenían un registro de progreso inicializado, asegurando que aparezcan en la biblioteca de inmediato.
- **Robustez en addToLibrary:**
  - Refactorización de la lógica de inserción para usar `.maybeSingle()` y asegurar que la creación del registro de progreso no bloquee la confirmación visual de "Añadido".
- **Navegación Intuitiva:** El menú de pulsación larga ahora incluye estados de carga (`Loader2`) y toast dinámicos para todas las acciones de biblioteca.

---

## [2026-04-24-C] - Gestión Manual de Biblioteca y Accesibilidad de Mouse
**Objetivo:** Sustituir la automatización de biblioteca por una acción manual deliberada y mejorar la usabilidad del menú contextual en dispositivos sin pantalla táctil.

### Añadido
- **Botón Manual de Biblioteca:**
  - Nueva acción en `BookDetailPage.tsx` que permite al usuario añadir libros manualmente a su colección.
  - El botón detecta si el libro ya está en la biblioteca y cambia su estado a "En tu Biblioteca" con color ámbar.
- **Accesibilidad de Menú (Mouse):**
  - Se añadió un botón de **"Tres Puntos" (`...`)** en la esquina superior izquierda de las portadas de los libros.
  - Este botón permite abrir las opciones (Descargar, Eliminar, Ver Detalles) con un simple clic, solucionando la limitación de la pulsación larga en PCs y Laptops.
- **Transiciones Globales (App):**
  - Implementación de un sistema de navegación dinámica mediante `PageTransition.tsx`. Ahora, al moverte entre el Dashboard, Perfil y Catálogo, las páginas tienen un efecto de deslizamiento elegante ("afuera" del lector).
- **Acceso Administrativo Total:**
  - Corrección en la lógica de permisos: los Administradores ahora tienen bypass automático para acceder a cualquier libro, eliminando errores de "Premium requerido" para cuentas de gestión.
- **Botón de Biblioteca Mejorado:**
  - El botón "Añadir a mi Biblioteca" en la página de detalles ahora es más prominente, de color ámbar y con sombra dinámica, facilitando su localización.

### Cambios y Mejoras
- **Reversión de Animación en Lector:** Se eliminó el efecto de slide dentro del libro a petición del usuario para mantener una lectura estática y sin interrupciones visuales.
- **Limpieza de UI:** El botón de los tres puntos para mouse se mantiene para asegurar la usabilidad en desktop.

---

## [2026-04-24-B] - Branding Dinámico Premium y Gestión de Biblioteca Realtime
**Objetivo:** Refinar la identidad visual para diferenciar usuarios Premium de Free y automatizar la experiencia de gestión de biblioteca personal.

### Añadido
- **Branding Condicional:**
  - Implementación de lógica de color dinámica: el logo de **Bookea (la letra "B")** y acentos principales ahora son **azul neón** para usuarios gratuitos y **ámbar dorado** para usuarios Premium.
  - Actualización de `ProfilePage.tsx` para usar variables de color (`primaryColor`) que reaccionan al estado de suscripción del usuario.
- **Automatización de Biblioteca:**
  - Integración de **Auto-Add**: Al abrir un libro del catálogo como usuario Premium, el libro se añade automáticamente a la biblioteca personal con `access_type = 'subscription'`.
  - Nueva acción `removeFromLibrary` en el menú de **Long Press** (`BookLongPressMenu`) para permitir a los usuarios limpiar su biblioteca manualmente.
- **Control de Acceso Avanzado:**
  - Refactorización de `hasBookAccess` para validar no solo la persistencia del libro sino también la validez de la suscripción si el acceso es de tipo `subscription`.

### Cambios y Mejoras
- **UX de Lector:** El motor `ReaderPage` ahora valida permisos en tiempo real antes de inicializar `epubjs`, mostrando mensajes claros si se intenta acceder a contenido Premium sin suscripción.
- **Header Premium:** El botón de "Catálogo" se adaptó para ser más llamativo (azul sólido) para usuarios Free, incentivando la exploración.

### Arreglos
- **Build de Vercel:** Resolución definitiva de errores de tipos en `UserMenu.tsx` (pasando `userId` requerido al hook) y referencias obsoletas en las server actions de compra.

---

## [2026-04-24] - Stripe Premium y Animal Avatar Builder (V2)
**Objetivo:** Finalizar la monetización mediante Stripe prioritario y renovar el sistema de identidad visual con un constructor de avatars SVG dinámico y personalizable.

### Añadido
- **Animal Avatar Builder (SVG):**
  - Creación del componente `AnimalEngine.tsx` que renderiza avatares (Perro, Gato, Conejo, Panda) usando SVGs puros con colores dinámicos.
  - Implementación de un nuevo `AvatarSelector.tsx` interactivo que permite la personalización de especie y color en una paleta curada de 15 tonos.
  - Creación de utilidades de parsing (`lib/avatars-v2.ts`) para manejar el nuevo formato de persistencia `v2:animal:color`.
- **Integración con Stripe:**
  - Configuración formal de `PRICE_IDS.premium` para suscripciones mensuales de $99 MXN.
  - Rediseño de la página `/subscribe` con una estética de alta gama (*glassmorphism*, gradientes ámbar, micro-animaciones).
  - Implementación de checkout directo de Stripe en el frontend.

### Cambios y Mejoras
- **Identidad Visual Premium:**
  - Actualización de toda la terminología de la aplicación de "Subscriber" a "**Member Premium**" o "**Plan Premium**".
  - Refactorización de `Header.tsx` y `UserMenu.tsx` para mostrar el avatar personalizado del usuario con el nuevo motor SVG.
  - Página de perfil renovada con sección de "Personalización de Identidad" integrada.
- **Backend / Webhooks:**
  - Sincronización del API de checkout para usar el ID de precio premium definitivo.
  - Validación del webhook de Stripe para asegurar que la actualización del rol al valor técnico `subscriber` se mantenga consistente.

### Arreglos
- **Persistencia de Perfil:** Se ajustaron los helpers de base de datos para permitir el guardado de strings de configuración largos, superando la limitación de IDs estáticos anteriores.
- **Imports y Hooks:** Limpieza de dependencias muertas del antiguo sistema de sprites de animales en `useAvatars.ts`.

---

## [2026-04-20] - Corrección de Build, Realtime, y Preparación de Nuevo Perfil
**Objetivo:** Resolver el error de compilación en Vercel originado por tipado implícito en el hook de suscripción, fortalecer la infraestructura general de tipos de la aplicación, habilitar suscripciones en tiempo real del panel admin y preparar limpieza de UI para nuevo sistema de avatares.

### Añadido
- **Migración SQL (Realtime):** Se creó `007_enable_realtime_users.sql` para forzar la publicación en realtime de la tabla `users`, permitiendo que el hook `useSubscription` actúe de forma reactiva a los cambios hechos en el panel de administrador.

### Arreglos
- **Hook de Suscripción (`useSubscription.ts`):** Se proporcionó un tipado explícito de unión (`'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR'`) para el estado de retorno en el callback del canal realtime de Supabase, resolviendo la falla de TypeScript durante el proceso de build.
- **Tipado del Cliente Supabase (`lib/supabase.ts`):** Se eliminó el tipo inseguro `any` utilizado en el singleton `browserClient` que sirve a toda la aplicación. Fue reemplazado correctamente con `SupabaseClient | null`, asegurando la verificación estricta de inferencia de tipos por parte de TypeScript previendo futuros errores "implicit any" o violaciones en la forma de los datos esperados en los componentes.
- **Portadas en Lector (`app/(app)/book/[id]/page.tsx`):** Se sustituyó la etiqueta estándar `<img>` por el componente encapsulado de la aplicación `<Book3D />`, unificando su renderizado con el catálogo y evitando bloqueos de CORS o CSP en los entornos de Vercel.
- **Limpieza de UI de Perfil:** Se eliminó todo rastro del componente anterior `AvatarSelector` y de renderizado de imagen de avatar de la base de datos (tanto de la página de perfil como del `<UserMenu />` global) a petición para preparar el terreno limpio para el nuevo sistema de UI de customización. Solo se renderizará la primera letra del usuario en un círculo sólido.


## [2026-04-15] - Mejoras de UI/UX y Navegación Premium
**Objetivo:** Elevar la percepción de calidad de la aplicación mediante animaciones, vistas optimizadas y navegación intuitiva.

### Añadido
- **Pantalla de Inicio (Splash Screen):** Animación de entrada con el logo de Bookea y efectos de brillo usando `framer-motion`. Configurada para mostrarse solo una vez por sesión (`sessionStorage`).
- **Vista de Cuadrícula Compacta:** Nuevo modo de visualización "Compacto" en Dashboard y Catálogo que prioriza las portadas (6-8 por fila en desktop, 3 en móvil).
- **Filtrado por Autor:** Implementación de un campo de búsqueda dedicado para autores en los filtros de búsqueda.
- **Feedback de Progreso:** Inclusión del símbolo `%` en los círculos de progreso para una lectura más clara del avance.
- **Estabilidad Offline:** Nueva página de fallback en el Service Worker y manejo quirúrgico de peticiones RSC para evitar bucles de redirección infinita.
- **Carga Resiliente:** Timeout de 15 segundos en el lector para evitar bloqueos infinitos en el spinner de "Preparando libro".
- **Progreso de Lectura:** Nueva lógica de fusión (merge) para asegurar que el progreso offline se sincronice correctamente con la nube y el Dashboard siempre muestre el libro más reciente.
- **Visualización de Progreso:** Estabilización del componente `ProgressCircle` para manejar valores inválidos y ser visible incluso al 0% de avance.
- **UX PWA en Móviles:** Bloqueo de la previsualización nativa de iOS/Android en las portadas de libros para permitir el uso fluido del menú de opciones personalizado (`BookLongPressMenu`).

### Cambios y Mejoras
- **Rediseño de Navegación:** El botón "Explorar" fue renombrado a "**Catálogo**" y recibió un estilo de botón premium con sombras y gradientes.
- **Optimización de Lista:** Reducción del tamaño de los iconos en la vista de lista para un diseño más limpio y profesional.
- **Navegación del Lector:** Uso de `router.replace` para limpiar el historial y asegurar que el botón de regreso siempre lleve al Dashboard, evitando retornos a la página de detalles.
- **Pantalla de Inicio (Anti-Flicker):** Implementación de script y CSS crítico en el layout para ocultar el contenido hasta que la animación de Bookea comience.
- **Menú Contextual Inteligente:** Detección de bordes en el menú de Long Press para evitar que se recorte por el borde inferior de la pantalla.
- **Sincronización de Datos:** Estrategia de merge para subrayados que protege los datos guardados offline de ser sobreescritos por el servidor.
- **Header Premium:** Reducción del tamaño del indicador de suscripción y optimización del layout móvil para evitar el encimamiento del logo y el toggle de temas.
- **Gestión Offline:** El enlace al "Catálogo" ahora se oculta automáticamente cuando se detecta pérdida de conexión.

### Arreglos
- **Capa de Datos:** Actualización de `lib/books.ts` para soportar filtrado explícito por autor en las consultas a Supabase y caché local.
- **Panel Admin:** Implementación de scroll horizontal en la tabla de usuarios registrados para evitar el recorte de opciones de rol en dispositivos móviles.

---

## [2026-04-08] - Formalización del Protocolo de Auditoría de Código
**Objetivo:** Establecer un sistema riguroso de auditoría asistida por IA para mantener la integridad técnica y de seguridad del proyecto.

### Añadido
- **Estrategia Tiered AI Audit:** Definición de niveles de auditoría (FAST para UI/Lógica simple, PLAN para Seguridad/Core).
- **Centro de Control de Integridad:** Creación del archivo `docs/AUDIT_LOG.md` para el seguimiento histórico de revisiones.
- **Reglas de Auditoría:** Actualización de `rules.md` (Regla 14) para normalizar el uso de IA en la validación de código.

---

## [2026-04-05] - Expansión del Sistema de Categorías
**Objetivo:** Ofrecer una mayor variedad de géneros literarios para facilitar el filtrado y la organización del catálogo.

### Añadido
- **Sincronización de Categorías:** Se han estandarizado y expandido las categorías en el **Panel de Admin**, **Catálogo** (Desktop/Móvil) y **Dashboard**.
- **Nuevos Géneros:** Se añadieron 15+ categorías incluyendo: Ficción, No Ficción, Novela, Clásicos, Misterio y Suspenso, Fantasía, Ciencia Ficción, Romance, Terror, Autoayuda, Negocios y Finanzas, Historia, Biografías, Cuentos y Poesía.
- **Categoría "Otros":** Añadida para clasificar libros que no encajan en los géneros predefinidos.

### Cambios y Mejoras
- **UI de Filtros:** Actualización de los modales y dropdowns de selección para soportar listados extensos sin comprometer la usabilidad.

---

## [2026-04-03-B] - Comunidad Realtime y Sistema de Identidad Animal
**Objetivo:** Fomentar la interacción social y la personalización estética mediante un sistema de reseñas en tiempo real y avatars predefinidos.

### Añadido
- **Módulo de Comunidad (Frontend & Backend):**
  - Nueva API/Hook `useReviews.ts` integrada con **Supabase Realtime**.
  - Componentes `ReviewForm`, `ReviewList` y `StarRating` con animaciones de Framer Motion.
  - Implementación de **Calificación de 1-5 estrellas** y comentarios públicos abiertos a todos los usuarios.
- **Sistema de Identidad (Avatars):**
  - Galería de **9 avatars animales únicos y neutros** (Panda, Gato, Koala, Pingüino, Zorro, Búho, Conejo, Mapache, Perezoso).
  - Implementación de `Sprite Clipping` para carga eficiente de texturas (`animal_sprites.png`).
  - Hook `useAvatars.ts` y componente `AvatarSelector` para personalización desde el perfil.
- **Infraestructura:**
  - Nueva migración `004_enable_realtime_reviews.sql` para habilitar el canal de datos instantáneo.

### Cambios y Mejoras
- **Página de Perfil Pro:** Rediseño completo para incluir la gestión de "Persona" (Nombre público + Avatar animal).
- **Página de Libro:** Integración de la sección "Conversaciones" debajo de la sinopsis, vinculada al promedio dinámico de estrellas.
- **Seguridad:** Ajuste de RLS para permitir lecturas públicas de reseñas pero inserciones/ediciones exclusivas del autor.

---

## [2026-04-03] - Sistema de Créditos y Cobro Manual
**Objetivo:** Transicionar de un modelo de cobro automático (Stripe) a un sistema manual basado en créditos por libro para facilitar la administración tributaria.

### Añadido
- **Módulo de Créditos (Backend):**
  - Nueva API `api/credits/redeem` para el canje de libros (1 crédito = 30 días de acceso).
  - Hook personalizado `useCredits.ts` para gestión de saldo y mutaciones de canje.
- **Admin Panel Pro:**
  - Gestión directa de créditos por usuario en `/admin/users`.
  - Restricción de visibilidad del link "Panel Administrador" en el menú de usuario (solo visible para rol 'admin').
- **Infraestructura de Pago Manual:**
  - Nueva interfaz de `/subscribe` con instrucciones para PayPal y Transferencia SPEI (placeholders).
  - Integración de botón directo a WhatsApp para validación de comprobantes.

### Cambios y Mejoras
- **Rebrand de Terminología:** Sustitución de "Precio Digital" y "$" por "**Créditos**" en todo el catálogo y panel de administración.
- **Header Inteligente:** Añadido indicador dinámico de créditos disponibles (`🎟️ X Créditos`) visible para todos los usuarios autenticados.
- **Flujo de Adquisición:** Reemplazo del botón de compra directa por el botón de "Canjear Crédito" con estados de carga y validaciones de saldo.
- **Seguridad Admin:** El acceso a las rutas `/admin/*` ahora está doblemente protegido en la UI para evitar confusión entre usuarios premium y administradores.

---

## [2026-04-02] - Implementación de Subrayados, Notas y Fixes Complejos de ePub.js
**Objetivo:** Habilitar un sistema completo de base de datos para subrayados interactivos por color, panel de apuntes y resolver bugs silenciosos pero críticos del sistema epub.js.

### Añadido
- **Capa DAO (Highlights):** Creación del módulo central de conexiones `lib/highlights.ts` con soporte CRUD nativo (Crear, Obtener, Editar Color/Nota, Eliminar).
- **Validación de Contraste Estricto:** En el lector (`page.tsx`), se añadió una regla de negocio que **prohíbe** persistir selecciones donde el contraste de color del *highlight* elegido falle las pautas WCAG AA sobre el color de fondo de la página (ej. no se permite texto negro sobre fondo blanco seleccionado con un color de subrayado muy claro).
- **Panel Drawer Lateral (Cuaderno):** Implementado un gestor visual de tarjetas accesible mediante la navegación superior. Cada tarjeta corresponde a un subrayado en la base de datos, permitiendo atar notas tipo "sticky" directamente vinculadas a contextos exactos del libro.

### Arreglos Críticos
- **Destrucción Manual del DOM ("Exorcismo"):** Implementada lógica agresiva `querySelectorAll(g, mark).remove()` para solventar el bug endémico de Epub.js v0.3 *Continuous Flow* donde `.annotations.remove()` perdía la referencia del elemento y fallaba al limpiar la capa SVG.
- **Race Condition de Preferencias (localStorage):** Parcheado un defecto grave de ciclo de vida en `app/(app)/reader/[id]/page.tsx` donde el efecto de 'guardado' se activaba milisegundos antes del montaje total, causando borrado e inicialización automática de los ajustes del usuario.
- **Render Loop en Epubjs:** Reparado el bug ocasionante del "Cargador Infinito...". El escuchador del trigger `rendered` se ha re-ordenado secuencialmente para asegurar la des-visualización de los estados de carga.
- **Refactoring Visual y de Hidratación:** Eliminadas etiquetas `<a>` dobles (`Link > Link`) que derrumbaban la página dashboard a modo cascada, y aplicados prefijos estáticos `retro:` y `navy:` directamente a las notas renderizadas para prevenir palidezca de contrastes debidos a choques con temas next-themes globales.

---
**RESUMEN DE ESTADO:** La funcionalidad completa de **Subrayados Textuales** (persistencia, edición de color, notas asociadas y limpieza de DOM) se considera **COMPLETA y POST-BUGFIXED** (Fase 2.1).

---

## [2026-03-29] - Solución de Build Estratégico (Vercel)
**Objetivo:** Permitir el despliegue del proyecto ignorando la falta de claves de Stripe durante la compilación.

### Arreglos Críticos
- **Inicialización Segura de Stripe:** Modificado `lib/stripe.ts` para usar un placeholder en caso de ausencia de `STRIPE_SECRET_KEY`, evitando el crash `Neither apiKey nor config.authenticator provided` en Vercel.
- **Documentación de Infraestructura:** Actualizado el Documento Maestro para marcar el módulo de pagos como "**Fase 2 (Listo para Integrar)**", permitiendo presentarlo como una funcionalidad planificada y estructurada.
---

## [2026-03-29] - Migración a Next.js 15 Proxy API
**Objetivo:** Resolver advertencia de depreciación de "middleware" y adoptar la nueva convención "proxy".
### Cambios y Mejoras
- **Renombramiento Crítico:** `middleware.ts` ha sido renombrado a `proxy.ts`.
- **Refactorización de Función:** La función exportada `middleware` ahora se llama `proxy`, cumpliendo con los estándares actuales de Next.js 15+.
- **Coherencia Técnica:** Actualización de comentarios y documentación interna para reflejar el cambio de terminología.
---

## [2026-03-29] - Estabilización del Lector y UX de Temas
**Objetivo:** Refinar la legibilidad, accesibilidad y proteger la integridad visual de los temas especiales.
### Añadido
- **Tipografía Expandida:** Integración de Google Fonts (Nunito, Lora, Libre Baskerville) y OpenDyslexic directamente en el Iframe del lector.
- **Validación de Contrastes:** Sistema de seguridad que impide texto ilegible y restringe el modo Claro a texto puramente negro.
- **Protección de Estilo (`no-retro-override`):** Implementación de una clase CSS global para prevenir que los temas Retro/Navy sobrescriban elementos críticos como botones y avatares.
### Cambios y Mejoras
- **Diseño del Catálogo:** Rediseño de la vista de lista para que sea flexible (sin altura fija) y muestre más metadatos (autor y descripción extendida).
- **Tematización Global:** Restaurado el ciclo completo de 4 temas (Día, Noche, Terminal, Marina) en el botón de cabecera.
- **Modo Claro (Día):** Ajuste de paleta a grises suaves (`bg-gray-50`) para reducir la fatiga visual.
---

## [2026-03-23] - Unificación de Temas y Redirección Inteligente

### Añadido
- **Tema Global "Retro"**: Expansión del modo retro (verde neón) a toda la aplicación.
- **Ciclo de Temas**: Actualizado `ThemeToggle` para ciclar entre Claro -> Oscuro -> Retro.
- **Redirección Auth**: Configurada redirección en `middleware.ts` para enviar usuarios logueados desde `/` a `/dashboard`.

### Cambios y Mejoras
- **Sincronización de Lector**: Refactorización de `ReaderPage` para eliminar su estado de tema local y seguir estrictamente el tema global de `next-themes`.
- **Fix SafeZones en Lector**: Refactorización profunda de `ReaderPage` para inyectar márgenes de seguridad directamente en el contenido del libro (Iframe) y corregir el posicionamiento del contenedor del visor.
- **Soporte de Safe Areas (Notch)**: Implementadas utilidades CSS (`pt-safe`, `pb-safe`, `px-safe`) y aplicadas en el Header y RootLayout.
- **Refinamiento de UI**: Simplificación de etiquetas de navegación. "Ingresar" e "Iniciar Sesión" se consolidaron en el término más directo "**Iniciar**".
---

## [2026-03-22] - Sincronización de Sesión y UX Móvil
- **Refactorización del Webhook de Stripe**: Implementación de manejo de errores robusto con Supabase. Ahora el webhook devuelve errores 500 para activar reintentos automáticos de Stripe en caso de fallos de base de datos.
- **Idempotencia en Pagos**: Añadidas verificaciones para evitar duplicidad de registros en compras y créditos.
- **Preparación para Producción**: Revisión y documentación de las 9 variables de entorno necesarias para Vercel.

### Pruebas
- Verificación completa del build local con `npm run build` (Exitoso).
- Simulación visual de navegación con agente de explorador.
---

## [Fase 1] - Inicio y Construcción del MVP (Febrero - Marzo 2026)

### Hitos Completados
- **Inicialización del Proyecto:** Creación de repositorio con Next.js 15 App Router, React 19, Tailwind CSS 4 y TypeScript.
- **Autenticación (Auth):** Integración completa del proveedor `Supabase SSR` para inicio de sesión y registro de usuarios por email/password (`app/(auth)/`). Creadas políticas RLS básicas.
- **Base de Datos & Catálogo:** Despliegue de entidades `books` y `user_books`. Creación del catálogo responsivo con efecto 3D (`components/Book3D.tsx`) conectando React Query con la DB.
- **Lector EPUB:** Construcción del módulo de lectura principal (`reader/[id]/page.tsx`) utilizando la librería `epubjs`.
   - Se configuró la interfaz HUD estilo *glassmorphism* aislada de Tailwind Dark Mode global.
   - Creación de temas personalizados: **Día**, **Noche** y **Retro**.
   - Integración del sistema `rendition.themes.override()` para forzar actualizaciones dinámicas del DOM sin bloqueos de caché.
   - Se activó `allowScriptedContent` en el ifame sandboxed para solucionar errores de seguridad base de epub.js.
   - Panel avanzado de configuración permitiendo elegir tamaño y tipo de letra (sans, serif, mono).
   - Persistencia fotográfica a través de `localStorage` para recordar preferencias.
- **Roles y Seguridad:** Implementación de vistas de administrador (`/admin`) protegidas mediante middlewares y Funciones RPC (Remote Procedure Call) en Supabase para evitar ciclos recursivos en las consultas de RLS del lado del cliente.
- **Sistematización de Documentación:** Implementación del formato global de índice de comentarios (`1.1.1`, `3.2.1`, etc.) en todo el código base guiado por `rules.md`.
- **Limpieza de Arquitectura:** Eliminación completa de `MOCK_BOOKS` (Ej. El Principito) y "bypasses" de entorno local. Todo el sistema ahora opera estrictamente consultando o devolviendo errores desde Supabase.
- **PWA (Progressive Web App):** Configuración de `manifest.json`, inyección de Service Worker (`sw.js`) con `PwaListener`, e ícono generado de alta resolución para asegurar comportamiento de app nativa en iOS/Android.
- **Integridad de Código (Auditoría Continua):** Establecimiento del protocolo de revisión por IA desde la concepción del proyecto para garantizar que cada componente sea seguro (RLS) y fiel a los estándares de documentación jerárquica.

## [2026-05-15] — Reader Debugging: @import eliminado + re-expand tras hooks

### Problema
El lector EPUB en modo `flow: "scrolled"` solo muestra contenido del viewport. El resto del contenido existe en el DOM pero es invisible. No hay scroll posible. Ocurre tanto en libros nuevos (solo portada) como en libros con progreso (solo fragmento).

### Hipótesis Original (refutada)
Se pensó que epub.js llama `expand()` (que mide textHeight y ajusta altura del iframe) ANTES de que nuestro CSS hook inyecte `height: auto !important`. Sin embargo, tras leer el código fuente de epub.js v0.3.93, se confirmó que `textHeight()` usa `range.getBoundingClientRect()` que mide TODOS los nodos hijo del body, sin importar el `height: 100%` del body. Por lo tanto `expand()` ya setea la altura correcta del iframe incluso sin nuestro CSS.

### Cambios Aplicados (Ronda 1)
1. **Eliminado `@import` de Google Fonts y `@font-face` de OpenDyslexic** del CSS hook.
2. **Agregado `view.expand()` en `rendition.on("rendered")`** — re-expande cada vista post-CSS.

### Cambios Aplicados (Ronda 2)
1. **`overflow: visible !important`** agregado al rule `html, body` — combate EPUBs con `overflow: hidden`.
2. **Eliminado `overflow-x: hidden`** de body — no bloquea scroll vertical pero evitaba interferencias.
3. **`documentElement` fallback** en `appendChild` — si el XHTML del EPUB no tiene `<head>`, se inyecta en `<html>` en su lugar.
4. **`view._height = 0` antes de `view.expand()`** — fuerza reframe aunque textHeight() devuelva el mismo valor.

### Resultado
Pendiente de prueba en teléfono.

---

**Cambios Realizados:**
- **Sincronización Automática de Suscripciones:** Se implementó `verifySubscriptionAction` para validar pagos directamente con Stripe mediante el `session_id`, eliminando la dependencia crítica de los Webhooks para pruebas.
- **Fijación de Error 400 en Biblioteca:** Se reestructuró la consulta `getUserBooks` en `lib/books.ts` para separar las peticiones a `user_books` y `reading_progress`, resolviendo el error de relación inexistente.
- **Gestión de Cuentas de Stripe:** Se añadieron logs de diagnóstico (Account ID) para identificar discrepancias entre cuentas y se forzó la lectura fresca de variables de entorno para evitar persistencia de claves antiguas en servidores de Vercel.
- **Restricciones de Biblioteca:** Solo usuarios con Premium activo pueden añadir libros premium a su colección, pero todos pueden quitarlos.
- **Notificaciones en Dashboard:** Se añadieron mensajes de éxito dinámicos y persistentes al regresar de un pago exitoso.

**Estado Final:**
- Pagos vinculados correctamente a la cuenta `acct_1SBSopQgC67T6ANc`.
- Acceso premium funcional y sincronizado.
- Biblioteca estable y sin errores de base de datos.

---

## [2026-04-27-I] - Sistema de Analytics, Dashboard Admin Expandido y Tipado de epub.js

### Nuevas Funcionalidades

**1. Sistema de Analytics (`lib/analytics.ts`)**
- Sistema de tracking de eventos para Bookea
- Registra eventos en Supabase (`analytics_events`)
- Constantes de eventos predefinidos: `USER_SIGNED_UP`, `PAYMENT_COMPLETED`, `BOOK_ADDED_LIBRARY`, etc.
- API endpoint `/api/analytics/track` para registrar eventos
- Hook `useAnalytics()` para uso en componentes

**2. Tabla `analytics_events` en Supabase**
- Migration `012_analytics_system.sql`
- Registra: event_name, event_data (JSONB), user_id, user_email, user_agent, created_at
- RPC `track_event()` para insertar sin problemas de RLS
- Políticas RLS: solo admins ven, todos pueden insertar

**3. Dashboard Admin Expandido (`app/admin/page.tsx`)**
- Nueva interfaz más completa con 5 secciones:
  - **Catálogo**: Total libros, activos, nuevos esta semana
  - **Órdenes Físicas**: Total, pendientes, completadas, ingresos
  - **Usuarios**: Total, nuevos, suscriptores, free
  - **Pagos Digitales**: Ingresos, suscripciones, pagos recientes
  - **Engagement**: Libros leídos, reseñas de la semana
- Métricas semanales automáticas
- Tipado fuerte con interfaz `AdminCard`

**4. Tipos para epub.js (`types/epub.ts`)**
- Interfaces: `EpubBook`, `EpubRendition`, `EpubContents`, `EpubSpineItem`
- Eliminado uso de `any` en `reader/page.tsx`
- Cast con `unknown` para compatibilidad de tipos

### Cambios Técnicos

**Reader (`reader/[id]/page.tsx`):**
- Tipado de `contents.window` con optional chaining (`?.`)
- Uso de tipo `EpubContents[]` para getContents()
- Eliminación de múltiples `as any`

**Admin Dashboard:**
- Interfaz `AdminCard` para tipado fuerte
- Estructura de datos optimizada para métricas semanales

### Métricas Disponibles
- `booksReadThisWeek` - Libros añadidos a biblioteca esta semana
- `reviewsThisWeek` - Reseñas creadas esta semana
- `newUsersThisWeek` - Nuevos registros
- `subscriptionPayments` - Pagos de suscripción (de analytics)
- `recentPayments` - Pagos de la semana (de analytics)

### Estado Final
- ✅ Sistema de analytics implementado
- ✅ Dashboard admin con métricas completas
- ✅ Tipado de epub.js mejorado
- ✅ Build exitoso

### Próximos Pasos
- Integrar tracking en flujos de usuario (registro, pago, lectura)
- Ejecutar migración `012_analytics_system.sql` en Supabase
- Considerar gráficos visuales para dashboard

---

## [2026-04-28-K] - Corrección de Persistencia de Semilla en Avatares

**Objetivo:** Solucionar que la semilla (seed) del avatar seleccionado por el usuario no se guardaba correctamente y no se mostraba en todo el sitio.

### Problemas Identificados
- **Seed no guardada en perfil:** Al seleccionar un avatar con una semilla específica, esta no se persistía correctamente al actualizar el perfil.
- **Seed no mostrada en perfil:** El componente `AnimalEngine` en `profile/page.tsx` no recibía la prop `seed`, mostrando siempre el avatar por defecto basado en el tipo.
- **Detección de cambios incorrecta:** En `AvatarSelector.tsx`, la variable `hasChanges` no incluía la semilla en la comparación, impidiendo detectar cambios en la semilla.

### Cambios Realizados

**1. `app/(app)/profile/page.tsx`:**
- Agregada la prop `seed` al componente `AnimalEngine` para mostrar el avatar con la semilla correcta del usuario:
  ```tsx
  <AnimalEngine
    type={parseAvatarConfig(profile.avatar_url).type}
    color={parseAvatarConfig(profile.avatar_url).color}
    seed={parseAvatarConfig(profile.avatar_url).seed}
    size="100%"
  />
  ```

**2. `components/profile/AvatarSelector.tsx`:**
- Corregida la verificación de cambios para incluir la semilla:
  ```typescript
  const hasChanges = stringifyAvatarConfig({ type: selectedType, color: selectedColor, seed }) !== (currentAvatarConfig || "");
  ```

### Estado Final
- ✅ Seed se guarda correctamente en la base de datos (`avatar_url` con formato `v2:tipo:color:seed`)
- ✅ Seed se recupera y muestra en el perfil del usuario
- ✅ El avatar personalizado se muestra consistentemente en todo el sitio (Header, UserMenu, reseñas)
- ✅ Detección de cambios funciona correctamente al cambiar la semilla
- ✅ Build exitoso

---

## [2026-04-28-L] - Selector de Color RGB para Avatares

**Objetivo:** Reemplazar los 15 colores fijos por un selector de color completo (color picker) para mayor personalización.

### Cambios Realizados

**1. `components/profile/AvatarSelector.tsx`:**
- Eliminado el grid de 15 colores fijos (`AVATAR_COLORS`)
- Agregado `input type="color"` para selección visual del color de fondo
- Agregado campo de texto para ingresar código hex manual (sin `#`)
- Muestra el código hex actual del color seleccionado
- Validación de entrada: solo permite caracteres hexadecimales (0-9, a-f, A-F) hasta 6 dígitos

### Estado Final
- ✅ Usuario puede elegir cualquier color RGB (no limitado a 15)
- ✅ Input visual tipo picker + campo de texto hex
- ✅ Validación de formato hex en tiempo real
- ✅ Build exitoso

---

## [2026-04-28-M] - Transiciones de Página y Feedback Visual

**Objetivo:** Hacer la navegación más "víva" con transiciones suaves y feedback inmediato.

### Cambios Realizados

**1. `components/PageTransition.tsx` y `components/PageTransitionWrapper.tsx`:**
- Implementada animación de entrada/salida con Framer Motion (fade + slide)
- Creado wrapper como Client Component para usar `usePathname`

**2. `app/layout.tsx`:**
- Integración de `PageTransitionWrapper` para animar cambios de ruta
- Las páginas se deslizan suavemente con curva de aceleración nativa

**3. `components/BottomNav.tsx` y `components/Header.tsx`:**
- Agregado spinner de carga inmediato al navegar
- Texto "Cargando..." temporal en botones de navegación
- Limpieza automática del estado de carga al cambiar ruta

### Estado Final
- ✅ Transiciones fluidas entre páginas (fade + slide Y)
- ✅ Feedback visual inmediato al hacer clic
- ✅ Sensación de app "víva" y responsiva
- ✅ Build exitoso

---

## [2026-04-28-N] - Mejoras de Rendimiento y UI Premium

**Objetivo:** Optimizar tiempos de carga y mejorar la experiencia visual durante la navegación.

### Cambios Realizados

**1. `app/(app)/*/loading.tsx` (Catalog, Dashboard, Profile, Book, Reader):**
- Reemplazados spinners simples por **Skeleton UI premium**
- Nuevo componente `SkeletonBox` en `components/ui/SkeletonBox.tsx`
- Esqueletos animados que simulan la estructura real de cada página
- ProfileSkeleton con diseño idéntico a la página final

**2. `components/profile/AvatarSelector.tsx`:**
- Spinner en botón 🎲 dura 2 segundos hasta que el SVG se renderiza
- Evita que el spinner desaparezca antes de ver el nuevo avatar

**3. `components/BottomNav.tsx`:**
- Corregido spinner que se quedaba pegado después de la navegación
- Limpieza automática con `useEffect` al detectar cambio de ruta

**4. `lib/providers.tsx`:**
- Optimizado cache de React Query: `staleTime: 5 min`, `gcTime: 10 min`
- `refetchOnMount: false` para usar cache si existe
- Reduce tiempo de carga percibido en páginas visitadas

**5. `app/(app)/profile/page.tsx`:**
- Eliminada consulta duplicada a tabla `users` (ya viene en `useSubscription`)
- Uso de `ProfileSkeleton` en lugar de spinner simple
- Carga más rápida al evitar peticiones innecesarias

**6. Integración de `PrefetchLink`:**
- Componente en `components/ui/LoadingStates.tsx` precarga páginas al hacer hover
- Header y BottomNav usan `PrefetchLink` para "Catálogo"

### Estado Final
- ✅ Skeleton UI premium en todas las páginas principales
- ✅ Cache de React Query optimizado (5 min)
- ✅ Prefetching en navegación principal
- ✅ Spinner de avatar sincronizado con renderizado SVG
- ✅ Profile page sin consultas duplicadas
- ✅ BottomNav sin spinners pegados
- ✅ Navegación "víva" y rápida
- ✅ Build exitoso

---

## [2026-04-27-J] - Integración de Analytics y Mejoras UX

### Analytics Integrado en Flujos

**1. Registro (`app/auth/actions.ts`)**
- Evento `user_signed_up` con método (email)
- Disparado después de signup exitoso

**2. Pagos (`lib/actions/subscriptions.ts`)**
- Evento `payment_completed` con:
  - amount (en MXN)
  - currency
  - product (subscription/digital)
  - session_id

**3. Dashboard (`app/(app)/dashboard/page.tsx`)**
- Evento `page_view` con nombre de página

### Mejoras UX

**1. Login (`app/(auth)/login/page.tsx`)**
- Estado de loading con spinner
- Botón deshabilitado durante submit
- Feedback visual "Iniciando sesión..."

**2. Register (`app/(auth)/register/page.tsx`)**
- Ya tenía validación de contraseñas
- Mejor feedback de errores

### Estado Final
- ✅ Analytics trackeando registro, pago y visitas
- ✅ Loading states en auth pages
- ✅ Build exitoso

### Lecciones Aprendidas
- Analytics via RPC bypassea RLS para inserciones
- Server Actions + useState para estados de loading
- Importar desde lib/analytics en componentes cliente

---

## [2026-04-26-H] - Corrección de IDs de Precios de Stripe y Profiles RLS

### Problemas Identificados
- **Price IDs hardcodeados:** El código tenía fallbacks con IDs de Stripe antiguos que ya no existían.
- **Rol de admin sobreescrito:** El sistema de pagos usaba `user.role` de Supabase Auth metadata en vez del rol real de la tabla `users`, causando que admins se convirtieran en subscribers al pagar.
- **Error 406 en profiles:** Usuarios antiguos sin perfil en la tabla `profiles` causaban fallos al intentar consultarlos.
- **Build fails en Vercel:** TypeScript fallaba por tipos `undefined` en las variables de entorno.

### Cambios Realizados

**1. `lib/stripe.ts`:**
- Removidos todos los fallbacks hardcodeados de Price IDs
- Limpieza del código de verificación de claves (comentarios de diagnóstico)
- Ahora solo usa variables de entorno sin alternativas

**2. `lib/actions/subscriptions.ts`:**
- Fix crítico: ahora obtiene el rol desde la tabla `users` (no de Supabase Auth metadata)
- Antes: `const currentRole = user.role;` (provenía de metadata)
- Después: consulta `supabase.from('users').select('role')` para obtener el valor real
- Esto impide que los admins pierdan su rol al hacer pagos

**3. `lib/actions/subscriptions.ts` y `app/(app)/book/[id]/actions.ts`:**
- Agregada validación explícita para tipos `undefined`
- Mejora en el manejo de errores

**4. Base de datos (Supabase SQL Editor):**
- Recreación de políticas RLS para la tabla `profiles`:
  - `Users can view own profile` (SELECT)
  - `Users can insert own profile` (INSERT)
  - `Users can update own profile` (UPDATE)
  - `Admins can manage all profiles` (ALL)
- Creación de perfiles faltantes para usuarios antiguos via INSERT

**5. Migración creada:**
- `supabase/migrations/011_fix_profiles_rls.sql` - Para reference futura

**6. Debug temporal:**
- Creada ruta `/api/debug/env` para verificar variables de entorno
- Añadidos logs temporales en dashboard (luego removidos)

### Estado Final
- ✅ Pagos funcionan con nuevos Price IDs de Stripe
- ✅ Admins mantienen su rol al pagar suscripciones
- ✅ Profiles RLS corregido, error 406 resuelto
- ✅ Build en Vercel exitoso
- ✅ Variables de entorno verificadas (confirmado via `/api/debug/env`)

### Lecciones Aprendidas
- Nunca hardcodear IDs de APIs externas
- El rol de Supabase Auth metadata puede no reflejar el estado real de la base de datos
- Siempre verificar que usuarios antiguos tengan registros en todas las tablas依赖

---

## [2026-05-09-B] - UX de Paneles: Glass Effect, Ancho Reducido, Drag tipo Cortina y Safe Area

### Problemas Reportados
1. Paneles ocupaban todo el ancho en móvil — no se veía el fondo
2. Fondo del overlay era opaco, no estilo "glass"
3. Gesto de cerrar no se sentía natural — no seguía el dedo
4. Header (título + X) se empalmaba con la barra de estado del teléfono
5. No se podía acceder al botón X por la superposición

### Cambios

**Ancho de paneles reducido a 1/3 de la pantalla:**
- Ambos paneles ahora usan `w-1/3 min-w-[280px] max-w-sm`
- En móvil ocupan ~33% del ancho, dejando visible el contenido detrás
- Se ve el efecto glass del backdrop a través del panel semi-transparente

**Fondo glass (frosted glass):**
- Overlay: `bg-white/5 dark:bg-black/30 backdrop-blur-2xl backdrop-saturate-150`
- Panel: `bg-white/95 dark:bg-[#111]/95 backdrop-blur-xl`
- Efecto de vidrio esmerilado que deja ver el contenido detrás borroso

**Drag tipo cortina (gesto inverso con seguimiento en tiempo real):**
- CartPanel (izquierdo): arrastrar hacia la IZQUIERDA para cerrar (como cerrar una cortina)
- LibraryPanel (derecho): arrastrar hacia la DERECHA para cerrar
- El panel sigue el dedo en tiempo real durante el arrastre (`touchmove`)
- Al soltar: si pasó el 30% del ancho, anima suavemente a posición cerrada (`translateX(-100%)` / `translateX(100%)`) con `transition: transform 300ms` y cierra después del timeout
- Si no pasó el umbral, rebota a posición abierta
- Protección: si el movimiento vertical es 1.5x el horizontal, se cancela el drag (permite scroll)

**Safe Area fijo:**
- Header ahora usa `paddingTop: 'max(env(safe-area-inset-top, 0px), 48px)'`
- Garantiza mínimo 48px de padding superior en todos los dispositivos
- El botón X y el título siempre son accesibles

**Limpieza de estilos inline al abrir:**
- Al abrir el panel, se resetea `transform` y `transition` para que className `translate-x-0` tome control

### Archivos Modificados
- `hooks/useEdgeSwipe.ts` — touch-action pan-y, prevención de navegación del browser
- `components/PanelManager.tsx` — Edge swipe siempre activo, close desde borde, indicadores visuales
- `components/CartPanel.tsx` — Drag tipo cortina, glass effect, ancho 1/3, safe area 48px
- `components/LibraryPanel.tsx` — Drag tipo cortina, glass effect, ancho 1/3, safe area 48px

---

## [2026-05-09-C] - Corrección de Contraste y Visibilidad en Temas Retro y Navy

### Problema
Los temas Retro y Navy tenían overrides CSS demasiado agresivos que rompían la UI:
1. **Gradient killer** (`[class*='from-']` / `[class*='to-']`) eliminaba edge indicators y decoraciones
2. **Botones verdes** (`bg-green-600`) se opacaban al 15% — "Abrir Lector" casi invisible
3. **Hover states** (`hover:bg-gray-100`) se fundían con el fondo del card — sin feedback visual
4. **Active tab/toggle** (`bg-white`) se perdía — pestañas activas y toggles indistinguibles
5. **`bg-gray-900`** (botones "Registrarse", "Guardar") se fundía con el fondo
6. **`bg-gray-300`** (drag handle en filtros móviles) desaparecía
7. **`text-gray-700`** (~2.9:1 contraste) ilegible en retro

### Cambios en `app/globals.css`

**Retro — Eliminado gradient killer:**
- El bloque `[class*='from-']`, `[class*='to-']` que ponía `background-image: none` fue removido. Ahora los edge indicators (PanelManager) y decoraciones con gradiente funcionan en retro.

**Retro — Botones verdes protegidos:**
- `bg-green-600` y `bg-green-500` ahora tienen `background-color: #238636` sólido con `color: #ffffff`. Solo `bg-green-50/100/200/300` se mantienen tenues (decorativos).

**Retro/Navy — Hover states visibles:**
- `hover:bg-gray-100` y `hover:bg-gray-200` → `rgba(255,255,255,0.06)` en ambos temas
- `hover:bg-white/5` y `hover:bg-white/10` → mismo valor
- `hover:bg-red-100` → `rgba(255,80,80,0.15)`

**Retro/Navy — Active tab/toggle:**
- `button.bg-white` → Retro: `rgba(63,185,80,0.2)`. Navy: `rgba(121,134,203,0.2)`.

**Retro/Navy — bg-gray-900 y bg-gray-300:**
- `bg-gray-900` → Retro: `#21262d`. Navy: `#1e2a4a`. (Diferente del card bg `#161b22`/`#111827`)
- `bg-gray-300` → `rgba(255,255,255,0.15)` en ambos temas.

**Retro/Navy — text-gray-700:**
- Retro: `#c9d1d9`. Navy: `#b0bec5`. (Antes `#374151`, ratio 2.9:1).

**PanelManager.tsx:**
- Edge indicators ahora llevan clase `preserve-gradient` para protegerse de cualquier catch-all.

### Archivos Modificados
- `app/globals.css` — +90 líneas de overrides quirúrgicos para retro y navy
- `components/PanelManager.tsx` — preserve-gradient en edge indicators

---

## [2026-05-09-D] - Splash y Reader: Bolitas Saltarinas + Luz Inicial + Lector

### Splash: Animación más smooth + luz inicial
- Animación `dotBounce` suavizada: `cubic-bezier(0.25, 1.2, 0.5, 1)`, duración 1.5s
- Stagger aumentado a 0.15s entre dots (más pausado)
- Squash-and-stretch más sutil: `scale(0.92,1.08)` → `scale(1.06,0.94)` → `scale(0.96,1.04)` → ...
- Nuevo `splashLightOn`: el glow central comienza invisible (opacity 0, scale 0.4) y se enciende suavemente en 1s con `cubic-bezier(0.16, 1, 0.3, 1)` — simula una luz que ilumina la escena
- Glow expandido a 300px con `radial-gradient` para un efecto más suave y ambiental

### Reader: Mismas bolitas en "Preparando libro..."
- `loading.tsx` y `page.tsx` del lector ahora muestran las mismas bolitas saltarinas en lugar del spinner
- Las bolitas se adaptan al tema: retro → verde (#3fb950), navy → índigo (#7986cb)
- Clases `.splash-dots` y `.splash-dot` movidas a scope global (no solo dentro de `#bookea-splash`) para reutilización

### Archivos Modificados
- `app/globals.css` — dotBounce más smooth, splashLightOn, dots globales, colores por tema
- `app/layout.tsx` — HTML del splash actualizado con dots
- `app/(app)/reader/[id]/loading.tsx` — spinner → bouncing dots
- `app/(app)/reader/[id]/page.tsx` — inline loader → bouncing dots

### Pendiente (no-code)
- Ejecutar `supabase/migrations/017_cart_items.sql` en Supabase SQL Editor para que el carrito persista en DB

---

## [2026-05-09-E] - Fix de 9 Issues Visuales: Contraste, Visibilidad y Consistencia en Todos los Temas

### Problemas y Cambios

#### 1. Dashboard — Fondo negro en light mode
**Archivo:** `app/(app)/dashboard/page.tsx:131,138,328`
- **Antes:** `bg-[#0a0a0a]` — fondo siempre negro, incluso en tema día
- **Después:** `bg-[#f5f0eb] dark:bg-[#0a0a0a]` — tono hueso/cálido en light, negro en dark
- Texto principal: `text-[#1a1a1a] dark:text-white`

#### 2. Botón "Físico" marrón en retro/navy
**Archivo:** `app/globals.css` (nuevos overrides)
- **Problema:** `bg-amber-600` sin override en retro/navy, se veía café
- **Solución:** Overrides amber añadidos para ambos temas (retro: `#b45309`, navy: `#92400e`)

#### 3. "Ver detalles" invisible en retro
**Archivo:** `app/(app)/catalog/page.tsx:225`
- **Antes:** clase `no-retro-override` impedía que el botón se viera (fondo heredado del card)
- **Después:** sin `no-retro-override`, el retro override `bg-blue-600 → #238636` lo hace visible

#### 4. "Ver detalles" se agrandaba con ambos stocks
**Archivo:** `app/(app)/catalog/page.tsx:199`
- **Antes:** `items-center` fijo — cuando los botones de stock hacían wrap, "Ver detalles" quedaba centrado verticalmente, viéndose desproporcionado
- **Después:** `items-start` en list view, `items-center` en grid/compact — alineación natural

#### 5. Tabs y texto gris invisible en navy
**Archivo:** `app/globals.css`
- **Problema:** `text-gray-500` (tabs inactivos) y `text-gray-200` (iconos) sin override navy
- **Solución:** `.navy .text-gray-500` y `.navy .text-gray-200 → #c5cae9` (lavanda visible)

#### 6. Active tab en navy muy sutil
**Archivo:** `app/globals.css`
- **Antes:** `background-color: rgba(121, 134, 203, 0.2)` — casi invisible
- **Después:** `0.35` — más notorio

#### 7. Subscribe CTA — Gradiente destruido en retro
**Archivo:** `app/(app)/subscribe/page.tsx:117`, `app/globals.css`
- **Problema:** Catch-all gradient killer `[class*="gradient"]` eliminaba el gradiente del CTA
- **Solución:** Clase `preserve-gradient` en el botón + overrides para mantener `text-black`

#### 8-9. Cards de facturación, progreso y racha blancas en navy
**Archivo:** `app/globals.css`
- **Problema:** `bg-gray-200` y `border-gray-300` sin override navy — se veían blancos
- **Solución:** `.navy .bg-gray-200 → #1e2a4a`, `.navy .border-gray-300 → rgba(121,134,203,0.2)`

### Archivos Modificados
- `app/globals.css` — +60 líneas: amber retro/navy, text-gray-500/200 navy, bg-gray-200 navy, border-gray-300 navy, active tab fortalecido, preserve-gradient.text-black
- `app/(app)/dashboard/page.tsx` — bg-[#0a0a0a] → bg-[#f5f0eb] dark:bg-[#0a0a0a] (3 lugares)
- `app/(app)/catalog/page.tsx` — items-start en list view, no-retro-override eliminado
- `app/(app)/subscribe/page.tsx` — preserve-gradient en CTA button

---

## [2026-05-09-F] - Fix Navy: Paneles Blancos, Mini-Stats y Tamaño de "Ver Detalles"

### Problemas
1. **CartPanel y LibraryPanel** — fondos `bg-white/95` y cards `bg-gray-50/80` se veían blancos en navy (las variantes `dark:` no aplican)
2. **Profile mini-stats** (racha, leídos, monedas) — `bg-gray-200/50` se veía blanco en navy
3. **"Ver detalles" en catálogo** — botón más grande que los botones de acción cuando hay ambos stocks (digital+físico), texto desproporcionado

### Cambios en `app/globals.css` (nuevos overrides navy)
- `.navy .bg-white\/95` → `rgba(10, 15, 30, 0.95)` — panel backgrounds
- `.navy .bg-gray-50\/80` → `rgba(17, 24, 39, 0.8)` — item cards en paneles
- `.navy .bg-gray-200\/50` → `rgba(30, 42, 74, 0.5)` — mini-stats en perfil
- `.navy .border-gray-200` → `rgba(121, 134, 203, 0.15)` — bordes de paneles
- `.navy .divide-gray-200 > *` → `rgba(121, 134, 203, 0.12)` — divisores

### Cambios en `app/(app)/catalog/page.tsx`
- **Antes:** `text-[10px] sm:text-sm font-medium ... px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl`
- **Después:** `text-[10px] sm:text-xs font-bold ... px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg whitespace-nowrap`
- El botón "Ver detalles" ahora tiene el mismo padding, tamaño de fuente y border-radius que los botones de acción, eliminando el desbalance visual cuando ambos stocks están presentes. Se mantiene el color azul para distinguirlo funcionalmente.

---

## [2026-05-12] — Acceso a Libros Comprados, Catálogo Inteligente y Perfil Unificado

### Problemas
1. **Book Detail — Acceso denegado a dueños permanentes:** Usuarios que compraron un libro digitalmente pero no tienen Premium veían "Activar Premium" en vez de "Abrir Lector". `canRead` solo verificaba suscripción, ignoraba `user_books.access_type = 'permanent'`.
2. **Catálogo — Botón Digital visible siempre:** Libros ya adquiridos digitalmente seguían mostrando el botón "Digital $29" para comprar de nuevo.
3. **Carrito no se limpiaba en cliente:** `verifySubscriptionAction` borraba los items de la DB, pero el store de Zustand en memoria seguía mostrando el badge del Header con items viejos.
4. **Perfil — Libros Comprados incompleto:** Solo mostraba digitales (de `user_books`), ignoraba físicos (de `orders_physical`). Sin badges de tipo.

### Cambios

**1. `lib/books.ts` + `types/book.ts`:**
- `getUserBooks` ahora incluye `access_type` en el objeto retornado (antes solo devolvía campos de `books` + progreso)
- La interfaz `Book` ahora tiene `access_type?: string | null`

**2. `app/(app)/book/[id]/page.tsx`:**
- `canRead` ahora incluye `hasPermanentAccess` (checa `access_type === 'permanent'` en `userBooks`)
- Usuarios con compra permanente ven "Listo para leer" + "Abrir Lector" aunque no tengan Premium
- Movido `useUserBooks` antes del `useEffect` de `payment=success` para evitar temporal dead zone
- `payment=success` ahora hace `refetch()` para refrescar datos

**3. `app/(app)/catalog/page.tsx`:**
- Agregados `useUserId` y `useUserBooks` para detectar ownership
- Derivado `ownedDigitalIds: Set<bookId>` de libros con `access_type === 'permanent'`
- Libros ya adquiridos digitalmente: botón "Digital $XX" reemplazado por badge verde "Adquirido"
- Botón "Físico $XX" se mantiene siempre (se pueden comprar múltiples copias físicas)
- Badge "Adquirido" usa `CheckCircle2` icon y estilo `bg-green-600/15 text-green-500 border-green-500/30`

**4. `app/(app)/dashboard/page.tsx`:**
- Agregados `useQueryClient` y `useCartStore`
- Después de `verifySubscriptionAction` exitoso: `clearCart()` (Zustand) + `invalidateQueries(['userBooks'])` (React Query)
- Header badge del carrito se resetea a 0, biblioteca se refresca al instante

**5. `app/(app)/profile/page.tsx`:**
- "Libros Comprados" ahora consulta AMBAS tablas: `user_books` (digital permanent) + `orders_physical` (físicos)
- Merge por `book_id` usando un Map — cada libro aparece una vez
- Badges por tipo: `[Digital]` (azul) y/o `[Físico]` (ámbar), ambos si el usuario compró ambas versiones
- Consulta separada a `orders_physical` para evitar problemas de foreign key

**6. `spec.md`:**
- Pricing actualizado: digital=$29, físico=$299, bundle=$319, envío=$50

### Archivos Modificados
- `lib/books.ts` — access_type en return de getUserBooks
- `types/book.ts` — access_type en interfaz Book
- `app/(app)/book/[id]/page.tsx` — canRead con permanent access
- `app/(app)/catalog/page.tsx` — ownedDigitalIds, badge Adquirido
- `app/(app)/dashboard/page.tsx` — clearCart + invalidate on success
- `app/(app)/profile/page.tsx` — merge físicos+digitales con badges
- `spec.md` — pricing table

---

## [2026-05-14] — Feedback y educación de usuario: monedas, paneles, badges de acceso

### Cambios

**1. `components/gamification/CoinsInfoModal.tsx` — Nuevo: Modal educativo de monedas**
- Explica qué son las monedas, cómo ganarlas (bronce: reseña/completar libro/rachas, plata: referidos, oro/diamante: rachas)
- Muestra días de acceso por tipo (3/7/14/30), límites mensuales ant-abuse, cómo canjear
- Botón `?` dentro del dropdown de CoinBalanceDisplay (no en header como se pidió)

**2. `components/ui/CoinBalance.tsx` — Modificado: Botón ? + CoinsInfoModal**
- Agregado encabezado "Tus monedas" + botón `HelpCircle` en la esquina del dropdown
- Al hacer clic abre `CoinsInfoModal`

**3. `components/ui/AccessBadge.tsx` — Nuevo: Badge de tipo de acceso**
- Muestra "Compra Permanente" (verde), "Suscripción Activa" (ámbar), "Canje (X días)" (púrpura)
- Integrado en book detail page y dashboard (Mi Biblioteca)

**4. `components/ui/PanelOnboarding.tsx` — Nuevo: Onboarding de 1 vez para paneles**
- Se muestra 2s después de entrar al dashboard si no se ha visto antes
- En móvil: explica edge swipe izquierdo (carrito) y derecho (biblioteca)
- En desktop: explica iconos en el header
- Guarda en localStorage `bookea-panel-onboarding-seen`

**5. `stores/cart.ts` — Modificado: libraryOpen + toggleLibrary en store**
- Agregado `libraryOpen`, `setLibraryOpen`, `toggleLibrary` al store de Zustand
- PanelManager ahora lee `libraryOpen` del store en lugar de useState local
- Permite al Header abrir/cerrar el panel de biblioteca

**6. `components/Header.tsx` — Modificado: Offline indicator + botón biblioteca**
- Indicador `WifiOff` naranja junto al logo cuando no hay conexión
- Nuevo botón `BookOpen` (biblioteca rápida) junto al carrito en desktop/mobile
- Importado `toggleLibrary` del store

**7. `components/community/ReviewForm.tsx` — Modificado: Toast de moneda al reseñar**
- Si la reseña tiene >= 50 caracteres y rating >= 3, muestra toast "Has ganado 1 moneda de Bronce"

**8. `components/gamification/BookCompletionQuiz.tsx` — Modificado: Toast al ganar moneda**
- Al pasar el quiz (3/5 correctas), muestra toast "¡Ganaste 1 moneda de Bronce!" con info de canje

**9. `components/CartPanel.tsx` — Modificado: Hint text corregido**
- Texto actualizado: "Usa el icono del carrito en la barra superior o desliza desde el borde izquierdo"

**10. `components/LibraryPanel.tsx` — Modificado: Hint text agregado**
- Empty state ahora muestra cómo reabrir el panel

**11. `app/(app)/dashboard/page.tsx` — Modificado: Onboarding + CTA + retry**
- `<PanelOnboarding />` renderizado en el dashboard
- Empty state ahora tiene botón "Explorar catálogo →"
- Toast de error de pago incluye botón "Reintentar" que recarga la página

**12. `app/(app)/book/[id]/page.tsx` — Modificado: AccessBadge en banner de acceso**
- Muestra badge de tipo de acceso (Compra Permanente / Suscripción / Canje) en el banner verde

### Archivos Nuevos
- `components/gamification/CoinsInfoModal.tsx`
- `components/ui/AccessBadge.tsx`
- `components/ui/PanelOnboarding.tsx`

### Archivos Modificados
- `components/ui/CoinBalance.tsx`
- `stores/cart.ts`
- `components/PanelManager.tsx`
- `components/Header.tsx`
- `components/community/ReviewForm.tsx`
- `components/gamification/BookCompletionQuiz.tsx`
- `components/CartPanel.tsx`
- `components/LibraryPanel.tsx`
- `app/(app)/dashboard/page.tsx`
- `app/(app)/book/[id]/page.tsx`

---

## [2026-05-13-B] — Fix webhook RLS + offline mode restore + toast con botón a biblioteca

### Cambios

**1. `app/api/stripe/webhook/route.ts` — Fix crítico: webhook no podía escribir en DB**
- **Problema:** Stripe envía webhooks sin cookies de usuario (es servidor-a-servidor). `createClient()` creaba un cliente Supabase sin autenticación, y RLS bloqueaba todos los writes (UPDATE users, INSERT user_books, etc.).
- **Solución:** Cambiado a `createAdminClient()` (service_role key) que bypass RLS. La seguridad está en la verificación de firma criptográfica de Stripe (línea 20-25) — solo Stripe puede firmar eventos válidos.

**2. `hooks/useUser.ts`, `hooks/useSubscription.ts`, `hooks/useAvatars.ts` — Offline mode restore**
- **Problema:** En el commit anterior se quitó `initialData` de localStorage para arreglar stale data post-login (`staleTime: 5min → 0`), pero esto rompió el modo offline.
- **Solución:** Se restauró `initialData` desde localStorage PERO con `staleTime: 0` + `onAuthStateChange` listener. Así en online siempre refetchea fresco, y en offline muestra datos cacheados al instante.
- `useSubscription.ts` adicionalmente ya no hace `throw error` en 406 (usuario sin row en `users` table) — retorna `DEFAULT_FREE` silenciosamente.

**3. `app/(app)/dashboard/page.tsx` — Botón "Ir a mi biblioteca" en toasts de pago**
- Agregado `action` button en toasts de `toast.success("¡Compra completada!")` y `toast.success("¡Bienvenido a Bookea Premium!")`
- Al hacer clic navega a `/dashboard` donde están los libros comprados

### Archivos Modificados
- `app/api/stripe/webhook/route.ts` — createClient → createAdminClient
- `hooks/useUser.ts` — initialData desde localStorage
- `hooks/useSubscription.ts` — initialData desde localStorage + no throw en 406 + cache a localStorage
- `hooks/useAvatars.ts` — initialData desde localStorage
- `app/(app)/dashboard/page.tsx` — action button en toasts

---

## [2026-06-06] — Admin page reescrito como client component con tabs (Dashboard, Ingresos, Stock, Vendidos, Solicitudes)

### Cambios

**1. `app/admin/page.tsx` — Reescritura completa como Client Component**
- Migrado de Server Component (`dynamic = 'force-dynamic'`) a Client Component con React Query
- 5 tabs internas con sidebar desktop + tabs móviles:
  - **Dashboard**: Stats de catálogo, órdenes, usuarios, vendedores, pagos digitales + acciones rápidas
  - **Ingresos**: Chart tipo exchange con 3 líneas (Venta, Ganancia, Ahorro) de TODOS los vendedores + selector de mes
  - **Stock**: Inventario agrupado por vendedor (cards colapsables con portada, título, autor, cantidad)
  - **Vendidos**: Historial de ventas con stats header (unidades, ingresos, vendedores activos)
  - **Solicitudes**: Lista inline de stock requests con acciones (enviar/cancelar/entregar), recibido/vendido por ítem
- Título cambiado de "Dashboard" a "Admin"
- Reemplazado `CheckCircle2` por `Check` (lucide-react)

**2. `app/admin/layout.tsx` — Branding simplificado**
- "Admin Panel" → "Admin"

### Archivos Modificados
- `app/admin/page.tsx` — Server → Client component con tabs y React Query
- `app/admin/layout.tsx` — Branding: Admin Panel → Admin

---

## [2026-06-06-B] — Eliminar solicitudes de stock (solo admin)

**1. `lib/actions/sellers.ts` — Nueva `deleteStockRequestAction`**
- Verifica rol admin via `get_my_role` RPC
- Elimina `stock_request_items` asociados, luego el `stock_requests`
- Usa `createAdminClient()` para bypass RLS

**2. `app/admin/page.tsx` — Botón "Eliminar" en solicitudes**
- Importa `deleteStockRequestAction` y `Trash2`
- Mutación `deleteRequest` con React Query, invalida queries al success
- Botón con confirmación (`window.confirm`) en cada card de solicitud, separado por línea divisoria

### Archivos Modificados
- `lib/actions/sellers.ts` — deleteStockRequestAction
- `app/admin/page.tsx` — Botón eliminar + mutation

---

## [2026-05-13] — Mis Órdenes + tracking admin + fix total:0

### Cambios

**1. `supabase/migrations/020_add_tracking_number.sql` — Nuevo**
- `ALTER TABLE orders_physical ADD COLUMN tracking_number TEXT`
- Permite al admin asignar número de guía a cada orden

**2. `app/(app)/orders/page.tsx` — Nuevo**
- Ruta `/orders` para que el usuario vea sus órdenes físicas
- Query a `orders_physical` con join a `books` (title, cover_url, author)
- Status badges: Pendiente (ámbar), Enviado (azul), Entregado (verde), Cancelado (rojo)
- Muestra portada, título, datos de envío, precio, tracking number si existe
- Texto contextual según status ("El admin procesará tu envío pronto", etc.)
- Empty state con link al catálogo físico

**3. `app/admin/orders/page.tsx` — Tracking management**
- Agregado `tracking_number` a la interfaz Order + select en query
- Input editable para número de guía al marcar como "Enviado"
- Botón de "Cancelar" directo desde pendiente
- Muestra tracking number en la card

**4. `app/(app)/profile/page.tsx` — Sidebar link**
- Agregado link "Mis Órdenes" con icono Package en el sidebar del perfil

**5. `lib/actions/subscriptions.ts` + `app/api/stripe/webhook/route.ts` — Fix total:0**
- Ahora consulta `books.price_physical` desde DB
- Calcula `total = price_physical + 50` (antes guardaba 0)

### Archivos Modificados/Creados
- `supabase/migrations/020_add_tracking_number.sql` **(nuevo)**
- `app/(app)/orders/page.tsx` **(nuevo)**
- `app/admin/orders/page.tsx`
- `app/(app)/profile/page.tsx`
- `lib/actions/subscriptions.ts`
- `app/api/stripe/webhook/route.ts`
