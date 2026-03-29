# 🎨 Guía de Experiencia y Diseño: Bookea

Bookea prioriza la inmersión del lector a través de una interfaz limpia, tipografías editoriales y una arquitectura adaptable.

## 1. Filosofía de Diseño
- **Inmersividad:** Minimizar distracciones para que el contenido sea el protagonista.
- **Glassmorphism:** Uso de capas translúcidas con desenfoque (`backdrop-blur`) para interfaces modernas y ligeras.
- **Animaciones Fluidas:** Transiciones suaves de página y efectos de hover dinámicos con `framer-motion`.

---

## 2. El Motor de Temas Dinámicos

Bookea implementa un sistema de 4 temas globales sincronizados con el lector:

### ☀️ Día (Light)
- **Fondo:** Gris muy suave (`bg-gray-50`) para reducir el brillo blanco.
- **Texto:** Negro puro para máximo contraste.
- **Uso:** Lectura en ambientes con mucha luz.

### 🌙 Noche (Dark)
- **Fondo:** Onyx / Negro profundo (`#0a0a0a`).
- **Texto:** Gris claro (`#e5e7eb`).
- **Uso:** Lectura nocturna y ahorro de batería en pantallas OLED.

### 📟 Terminal (Retro)
- **Estética:** Inspirada en computadoras clásicas y estética *Synthwave*.
- **Colores:** Fondo Negro (#0d1117) con acentos Verde Neón (#3fb950).
- **Uso:** Lectura técnica o estética retro-futurista.

### ⚓ Marina (Navy)
- **Estética:** Profesional y ejecutiva.
- **Colores:** Azul Marino Profundo (#0a0f1e) con acentos Indigo (#7986cb).
- **Uso:** Ambientes de trabajo o lectura seria.

---

## 3. Componentes Premium

### `BookCard3D`
- **Efecto:** Al pasar el ratón, la portada del libro escala y muestra un degradado inferior dinámico.
- **Adaptabilidad:** En dispositivos táctiles, el efecto se simplifica para asegurar fluidez.

### El Reader HUD (Overlays)
- **Mecánica:** Los controles de lectura desaparecen al leer y aparecen con un toque inteligente.
- **Configuración:** Panel lateral flotante con controles de tamaño de fuente (`80%` a `200%`) y tipografías (Nunito, Lora, Baskerville, OpenDyslexic).

---

## 4. Optimización Móvil (PWA)

Bookea está diseñado para sentirse como una app nativa:
- **Gestión de Notch (Safe Areas):** Uso de `env(safe-area-inset-*)` para que el contenido no se oculte tras la cámara o la barra de gestos.
- **Modo Standalone:** Splash screen personalizado y comportamiento sin barras de navegador.
- **Interacciones Táctiles:** Gestos optimizados para el paso de página y menús desplegables de fácil acceso con el pulgar.
