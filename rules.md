# 📋 BOOKEA — Project Rules

Reglas del proyecto para el agente y el desarrollador.
Seguir estas reglas en cada sesión de desarrollo.

---

## 1. STACK — NO CAMBIAR

- Next.js 15 + React 19 + TypeScript
- Supabase (Auth, DB, Storage, Realtime)
- Tailwind 4
- Stripe (pagos)
- epubjs (lector)
- Zustand (estado global)
- TanStack Query (fetching)
- Resend (emails)
- Vercel (deploy)

---

## 2. ESTRUCTURA DE CARPETAS — RESPETAR

```
app/(auth)/         → login, register
app/(app)/          → dashboard, catalog, book/[id], reader/[id], profile
app/admin/          → solo role: admin
components/reader/  → componentes del lector
components/catalog/ → cards, filtros
components/community/ → comentarios, reviews
components/admin/   → panel admin
components/ui/      → botones, modales, inputs reutilizables
hooks/              → custom hooks
stores/             → zustand stores
types/              → typescript types
lib/                → supabase.ts, stripe.ts, utils.ts
```

---

## 3. BASE DE DATOS — REGLAS

- **Un solo registro por libro** — digital y físico en la misma tabla `books`
- **Nunca borrar tablas** — usar `is_active: false` para desactivar
- **RLS siempre activo** — nunca deshabilitar Row Level Security
- **Migraciones en** `supabase/migrations/` — nunca editar la DB directo sin migración
- **Roles de usuario:** `free`, `subscriber`, `admin` — campo en tabla `profiles`

---

## 4. AUTH — REGLAS

- Login con **email/password** en desarrollo
- Magic link para producción (cuando se lance)
- Rutas protegidas: todo bajo `app/(app)/` requiere sesión activa
- Rutas admin: verificar `role: admin` en middleware
- Redirigir a `/login` si no hay sesión
- Redirigir a `/dashboard` después de login exitoso

---

## 5. PRECIOS — FIJOS EN MXN

| Producto | Precio |
|----------|--------|
| Suscripción mensual | $99 MXN |
| Compra digital permanente | $49 MXN |
| Libro físico | $199–$249 MXN |
| Bundle físico + digital | $229 MXN |

- Moneda siempre en **MXN**
- Pagos con **Stripe**
- Nunca hardcodear precios en componentes — vienen de DB o variables de entorno

---

## 6. LECTOR EPUB — REGLAS

- Usar **epubjs** — ya instalado como `epubjs`
- Siempre cargar con `openAs: "epub"`
- Guardar progreso en tabla `reading_progress` (posición CFI)
- El lector es `"use client"`
- Suscriptores: acceso a sus 5 libros del ciclo
- Compra permanente: acceso de por vida
- Free: solo X% del libro (a definir)

---

## 7. INVENTARIO — REGLAS

- Stock físico se descuenta automáticamente al confirmar orden
- Si `stock_physical = 0` → ocultar botón "Comprar físico"
- Solo admin puede actualizar stock manualmente
- Alerta cuando stock llegue a 2 unidades

---

## 8. COMMITS — CONVENCIÓN

```
feat: nueva funcionalidad
fix: corrección de bug
chore: cambios de configuración
style: cambios de UI sin lógica
refactor: refactorización de código
docs: documentación
```

Ejemplos:
```
feat: add catalog page with book grid
fix: resolve RLS infinite recursion on users table
chore: add epubjs dependency
```

---

## 9. FASES DE DESARROLLO

### Fase 1 — MVP (lanzar y cobrar)
- [ ] Auth completo (login/register)
- [ ] Catálogo de libros
- [ ] Página de detalle de libro
- [ ] Lector EPUB funcional
- [ ] Suscripción con Stripe
- [ ] Compra permanente
- [ ] Panel admin básico
- [ ] Venta física con formulario de envío

### Fase 2 — Retención
- [ ] Comentarios en tiempo real
- [ ] Progreso y rachas de lectura
- [ ] Highlights y notas
- [ ] Reseñas y ratings
- [ ] PWA instalable

### Fase 3 — Crecimiento
- [ ] Compartir cita con imagen branded
- [ ] Badges y gamificación
- [ ] Lista de deseos con alertas
- [ ] Regalos entre usuarios
- [ ] "También te puede gustar"

---

## 10. LO QUE NO SE TOCA

- No cambiar el nombre del proyecto (es **Bookea**)
- No cambiar la moneda a USD (es MXN para México)
- No agregar librerías sin consultar primero
- No deshabilitar TypeScript strict mode
- No subir archivos `.env` al repo

---

## 11. ESTADO ACTUAL DEL PROYECTO

✅ Auth email/password funcionando  
✅ Tabla `books` en Supabase con libro de prueba  
✅ Catálogo `/catalog` mostrando libros  
✅ Lector EPUB básico en `/reader/[id]`  
✅ Estructura de carpetas creada  
✅ Migraciones iniciales aplicadas  
⬜ Dashboard del usuario  
⬜ Página de detalle `/book/[id]`  
⬜ Navbar y layout general  
⬜ Stripe integrado  
⬜ Panel admin  
⬜ Formulario de compra física  

---

## 12. DOCUMENTACIÓN Y COMENTARIOS — REGLAS

Todo el código fuente debe estar rigurosamente documentado utilizando un sistema de **índice numérico jerárquico** para facilitar la generación futura de Documentos de Arquitectura y Construcción de Software.

Antes de cada bloque funcional importante, hook, componente, o efecto, se debe añadir un comentario breve explicando qué hace, precedido por su índice correspondiente.

**Índice de Módulos (Prefijos):**
* **`1.x`** -> Configuraciones globales, Estructura base y Base de Datos (ej. `lib/`, `middleware.ts`, `globals.css`)
* **`2.x`** -> Autenticación y Gestión de Usuarios (ej. `app/(auth)/`)
* **`3.x`** -> Catálogo, Exploración y Hooks de Datos (ej. `app/(app)/catalog`, `hooks/`)
* **`4.x`** -> Lector EPUB y Progreso de Lectura (ej. `app/(app)/reader/`, `lib/reading.ts`)
* **`5.x`** -> Panel de Administrador e Inventario (ej. `app/admin/`)
* **`6.x`** -> Componentes Compartidos de UI y Utilerías (ej. `components/`, `lib/stripe.ts`)
* **`7.x`** -> APIs de Integración Externa (ej. `app/api/stripe/`, `app/api/books/`)

**Formato del comentario:**
```typescript
// 4.1 - Carga y configuración inicial del visor epubjs
const initEpub = async () => {
   // 4.1.1 - Registro de los temas base
   rendition.themes.register("light", ...);
}
```

Cualquier agente de IA o desarrollador que toque, cree o modifique código **ESTÁ OBLIGADO** a añadir, actualizar o respetar esta numeración.

---

## 13. BITÁCORA DE DESARROLLO

Es obligatorio mantener actualizado el archivo `bitacora.md` en la raíz del proyecto. **CADA CAMBIO** estructural, nueva funcionalidad o corrección de bugs debe ser documentado en este archivo. Esto es fundamental para entender la evolución y lógica del sistema a lo largo del tiempo.

---

*Última actualización: Marzo 2026*
*Proyecto: Bookea — bookea.mx*