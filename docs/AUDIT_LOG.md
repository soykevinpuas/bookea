# 🛡️ Control de Integridad y Auditoría - Bookea

Este documento registra todas las auditorías de código realizadas en el proyecto, detallando el nivel de profundidad, el modelo de IA utilizado y el estado de la revisión.

---

## Estructura del Log
| Fecha | Módulo / Archivo | Nivel | Modelo | Modo | Auditor | Estado | Notas |
|-------|-----------------|-------|--------|------|---------|--------|-------|
| 2026-04-08 | Project Rules & Docs | 1 | Flash | Fast | Antigravity | ✅ OK | Inicialización del protocolo de auditoría. |
| 2026-04-08 | Supabase Schema (001) | 2 | Pro | Plan | Antigravity | 🛡️ Analítico | Revisión base de RLS. Pendiente de reporte detallado. |
| 2026-05-07 | Migraciones 001-013 + Server Actions | 2 | Flash | Plan | AI Agent | ⚠️ Hallazgos | Ver reporte detallado abajo. 8 hallazgos (3 críticos, 3 altos, 2 medios). |
| 2026-07-01 | Docs + estructura + comentarios | 1 | GPT-5 Codex | Default | Codex | ⚠️ Deuda documentada | Docs reconciliadas con codigo. Lint: 0 errores, 247 warnings. TypeScript/build: 0 errores. |
| 2026-07-06 | Preview Vercel + Landing PWA | 1 | GPT-5 Codex | Default | Codex | ⚠️ Riesgo operativo | Previews protegidos por Vercel SSO redirigen `manifest.json`; se ocultó manifest en preview y se quitaron fotos externas de fallback. |
| 2026-07-08 | Sesion + Vendedor | 1 | GPT-5 Codex | Default | Codex | ✅ OK con nota | Sesion reforzada, dashboard vendedor no cachea 401/stock vacio falso. `THREE.Clock` confirmado como warning externo de React Three Fiber. |
| 2026-07-08 | Biblioteca offline + Landing auth | 1 | GPT-5 Codex | Default | Codex | ✅ OK | El sello de descargado ahora requiere descarga explicita; landing agrega accesos a login/registro. |
| 2026-07-09 | ESLint legacy | 1 | GPT-5 Codex | Default | Codex | ✅ OK con deuda tipada | ESLint queda en 0 warnings. `UntypedValue` se usa como puente para datos legacy no tipados; pendiente tipado fuerte por dominio. |
| 2026-07-13 | Arranque/auth/navigation + Supabase Free | 1 | GPT-5 Codex | Default | Codex | ⚠️ Riesgo operativo mitigado | Migraciones local/remoto sincronizadas hasta 065. Supabase Free puede pausarse por baja actividad; conviene Pro para operación real. |

---

## Reportes de Auditoría Detallados

### [2026-07-13] - Arranque, Sesión y Riesgo Supabase Free
**Módulo:** `proxy.ts`, `lib/auth-provider.tsx`, `hooks/useNavigationWarmup.ts`, `components/ui/LoadingStates.tsx`, `app/(app)/catalog/page.tsx`, `app/admin/page.tsx`.
**Estado:** ⚠️ Mitigado en código, requiere decisión operativa de infraestructura.

#### Hallazgos
- Las migraciones estaban sincronizadas local/remoto hasta `065`, por lo que el problema observado no venía de una migración pendiente.
- El arranque hacía validación remota de sesión y precargas de datos pesados en paralelo con la pantalla visible.
- Links touch podían disparar prefetch de datos antes de navegar, generando sensación de bottom nav lenta en iPad.
- Supabase Free puede pausar proyectos por baja actividad; si el proyecto queda frío, la primera experiencia puede sufrir aunque el código esté correcto.

#### Decisión
- Se redujo el trabajo de arranque a sesión local + pantalla visible.
- `proxy.ts` evita falsos logout cuando hay cookie de sesión y `getUser()` está lento.
- El warmup global quedó solo para rutas; los datos se cargan al entrar a cada pantalla.
- El prefetch de datos quedó reservado a hover real de escritorio.

#### Resultado de verificación
- `npm run lint`: pasa sin errores.
- `npx tsc --noEmit`: pasa sin errores.
- `npm run build`: pasa sin errores.

---

### [2026-07-09] - Limpieza de Warnings ESLint
**Módulo:** pantallas admin/vendedor, componentes con imagenes, modulos legacy con datos sin contrato fuerte.
**Estado:** ✅ OK con deuda tipada documentada.

#### Hallazgos
- ESLint reportaba 243 warnings legacy: 207 `@typescript-eslint/no-explicit-any` y 36 `@next/next/no-img-element`.
- Muchos `any` venian de datos Supabase/RPC, cache local, payloads de librerias de UI y estructuras historicas sin tipos compartidos.
- Las imagenes dinamicas de portadas/QR/avatar usaban `<img>` directo en varias superficies.

