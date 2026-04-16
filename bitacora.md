# 📓 Bitácora de Desarrollo - Bookea

Este documento registra el progreso histórico y lógico de construcción del proyecto Bookea. De acuerdo con la regla 13 del proyecto, cada sesión de desarrollo, arreglo o modificación estructural debe quedar registrada aquí.

---

## [2026-04-15] - Mejoras de UI/UX y Navegación Premium
**Objetivo:** Elevar la percepción de calidad de la aplicación mediante animaciones, vistas optimizadas y navegación intuitiva.

### Añadido
- **Pantalla de Inicio (Splash Screen):** Animación de entrada con el logo de Bookea y efectos de brillo usando `framer-motion`. Configurada para mostrarse solo una vez por sesión (`sessionStorage`).
- **Vista de Cuadrícula Compacta:** Nuevo modo de visualización "Compacto" en Dashboard y Catálogo que prioriza las portadas (6-8 por fila en desktop, 3 en móvil).
- **Filtrado por Autor:** Implementación de un campo de búsqueda dedicado para autores en los filtros de búsqueda.
- **Feedback de Progreso:** Inclusión del símbolo `%` en los círculos de progreso para una lectura más clara del avance.
- **Estabilidad Offline:** Nueva página de fallback en el Service Worker para evitar bucles de redirección infinita cuando no hay red.

### Cambios y Mejoras
- **Rediseño de Navegación:** El botón "Explorar" fue renombrado a "**Catálogo**" y recibió un estilo de botón premium con sombras y gradientes.
- **Optimización de Lista:** Reducción del tamaño de los iconos en la vista de lista para un diseño más limpio y profesional.
- **Navegación del Lector:** Ajuste de la lógica del botón "Regresar" para redirigir siempre al Dashboard del usuario, optimizado para evitar retornos accidentales a la página de detalles.
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
