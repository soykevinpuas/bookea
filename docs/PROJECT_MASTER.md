# 📘 Proyecto Bookea: Plataforma SaaS de Lectura Premium

## 1. Visión General
**Bookea**  es una solución SaaS (Software as a Service) de vanguardia diseñada para ofrecer una experiencia de lectura digital de alta fidelidad. Combina la elegancia del diseño editorial clásico con herramientas modernas de Inteligencia Artificial y una arquitectura técnica escalable. 

### Propuesta de Valor
- **Lectura sin Distracciones:** Interfaz minimalista y personalizable.
- **Aprendizaje Aumentado:** Integración con IA para tutoría contextual y definiciones.
- **Ubicuidad:** Experiencia PWA (Progressive Web App) fluida en cualquier dispositivo.
- **Ecosistema SaaS:** Gestión completa de suscripciones y acceso por niveles.

---

## 2. Stack Tecnológico (Core)

| Capa | Tecnología | Razón de Elección |
| :--- | :--- | :--- |
| **Framework** | Next.js 15 (App Router) | Rendimiento, SEO y Server Components. |
| **Lenguaje** | TypeScript | Tipado estricto para un mantenimiento robusto. |
| **Base de Datos** | Supabase (PostgreSQL) | Escalabilidad, Row Level Security (RLS) y Realtime. |
| **Estilos** | Tailwind CSS 4 | Diseño atómico y sistema de temas ultrarrápido. |
| **IA** | Gemini 1.5 Flash | Procesamiento de lenguaje natural de baja latencia. |
| **Pagos (Fase 2)** | Stripe Billing | Estándar de la industria para cobros recurrentes (Integración preparada). |

---

## 3. Funcionalidades Destacadas

### 📖 El Lector Inteligente
Módulo central construido sobre `epubjs`, optimizado para una lectura inmersiva:
- **Modos de Visualización:** Soporte para modo continuo (scrolled) y paginado.
- **Personalización Dinámica:** Ajuste de tamaño de fuente, interlineado y margen en tiempo real.
- **Tipografía de Grado Editorial:** Libre Baskerville, Lora, Nunito y OpenDyslexic.
- **Validación de Contraste:** Algoritmos que aseguran legibilidad según el estándar WCAG.

### 🎨 Motor de Tematización Cuádruple
Bookea ofrece una experiencia visual única con 4 identidades distintas:
1. **Día (Light):** Paleta gris suave para reducir la fatiga ocular.
2. **Noche (Dark):** Modo oscuro profundo para lectura nocturna.
3. **Terminal (Retro):** Estética neón retro-futurista (verde/negro).
4. **Ancla (Navy):** Diseño profesional en azul marino profundo.

### 🤖 IA Companion
- **Tutor Contextual:** Capacidad de preguntar a la IA sobre fragmentos específicos del texto.
- **Diccionario Inteligente:** Definiciones inmediatas y contextuales integradas en el flujo de lectura.

### 🛒 E-commerce y Fidelización (Próxima Implementación)
La infraestructura de datos está preparada para soportar el módulo de comercio electrónico:
- **`public.orders_physical`:** Registro de pedidos de libros físicos.
- **`public.discounts`:** Gestión de ofertas y cupones.
- **`public.wishlist`:** Lista de deseos personal.

### 💳 Gestión SaaS & PWA
- **Stripe Checkout:** Flujo de compra de libros físicos y digitales.
- **Billing Portal:** Autogestión de suscripciones para el usuario.
- **Instalación Nativa:** Funciona como una app de escritorio o móvil mediante PWA.

---

## 4. Diferenciadores Técnicos
- **Seguridad por Niveles:** Middleware que protege el contenido según el plan del usuario (Free vs. Premium).
- **Safe Area Design:** Optimización específica para teléfonos con "Notch" y barras de gestos.
- **Arquitectura de Webhooks:** Sincronización robusta en tiempo real con proveedores externos (Stripe).

---
*Este documento es una guía viva del estado actual de Bookea y se actualiza con cada hito de desarrollo.*
