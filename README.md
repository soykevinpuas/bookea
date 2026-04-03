# 📚 Bookea

**Bookea** es una plataforma SaaS moderna diseñada para revolucionar la lectura digital. Permite a los usuarios leer libros (formato EPUB) de manera fluida directamente desde el navegador, interactuar con el contenido a través de subrayados y notas sincronizadas en la nube, y facilita la adquisición de copias físicas o licencias permanentes.

## Características Principales

- 📖 **Lector EPUB de Alta Fidelidad**: Integración con `epub.js` soportando modo scroll continuo, perfiles de tipografía personalizados, y temas dinámicos (Día, Noche, Navy, Retro).
- 🖍️ **Highlights y Notas Interactivos**: Selecciona texto en tiempo real, clasifícalo por colores, añade "sticky notes", y accede a ellos desde tu cuaderno virtual.
- 🎨 **Diseño Moderno (UI/UX)**: Interfaz construida con **Tailwind CSS V4**, modo oscuro progresivo adaptativo y componentes altamente responsivos (incluyendo Safe Area para PWA).
- 🔐 **Autenticación y Sesiones**: Login seguro respaldado por **Supabase Auth**.
- 💳 **Pagos Múltiples**: Sistema de compras y suscripciones recurrentes procesadas mediante **Stripe**.
- 🗄️ **Almacenamiento Desacoplado (Backend)**: Toda la interacción se sincroniza instantáneamente con una base de datos **PostgreSQL** administrada a través de Supabase.

## Stack Tecnológico 🛠️
- **Framework:** Next.js 15 (App Router)
- **Lenguaje:** TypeScript / React 19
- **Estilos:** Tailwind CSS V4
- **Backend/DB:** Supabase (PostgreSQL, Realtime, Storage)
- **Pagos:** Stripe (Suscripciones, Payment Intents)
- **Herramienta Lector:** epub.js

## Inicialización y Desarrollo

Instala las dependencias y arranca el entorno de desarrollo local:

```bash
npm install
npm run dev
```

La aplicación funcionará por defecto en [http://localhost:3000](http://localhost:3000).
Asegúrate de tener un archivo `.env.local` configurado con tus variables de `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, y tus claves de `STRIPE`.

## Documentación del Proyecto

El desarrollo progresivo, hitos completados y la filosofía técnica están regidos por nuestros archivos locales:
- `spec.md`: Especificaciones del Producto y Features.
- `bitacora.md`: Historial y Registro (Changelog) de Cambios.
- `rules.md`: Estándares de Código y Patrones de Arquitectura del proyecto.
