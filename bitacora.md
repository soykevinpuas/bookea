# 📓 Bitácora de Desarrollo - Bookea

Este documento registra el progreso histórico y lógico de construcción del proyecto Bookea. De acuerdo con la regla 13 del proyecto, cada sesión de desarrollo, arreglo o modificación estructural debe quedar registrada aquí.

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
