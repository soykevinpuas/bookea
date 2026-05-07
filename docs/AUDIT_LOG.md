# 🛡️ Control de Integridad y Auditoría - Bookea

Este documento registra todas las auditorías de código realizadas en el proyecto, detallando el nivel de profundidad, el modelo de IA utilizado y el estado de la revisión.

---

## Estructura del Log
| Fecha | Módulo / Archivo | Nivel | Modelo | Modo | Auditor | Estado | Notas |
|-------|-----------------|-------|--------|------|---------|--------|-------|
| 2026-04-08 | Project Rules & Docs | 1 | Flash | Fast | Antigravity | ✅ OK | Inicialización del protocolo de auditoría. |
| 2026-04-08 | Supabase Schema (001) | 2 | Pro | Plan | Antigravity | 🛡️ Analítico | Revisión base de RLS. Pendiente de reporte detallado. |
| 2026-05-07 | Migraciones 001-013 + Server Actions | 2 | Flash | Plan | AI Agent | ⚠️ Hallazgos | Ver reporte detallado abajo. 8 hallazgos (3 críticos, 3 altos, 2 medios). |

---

## Reportes de Auditoría Detallados

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

#### 🟠 Medio: subscription_credits UPDATE sin WITH CHECK
`001_initial_schema.sql`: Usuarios pueden poner `credits_remaining = 9999` en su propio registro.

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