#### Decisión
- Se agrego `components/ui/AppImage.tsx` como wrapper de `next/image` con `unoptimized` por defecto para mantener compatibilidad con fuentes dinamicas y data URLs.
- Se reemplazaron los `<img>` reportados por `AppImage`.
- Se agrego `UntypedValue` en `types/global.d.ts` como puente explicito para valores legacy no tipados. Esto elimina `any` explicito y hace visible donde falta tipado de dominio real.

#### Resultado de verificación
- `npm run lint`: pasa con 0 errores y 0 warnings.
- `npx tsc --noEmit`: pasa sin errores.
- `npm run build`: pasa sin errores.

---

### [2026-07-08] - Biblioteca Offline y Accesos de Landing
**Módulo:** `lib/downloads.ts`, `lib/books.ts`, `components/BookLongPressMenu.tsx`, `app/(app)/book/[id]/page.tsx`, `components/LandingHero.tsx`.
**Estado:** ✅ OK operativo.

#### Hallazgos
- El service worker cachea EPUBs leídos online para resiliencia, pero la UI usaba presencia en Cache API como si fuera descarga explícita.
- `getUserBooks()` marcaba `isOfflineReady` con solo encontrar metadata local, aunque esa metadata se guarda para arrancar rápido la biblioteca.
- La landing no exponía accesos inmediatos de login/registro cuando el header global se oculta en `/`.

#### Decisión
- La UI de descarga ahora exige `isOfflineReady === true` en metadata local y confirma que el EPUB siga en Cache API.
- El modo offline lista solo libros descargados explícitamente, no todo lo que quedó cacheado por navegación.
- Se añadió barra superior derecha en landing con acciones de iniciar sesión y registrarse.

#### Resultado de verificación
- `npm run lint`: pasa con 0 errores y 243 warnings legacy.
- `npx tsc --noEmit`: pasa sin errores.
- `npm run build`: pasa sin errores.

---

### [2026-07-08] - Sesion Persistente y Panel Vendedor
**Módulo:** `proxy.ts`, `lib/auth-provider.tsx`, `lib/auth-fetch.ts`, `app/vendedor/page.tsx`, `app/vendedor/layout.tsx`, `app/admin/layout.tsx`, `app/api/vendedor/dashboard/route.ts`.
**Estado:** ✅ OK operativo.

#### Hallazgos
- El dashboard de vendedor podia consultar `/api/vendedor/dashboard` antes de que auth terminara de hidratar o refrescar sesion, dejando UI sin inventario aunque el stock existiera.
- `admin` y `vendedor` redirigian a `/login` al ver `userId` vacio sin intentar recuperar refresh token.
- `proxy.ts` usaba `getSession()` para proteger rutas; con access token vencido es mas robusto usar `getUser()` para validar y refrescar cookies.
- El warning `THREE.Clock: This module has been deprecated` se origina en `node_modules/@react-three/fiber/dist/...`, no en codigo propio. `npm view @react-three/fiber version` reporto 9.6.1, igual a la version instalada, por lo que queda como warning upstream no bloqueante.

#### Decisión
- Se agrego recuperacion de sesion en cliente, keepalive cada 5 minutos y reintento de APIs tras refresh.
- El dashboard de vendedor usa `cache: "no-store"`, query por usuario y `refetchOnMount/refetchOnWindowFocus`.
- La API de vendedor queda `force-dynamic` para datos operativos.
- Para eliminar el warning de `THREE.Clock` haria falta migrar el render 3D fuera de React Three Fiber o esperar version upstream que reemplace `Clock` por `Timer`; no afecta ventas, stock ni auth.

#### Resultado de verificación
- `npm run lint`: pasa con 0 errores y 243 warnings legacy.
- `npx tsc --noEmit`: pasa sin errores.
- `npm run build`: pasa sin errores.

---

### [2026-07-06] - Riesgo Operativo: Vercel SSO en Previews
**Módulo:** `app/layout.tsx`, `app/page.tsx`, `components/LandingHero.tsx`, `components/FloatingBook3D.tsx`.
**Estado:** ⚠️ Mitigado en UI, requiere configuración de deployment para acceso público.

#### Hallazgos
- En previews protegidos, Vercel puede redirigir `/manifest.json` a `vercel.com/sso-api`, lo que el navegador bloquea por CORS al cargar el manifest PWA.
- Este bloqueo ocurre antes de que Next.js procese la request, por lo que no se puede resolver completamente desde rutas, proxy o headers de la app.
- La landing usaba `picsum.photos` como fallback cuando no había portadas de Supabase, mostrando fotos ajenas al catálogo.

#### Decisión
- El manifest PWA se mantiene en producción/local, pero se omite cuando `VERCEL_ENV=preview`.
- Se eliminaron fallbacks externos de portadas para que solo se muestren imágenes reales del catálogo.
- Para acceso público al preview, la configuración pendiente vive en Vercel: desactivar Deployment Protection para ese deployment/proyecto, usar un dominio de producción sin SSO, o compartir un bypass autorizado.

---

