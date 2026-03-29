# 📓 Bitácora de Desarrollo - Bookea

Este documento registra el progreso histórico y lógico de construcción del proyecto Bookea. De acuerdo con la regla 13 del proyecto, cada sesión de desarrollo, arreglo o modificación estructural debe quedar registrada aquí.

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

---
