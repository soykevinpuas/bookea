# Guia UX/UI - Bookea

Bookea debe sentirse como una biblioteca digital premium y una herramienta operativa clara para admins/vendedores. La interfaz no debe mezclar marketing con pantallas de trabajo.

## 1. Temas

La app usa `next-themes` con estos temas:

- `light`: lectura clara.
- `dark`: modo nocturno base.
- `retro`: estilo terminal.
- `navy`: lectura seria/profesional.

`ReaderColorSync` sincroniza colores del lector con el tema activo.

## 2. Superficies Visuales

- Landing: `components/LandingHero.tsx` usa portadas reales y `FloatingBook3D`.
- Catalogo: filtros y cards orientados a compra/lectura rapida.
- Reader: HUD, paneles flotantes, temas, notas, subrayados y marcadores.
- Dashboard/perfil: informacion personal, biblioteca, progreso, ordenes y facturacion.
- Admin/vendedor: interfaces densas, orientadas a operacion, metricas, tablas y acciones.

## 3. Componentes Reutilizables

- `components/ui/*`: skeletons, card base, badges, coin balance, transiciones y onboarding.
- `components/community/*`: reviews, formulario y estrellas.
- `components/gamification/*`: rachas, monedas y quiz.
- `components/profile/*`: avatar y referidos.
- `components/book/*`: acciones especificas de libro.

Las carpetas `components/admin`, `components/catalog` y `components/reader` estan reservadas; hoy no contienen componentes implementados.

## 4. PWA y Movil

- `public/manifest.json` define instalacion standalone.
- `public/sw.js` maneja offline para EPUBs, portadas y fallback HTML.
- `app/layout.tsx` usa safe area en la navegacion inferior.
- `SplashScreen` y el HTML de splash evitan pantalla en blanco mientras hidrata React.

## 5. Reglas Practicas

- Usa iconos de `lucide-react` para acciones claras.
- No agregues landing pages cuando la tarea pide una pantalla operativa.
- En admin/vendedor prioriza densidad, tablas escaneables y acciones visibles.
- En lector evita controles que tapen texto por defecto.
- No documentes features dentro de la UI con textos largos; las instrucciones viven en docs.
- Si introduces visuales 3D o canvas, verifica que rendericen en desktop y movil.
