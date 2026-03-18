# 📚 BOOKEA — Product Spec v1.0
> SaaS de lectura digital + venta física de libros  
> Mercado objetivo: México  
> Versión: 0.1 (MVP)

---

## 1. VISIÓN DEL PRODUCTO

Bookea es una plataforma SaaS que permite a los usuarios leer libros digitales (EPUB) en el navegador, comprar acceso permanente a títulos, adquirir el libro físico directamente desde el lector, y participar en una comunidad de lectores con comentarios en tiempo real.

El operador (tú) administra el catálogo, inventario físico, órdenes y precios desde un panel de administración integrado.

---

## 2. USUARIOS

| Tipo | Descripción |
|------|-------------|
| **Visitante** | Sin cuenta. Puede ver catálogo y leer descripción de libros |
| **Usuario Free** | Con cuenta gratuita. Acceso limitado |
| **Usuario Suscrito** | Paga $99 MXN/mes. Elige 5 libros por ciclo |
| **Usuario con compra permanente** | Pagó por un título. Acceso de por vida a ese título |
| **Admin** | Tú. Acceso total al panel de gestión |

---

## 3. MODELO DE NEGOCIO

### 3.1 Planes

| Plan | Precio | Beneficio |
|------|--------|-----------|
| **Free** | $0 | Vista previa de X% de cada libro |
| **Suscripción** | $99 MXN/mes | Elige 5 libros por mes. Se resetean al renovar |
| **Compra permanente** | $49 MXN por título | Acceso de por vida al título. Sin descarga |
| **Libro físico** | $199–$249 MXN | Orden de envío a domicilio. Envío aparte |
| **Bundle físico + digital** | $229 MXN | Compra permanente + físico con descuento |

### 3.2 Lógica de suscripción
- Al suscribirse, el usuario tiene 5 "créditos" de selección
- Elige hasta 5 títulos del catálogo
- Al renovar el mes, los créditos se resetean (los libros elegidos antes siguen accesibles ese ciclo pero no el nuevo)
- Si no renueva, pierde acceso a los 5 libros seleccionados

### 3.3 Pagos
- Plataforma: **Stripe** con precios en MXN
- Suscripción recurrente mensual (Stripe Subscriptions)
- Compras únicas (Stripe Payment Intents)
- Órdenes físicas incluyen captura de datos de envío antes del pago

---

## 4. FUNCIONALIDADES

### 4.1 Catálogo
- Grid de libros con portada, título, autor, precio
- Filtros por categoría, precio, disponibilidad física
- Página de detalle de libro con descripción, muestra gratuita, opciones de compra
- Buscador de títulos

### 4.2 Lector EPUB
- Renderizado nativo en browser con epub.js
- Progreso de lectura sincronizado (posición exacta guardada en DB)
- Cambio de fuente, tamaño y modo oscuro/claro
- Highlights y notas personales
- Al llegar a la última página: sugerencia de dejar comentario

### 4.3 Comunidad
- Sección de comentarios públicos por libro
- Tiempo real con Supabase Realtime
- Cualquier usuario (incluyendo free) puede comentar
- Likes en comentarios
- Reporte de comentarios inapropiados

### 4.4 Gamificación y retención
- Rachas de lectura diaria (días consecutivos leyendo)
- Metas de lectura mensuales (ej. "lee 2 libros este mes")
- Insignias por logros (primer libro terminado, racha de 7 días, etc.)
- Perfil público con libros leídos y reseñas

### 4.5 Social y viral
- Compartir cita con imagen: usuario selecciona texto → app genera imagen branded con la cita → comparte en redes
- Reseñas y ratings (1–5 estrellas) visibles en catálogo
- "También te puede gustar" basado en historial

### 4.6 Lista de deseos
- Guardar títulos sin comprar
- Notificación cuando un título en lista de deseos tenga oferta o nueva disponibilidad física

### 4.7 Regalos
- Regalar un título (permanente o físico) a otro usuario por email

