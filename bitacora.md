# 📓 Bitácora de Desarrollo - Bookea

Este documento registra el progreso histórico y lógico de construcción del proyecto Bookea. De acuerdo con la regla 13 del proyecto, cada sesión de desarrollo, arreglo o modificación estructural debe quedar registrada aquí.

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

---

### [2026-04-24-G] Estabilización de Biblioteca y Sincronización de Pagos

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
