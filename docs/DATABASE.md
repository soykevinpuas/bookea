# 🗄️ Arquitectura de Datos: Bookea

Bookea utiliza **Supabase (PostgreSQL)** como motor de base de datos, aprovechando sus capacidades de tiempo real y seguridad a nivel de fila (RLS).

## 1. Entidades Principales

### 👤 Usuarios y Perfiles
- **`public.users`:** Extiende la autenticación de Supabase. Almacena el correo y el rol (`free`, `subscriber`, `admin`).
- **`public.profiles`:** Información extendida del usuario (avatar, biografía, rachas de lectura). Se crea automáticamente mediante un *Trigger* al registrarse.

### 📚 Contenido y Acceso
- **`public.books`:** El corazón del catálogo. Almacena metadatos, URLs de portadas/EPUBs y precios (digital/físico).
- **`public.user_books`:** Tabla de unión que gestiona quién tiene acceso a qué libro y bajo qué modalidad (`subscription`, `permanent`, `gift`).
- ~~**`public.subscription_credits`:**~~ Eliminada en migración 019. El modelo migró a acceso ilimitado por suscripción.

### 📖 Progreso e Interacción
- **`public.reading_progress`:** Guarda la posición exacta (CFI) y el porcentaje de lectura por libro/usuario.
- **`public.highlights`:** Almacena subrayados y notas personales dentro del texto.
- **`public.reviews` y `public.comments`:** Sistema social para calificar libros y comentar con soporte para "Likes".

### 🛒 E-commerce y Fidelización (Próxima Implementación)
La infraestructura de datos está preparada para soportar el módulo de comercio electrónico:
- **`public.orders_physical`:** Registro de pedidos de libros físicos.
- **`public.discounts`:** Gestión de ofertas y cupones.
- **`public.wishlist`:** Lista de deseos personal.
- **`public.badges` y `public.user_badges`:** Gamificación para recompensar hitos de lectura.

---

## 2. Seguridad y Privacidad (RLS)

Bookea implementa **Row Level Security** en todas sus tablas para asegurar que:
- Los usuarios **solo** puedan ver sus propios registros (progreso, pedidos, perfil privado).
- Los libros activos sean visibles para todos, pero la gestión (crear/editar/borrar) esté reservada para el rol `admin`.
- El acceso al contenido real (`epub_url`) esté protegido mediante políticas que verifican la existencia de un registro en `user_books`.

---

## 3. Automatizaciones (Triggers & Functions)

### `handle_new_user()`
Función en `plpgsql` que se ejecuta automáticamente tras cada registro exitoso en Supabase Auth.
1. Crea la entrada en `public.users`.
2. Inicializa el perfil en `public.profiles`.

---

## 4. Optimización (Índices)
Se han implementado índices estratégicos en columnas de alta consulta (`user_id`, `book_id`, `status`) para garantizar que la aplicación responda en milisegundos incluso con miles de registros.