### 4.8 Compra de libro físico
- Botón "Comprar físico" visible en página de libro y dentro del lector
- Formulario de captura: nombre, dirección, ciudad, estado, CP, teléfono
- Costo de envío calculado o fijo (a definir)
- Pago con Stripe
- Confirmación por email
- El stock se descuenta automáticamente
- Si stock = 0, el botón desaparece

---

## 5. PANEL DE ADMINISTRACIÓN

Solo accesible para usuarios con `role: admin` en Supabase.

### 5.1 Gestión de catálogo
- Agregar/editar/eliminar libros
- Campos: título, autor, descripción, categoría, portada (imagen), archivo EPUB, precio digital, precio físico, stock físico, activo/inactivo
- Un solo registro por libro con datos de ambos formatos (digital + físico)

### 5.2 Gestión de inventario físico
- Ver stock actual por título
- Actualizar stock manualmente
- Alerta cuando stock llega a N unidades (configurable)

### 5.3 Gestión de órdenes físicas
- Lista de órdenes con datos del comprador y dirección
- Cambiar estado: pendiente → enviado → entregado
- Marcar como procesada

### 5.4 Marketing y precios
- Cambiar precios de títulos
- Crear descuentos por tiempo limitado (% o monto fijo)
- Enviar notificaciones o emails a usuarios (segmentados por plan)
- Activar/desactivar bundles

### 5.5 Usuarios
- Ver lista de usuarios y su plan actual
- Cambiar plan manualmente si hay soporte requerido
- Bloquear usuario

---

## 6. ESTRUCTURA DE BASE DE DATOS (Supabase)

```
users
  id, email, role (free/subscriber/admin), created_at

profiles
  user_id, name, avatar_url, bio, reading_streak, total_books_read

books
  id, title, author, description, category, cover_url, epub_url,
  price_digital, price_physical, price_bundle, stock_physical,
  is_active, created_at

user_books (acceso)
  user_id, book_id, access_type (subscription/permanent/gift),
  expires_at (null si es permanente)

subscription_credits
  user_id, cycle_start, books_selected[], credits_remaining

reading_progress
  user_id, book_id, cfi_position, percent_complete, last_read_at

highlights
  id, user_id, book_id, cfi_start, cfi_end, text, color, note, created_at

comments
  id, user_id, book_id, content, likes_count, created_at

comment_likes
  user_id, comment_id

reviews
  user_id, book_id, rating (1-5), content, created_at

orders_physical
  id, user_id, book_id, status (pending/shipped/delivered),
  name, address, city, state, zip, phone,
  shipping_cost, total, stripe_payment_id, created_at

wishlist
  user_id, book_id, added_at

discounts
  id, book_id (null = todos), type (percent/fixed), value,
  starts_at, ends_at, is_active

badges
  id, name, description, icon_url

user_badges
  user_id, badge_id, earned_at
```

---

## 7. STACK TECNOLÓGICO

| Capa | Tecnología |
|------|-----------|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind 4 |
| **Auth** | Supabase Auth (email/password + magic link) |
| **Base de datos** | Supabase PostgreSQL + pgvector |
| **Realtime** | Supabase Realtime (comentarios) |
| **Storage** | Supabase Storage (EPUBs, portadas) |
| **Pagos** | Stripe (suscripciones + pagos únicos) |
| **Lector EPUB** | epub.js |
| **Estado global** | Zustand |
| **Fetching/cache** | TanStack Query (React Query) |
| **Email** | Resend |
| **Despliegue** | Vercel (frontend) + Supabase cloud |
| **Moneda** | MXN |

---

## 8. ESTRUCTURA DE CARPETAS