### [2026-07-01] - Auditoría de Coherencia Documental y Comentarios
**Módulo:** Documentación raíz, docs técnicas y módulos críticos.
**Estado:** ⚠️ OK operativo con deuda técnica documentada.

#### Resultado de verificación
- `npm run lint`: pasa con 0 errores y 247 warnings.
- `npx tsc --noEmit`: pasa sin errores.
- `npm run build`: pasa sin errores.

#### Hallazgos
- La documentación anterior decía Next 15, pero el proyecto usa Next 16.1.6.
- La documentación mezclaba features futuras con módulos ya implementados: vendedor, stock por admin, carrito, canjes, PWA y webhook Stripe endurecido.
- `test.md` describía scripts y dependencias de test que no existen en `package.json`.
- Varias reglas de comentarios usaban numeración jerárquica rígida que no estaba aplicada de forma consistente.
- ESLint conserva deuda amplia de `@typescript-eslint/no-explicit-any` y recomendaciones de `next/image`.

#### Decisión
- Se reescribieron docs como inventario vivo del código.
- Se añadió `AGENTS.md` como guía corta para próximos agentes.
- Se mantuvo la deuda de typing/UI como advertencia, sin refactor masivo en esta pasada.

---

### [2026-04-08] - Auditoría de Cimentación de Seguridad
**Módulo:** `supabase/migrations/001_initial_schema.sql`
**Estado:** 🛡️ SEGURO (Básico)
**Hallazgos:**
- Las tablas principales tienen RLS habilitado.
- Las políticas de `users` y `profiles` correctamente vinculadas a `auth.uid()`.
- **Recomendación:** Monitorear el crecimiento de políticas RLS para evitar recursividad en tablas de `reviews` y `comments`.

---

### [2026-05-07] - Auditoría de RLS y Seguridad (Completa)
**Módulo:** Migraciones 001-013 + `lib/books.ts` + `lib/actions/coins.ts`
**Estado:** ⚠️ REQUIERE CORRECCIÓN INMEDIATA

#### 🔴 Crítico: Políticas "System can..." exponen tablas de gamificación
5 tablas en `013_coins_gamification.sql` tienen políticas `FOR ALL USING (true)` o `FOR INSERT WITH CHECK (true)` que permiten manipulación directa desde el cliente, bypassando la lógica de negocio de las RPCs SECURITY DEFINER:
- `coins` → `FOR ALL USING (true)` — cualquier usuario puede insertar/actualizar/eliminar monedas de cualquiera
- `coin_transactions` → `FOR INSERT WITH CHECK (true)` — fabricar transacciones
- `coin_redemptions` → `FOR INSERT WITH CHECK (auth.uid() = user_id)` — canjear libros sin gastar monedas
- `streak_milestones` → `FOR INSERT WITH CHECK (true)` — reclamar milestones sin cumplirlos
- `referrals` → `FOR INSERT WITH CHECK (true)` — crear referidos falsos
- `monthly_limits_tracker` → `FOR ALL USING (true)` — manipular límites anti-abuse

**Solución:** Eliminar estas políticas. Las RPCs SECURITY DEFINER ya bypassan RLS. Pendiente de migración 014.

#### 🟠 Alto: users SELECT expone emails de todos los usuarios
`009_fix_profiles_rls.sql`: `users_select_all` con `USING (true)` permite a cualquier usuario autenticado ver todos los emails.

#### 🟠 Alto: analytics_events INSERT sin restricción
`012_analytics_system.sql`: `"Service can insert analytics"` con `FOR INSERT WITH CHECK (true)` permite spamear la tabla de analytics desde el cliente.

#### 🟠 Alto: coin_redemptions INSERT directo desde el cliente
`013_coins_gamification.sql`: `"Users can insert own redemptions"` permite a usuarios crear canjes directos sin pasar por `redeem_coin` RPC, evadiendo verificación de saldo y anti-abuse.

#### ~~🟠 Medio: subscription_credits UPDATE sin WITH CHECK~~ (RESUELTO)
~~`001_initial_schema.sql`: Usuarios pueden poner `credits_remaining = 9999` en su propio registro.~~
**Resuelto en migración 019:** La tabla `subscription_credits` fue eliminada (migración a acceso ilimitado).

#### 🟠 Medio: localStorage caching de rol en hasBookAccess
`lib/books.ts:194-207`: Guarda `bookea-user-role` en localStorage y lo usa para bypass client-side de acceso. Un usuario puede poner `admin` manualmente.

#### 🟠 Medio: increment_counter RPC inexistente
`lib/actions/coins.ts:246`: Usa `supabase.rpc('increment_counter' as any)` que no existe en ninguna migración. Error silencioso.

#### 🟢 Bajo: Middleware no protege todas las rutas de (app)
Faltan `/profile` y `/catalog` en `protectedPaths` del middleware.

---

## Histórico de Revisiones Contínuas
- [x] Regla 14 Integrada en `rules.md`
- [x] Bitácora actualizada con principios de integridad.
- [x] Estructura de `AUDIT_LOG.md` definida.