```
bookea/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (marketing)/
│   │   ├── page.tsx          # Landing page
│   │   └── pricing/
│   ├── (app)/
│   │   ├── dashboard/        # Biblioteca del usuario
│   │   ├── catalog/          # Catálogo completo
│   │   ├── book/[id]/        # Detalle de libro
│   │   ├── reader/[id]/      # Lector EPUB
│   │   └── profile/          # Perfil y logros
│   ├── admin/
│   │   ├── books/            # Gestión catálogo
│   │   ├── orders/           # Órdenes físicas
│   │   ├── inventory/        # Stock
│   │   ├── users/            # Gestión usuarios
│   │   └── marketing/        # Precios y promociones
│   └── api/
│       ├── webhooks/stripe/
│       └── share-quote/      # Genera imagen de cita
├── components/
│   ├── reader/               # Componentes del lector
│   ├── catalog/              # Cards, filtros, búsqueda
│   ├── community/            # Comentarios, reviews
│   ├── admin/                # Componentes del panel
│   └── ui/                   # Botones, modales, inputs
├── lib/
│   ├── supabase.ts
│   ├── stripe.ts
│   ├── epub/                 # Utilidades EPUB
│   └── utils.ts
├── hooks/                    # Custom hooks
├── stores/                   # Zustand stores
├── types/                    # TypeScript types
└── public/
```

---

## 9. AGENTES DE DESARROLLO

Estos son los agentes que van a construir la app:

| Agente | Herramienta | Responsabilidad |
|--------|-------------|-----------------|
| **Agente Backend** | Claude Code / Cursor | API routes, lógica de negocio, Stripe webhooks |
| **Agente Frontend** | Claude Code / Cursor | Componentes React, páginas, UI |
| **Agente DB** | Claude Code / Cursor | Esquemas Supabase, migraciones, RLS policies |
| **Agente Lector** | Claude Code / Cursor | Integración epub.js, sincronización progreso |
| **Agente Admin** | Claude Code / Cursor | Panel de administración completo |

**Flujo recomendado:**
1. DB → esquemas y migraciones primero
2. Auth → login/register con Supabase
3. Catálogo → CRUD de libros + panel admin básico
4. Pagos → Stripe integrado
5. Lector → epub.js + progreso
6. Comunidad → comentarios realtime
7. Gamificación → rachas, badges
8. Social → compartir citas, regalos

---

## 10. ENTORNO DE DESARROLLO

| Máquina | Uso |
|---------|-----|
| **Mac M1** | Frontend, UI, componentes |
| **Windows RTX 4050 15GB** | Modelos LLM locales con Ollama (Llama 3.1 8B) para features de IA |

---

## 11. MVP — PRIORIDADES

**Fase 1 (lanzar y cobrar):**
- Auth completo
- Catálogo básico
- Lector EPUB funcional
- Suscripción con Stripe
- Compra permanente
- Panel admin básico (subir libros, ver órdenes)
- Venta física con formulario de envío

**Fase 2 (retención):**
- Comentarios realtime
- Progreso y rachas
- Highlights y notas
- Reseñas y ratings

**Fase 3 (crecimiento):**
- Compartir cita con imagen
- Badges y gamificación
- Lista de deseos con alertas
- Regalos entre usuarios
- "También te puede gustar"

---

---

## 12. PWA (Progressive Web App)

Bookea debe funcionar como PWA para que los usuarios la instalen en su celular como app nativa.

### Funcionalidades PWA
- Instalable en iOS y Android desde el browser
- Ícono en pantalla de inicio
- Splash screen con branding de Bookea
- Lectura offline de libros ya descargados en caché
- Notificaciones push (para alertas de wishlist, nuevos títulos, rachas)

### Implementación
- `next-pwa` o `@ducanh2912/next-pwa` como wrapper de Next.js
- `manifest.json` con nombre, íconos, colores de la app
- Service Worker para cachear EPUBs ya abiertos
- Estrategia de caché: libros activos del usuario se cachean automáticamente

### Archivos necesarios
```
public/
├── manifest.json        # ya existe, completar
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── sw.js                # generado por next-pwa
```

### Prioridad
- Fase 2 — después del MVP funcional

---

*Documento generado: Marzo 2026*  
*Proyecto: Bookea — bookea.mx*