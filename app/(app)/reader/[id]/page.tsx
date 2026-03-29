"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useBook } from "@/hooks/useBooks";
import { useUserId } from "@/hooks/useUser";
import { getReadingProgress, saveReadingProgress } from "@/lib/reading";
import ePub, { Book, Rendition } from "epubjs";
import { Loader2, ArrowLeft, ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

// 4.2 - ReaderPage: Carga del visor de libros EPUB, interfaz HUD y persistencia de configuraciones de lectura local y servidor
export default function ReaderPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  // 4.2.1 - Referencias mutables para almacenar la instancia del libro, el renderizador y temporizadores
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Flag para evitar restaurar posición más de una vez (causa el "sticking" al scrollear)
  const hasRestoredPosition = useRef(false);
  // Debounce ref para no saturar Supabase con peticiones en cada evento de scroll
  const saveDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const { data: book, isLoading: loadingBook } = useBook(bookId);
  const { userId } = useUserId();

  // 4.2.2 - Estado React para gestionar preferencias visuales, cargas y UI del lector
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState<string>("sans");
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right" | "justify">("justify");
  const [textColor, setTextColor] = useState<string>("#ffffff");
  const { theme, setTheme } = useTheme();
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const themeRef = useRef<string | undefined>(theme);
  const fontRef = useRef<string>(fontFamily);
  const sizeRef = useRef<number>(fontSize);
  const alignRef = useRef<"left" | "center" | "right" | "justify">(textAlign);
  const colorRef = useRef<string>(textColor);

  // 4.2.2.1 - Colores disponibles para el texto del lector
  const textColors = [
    { name: "Negro", value: "#000000" },
    { name: "Sepia", value: "#f4ecd8" },
    { name: "Verde", value: "#3fb950" },
    { name: "Azul", value: "#60a5fa" },
    { name: "Rosa", value: "#f472b6" },
  ];

  // 4.2.2.2 - Validador de contraste entre texto y fondo
  const handleSetTextColor = (color: string) => {
    // Definir colores de fondo por tema
    const bgMap: Record<string, string> = {
      light: "#ffffff",
      dark: "#0a0a0a",
      retro: "#0d1117",
      navy: "#0a0f1e"
    };

    const currentBg = bgMap[theme || "light"];
    
    // Validación estricta para modo Claro (Día)
    if (theme === "light" && color !== "#000000") {
      toast.info("El modo claro solo acepta color negro en el texto para garantizar la lectura");
      return;
    }

    // Si el color es negro puro y el fondo es oscuro, o viceversa
    const isDarkBg = theme !== "light";
    const isBlackText = color === "#000000";
    
    if (isDarkBg && isBlackText) {
      toast.error("No se puede usar ese color de letra con ese fondo (Negro sobre Oscuro)");
      return;
    }

    if (!isDarkBg && color === "#ffffff") {
      toast.error("No se puede usar ese color de letra con ese fondo (Blanco sobre Blanco)");
      return;
    }

    setTextColor(color);
  };

  // 4.2.2.3 - Validador de cambio de tema basado en contraste
  const handleSetTheme = (newTheme: string) => {
    const isNewDark = newTheme !== "light";
    const isCurrentBlackText = textColor === "#000000";
    const isCurrentWhiteText = textColor === "#ffffff";

    if (isNewDark && isCurrentBlackText) {
      toast.error("No se puede cambiar a este fondo con letra negra");
      return;
    }

    if (newTheme === "light" && isCurrentWhiteText) {
      toast.error("No se puede cambiar a este fondo con letra blanca");
      return;
    }

    setTheme(newTheme);
  };

  // 4.2.4 - Gestores del tiempo de inactividad para ocultar la interfaz HUD (Inactivity Timeout)
  const resetControlsTimeout = () => {
    setShowControls(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setShowControls(false), 4000);
  };

  const toggleControls = () => {
    setShowControls(prev => {
      const nextState = !prev;
      if (nextState) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setShowControls(false), 4000);
      } else {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
      return nextState;
    });
  };

  useEffect(() => {
    const handleMouseMove = () => resetControlsTimeout();
    document.addEventListener("mousemove", handleMouseMove);
    resetControlsTimeout();
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // 4.2.5 - Inicialización Central del Motor epub.js y configuración DOM
  useEffect(() => {
    if (!book?.epub_url || !viewerRef.current || !userId) return;

    const initEpub = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const epubUrl = book.epub_url as string;
        const bookInstance = ePub(epubUrl, {
          openAs: "epub"
        });
        bookRef.current = bookInstance;

        const viewerElement = viewerRef.current as Element;
        
        // 4.2.5.1 - Configuración base del Rendition con flujo responsivo nativo
        const rendition = bookInstance.renderTo(viewerElement, {
          width: "100%",
          height: "100%",
          spread: "none",
          manager: "continuous",
          flow: "scrolled",
          allowScriptedContent: true,
        });

        // 4.2.5.2 - Inyección de CSS interno (Hooks) para asegurar diseño base constante (saltando estilos del autor/epub original)
        if (rendition.hooks && rendition.hooks.content) {
          rendition.hooks.content.register((contents: any) => {
            if (!contents || !contents.document) return;
            
            const style = contents.document.createElement("style");
            style.innerHTML = `
              @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400..700;1,400..700&family=Nunito:ital,wght@0,200..1000;1,200..1000&display=swap');
              
              /* Fallback para OpenDyslexic si no está instalada localmente */
              @font-face {
                font-family: 'OpenDyslexic';
                src: url('https://antijingoist.github.io/opendyslexic/compiled/OpenDyslexic-Regular.otf');
              }

              html, body {
                height: auto;
                min-height: 100%;
              }
              body {
                line-height: 1.8 !important;
                padding: 20px 5% 20px !important;
                padding-left: max(5%, env(safe-area-inset-left)) !important;
                padding-right: max(5%, env(safe-area-inset-right)) !important;
                padding-top: max(20px, env(safe-area-inset-top)) !important;
                padding-bottom: max(20px, env(safe-area-inset-bottom)) !important;
                max-width: 800px !important;
                margin: 0 auto !important;
                transition: color 0.3s ease, background-color 0.3s ease, font-family 0.2s ease;
                /* --bookea-text-color se actualiza vía override() para cada tema */
                color: var(--bookea-text-color, #171717) !important;
                font-family: var(--bookea-font-family, 'Inter', -apple-system, sans-serif) !important;
                box-sizing: border-box;
                overflow-x: hidden;
              }
              
              /* Ajuste responsive para pantallas grandes */
              @media (min-width: 1024px) {
                body {
                  padding: 20px 10% 20px !important;
                }
              }
              p, li, td, blockquote {
                margin-bottom: 1.5em !important;
                text-align: var(--bookea-text-align, justify) !important;
                color: var(--bookea-text-color, #171717) !important;
                font-family: var(--bookea-font-family, 'Inter', -apple-system, sans-serif) !important;
                opacity: 0.9;
              }
              /* Herencia de fuente en todos los elementos de texto */
              span, div, a, em, strong, i, b, section, article {
                font-family: inherit !important;
              }
              h1, h2, h3, h4, h5, h6 {
                font-weight: 700 !important;
                margin-top: 2em !important;
                margin-bottom: 1em !important;
                color: var(--bookea-text-color, #171717) !important;
                font-family: var(--bookea-font-family, 'Inter', -apple-system, sans-serif) !important;
                text-align: center !important;
              }
              img {
                max-width: 100% !important;
                height: auto !important;
                border-radius: 8px !important;
              }
            `;
            contents.document.head.appendChild(style);
            
            // 4.2.5.3 - Event Listener del Iframe: Detecta clicks en toda la hoja para accionar la interfaz HUD central, en lugar de pasar de página
            contents.document.documentElement.addEventListener('click', (e: MouseEvent) => {
              toggleControls();
            });
          });
        }


        // 4.2.6 - Gestor de inyección de estilos explícitos (overrides) para temas personalizados
        // Siempre establece --bookea-text-color para que el hook CSS resuelva el valor correcto
        const updateTheme = () => {
          if (themeRef.current === "light") {
            rendition.themes.override("color", "#171717");
            rendition.themes.override("background", "#ffffff");
            rendition.themes.override("--bookea-text-color", "#171717");
          } else if (themeRef.current === "dark") {
            rendition.themes.override("color", colorRef.current);
            rendition.themes.override("background", "#0a0a0a");
            rendition.themes.override("--bookea-text-color", colorRef.current);
          } else if (themeRef.current === "retro") {
            rendition.themes.override("color", colorRef.current);
            rendition.themes.override("background", "#0d1117");
            rendition.themes.override("--bookea-text-color", colorRef.current);
          } else if (themeRef.current === "navy") {
            rendition.themes.override("color", colorRef.current);
            rendition.themes.override("background", "#0a0f1e");
            rendition.themes.override("--bookea-text-color", colorRef.current);
          }
        };

        updateTheme();
        
        // Aplicar fuente via CSS variable (más confiable que rendition.themes.font() en scroll mode)
        const applyFont = (family: string) => {
          let fontStack = "Inter, -apple-system, sans-serif";
          if (family === "serif") fontStack = "Georgia, 'Times New Roman', serif";
          if (family === "mono") fontStack = "'Courier New', Courier, monospace";
          if (family === "baskerville") fontStack = "'Libre Baskerville', serif";
          if (family === "dyslexic") fontStack = "'OpenDyslexic', 'Comic Sans MS', sans-serif";
          if (family === "lora") fontStack = "'Lora', serif";
          if (family === "nunito") fontStack = "'Nunito', sans-serif";
          
          rendition.themes.override("font-family", fontStack);
          rendition.themes.override("--bookea-font-family", fontStack);
        };
        
        rendition.themes.fontSize(`${sizeRef.current}px`);
        renditionRef.current = rendition;

        await bookInstance.ready;
        
        // 4.2.7 - Lógica asíncrona de restauración de localizaciones (CFI) y cálculo de porcentajes
        const savedProgress = await getReadingProgress(bookId, userId);
        
        if (savedProgress?.cfi_position) {
          await rendition.display(savedProgress.cfi_position);
        } else {
          await rendition.display();
        }

        rendition.on("relocated", (location: { start: { cfi: string; percentage: number | string } }) => {
          const percent = bookInstance.locations.length() > 0
            ? bookInstance.locations.percentageFromCfi(location.start.cfi)
            : Number(location.start.percentage || 0);
          setProgress(percent * 100);

          // Debounce del guardado: espera 1.5s de quietud antes de guardar en Supabase
          // Esto evita el efecto "sticking" donde el guardado pelea con el scroll del usuario
          if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
          saveDebounceRef.current = setTimeout(() => {
            saveReadingProgress(bookId, userId, location.start.cfi, percent * 100);
          }, 1500);
        });

        const generateLocations = () => {
          bookInstance.locations.generate(1600).catch((err: unknown) => {
            console.warn("EPUB Location generation failed:", err);
          });
        };

        if ('requestIdleCallback' in window) {
          (window as Window & typeof globalThis & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(generateLocations);
        } else {
          setTimeout(generateLocations, 1000);
        }

        rendition.on("rendered", () => {
          setIsLoading(false);
        });

        // 4.2.7.1 - Manejo de resize para actualizar el rendition al cambiar orientación o tamaño de ventana
        const handleResize = () => {
          if (renditionRef.current) {
            const viewer = viewerRef.current;
            if (viewer) {
              renditionRef.current.resize(viewer.clientWidth, viewer.clientHeight);
            }
          }
        };
        
        bookInstance.on("openFailed", (err: unknown) => {
          console.error("EPUB Open Failed:", err);
          setError("No se pudo abrir el archivo EPUB. Es posible que el archivo esté dañado o el formato no sea compatible.");
          setIsLoading(false);
        });

      } catch (err) {
        console.error("Error loading EPUB (Catch Block):", err);
        setError("Error al cargar el libro digital. Es posible que el archivo esté corrupto o incompleto.");
        setIsLoading(false);
      }

    };

    initEpub();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      renditionRef.current?.clear();
      renditionRef.current = null;
      bookRef.current?.destroy();
      bookRef.current = null;
      hasRestoredPosition.current = false;
    };
  }, [book?.epub_url, bookId, userId]);

  // 4.2.8 - Efecto secundario (Side-effect) para capturar navegación con flechas del teclado
  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        renditionRef.current?.prev().catch(err => console.warn("EPUB key prev error:", err));
        resetControlsTimeout();
      }
      if (e.key === 'ArrowRight') {
        renditionRef.current?.next().catch(err => console.warn("EPUB key next error:", err));
        resetControlsTimeout();
      }
    };
    document.addEventListener('keyup', handleKeyUp);
    return () => document.removeEventListener('keyup', handleKeyUp);
  }, []);

  // 4.2.8.1 - Efecto para manejar cambio de tamaño de ventana y orientación
  useEffect(() => {
    const handleResize = () => {
      if (renditionRef.current && viewerRef.current) {
        renditionRef.current.resize(viewerRef.current.clientWidth, viewerRef.current.clientHeight);
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", () => {
      setTimeout(handleResize, 150);
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  useEffect(() => {
    if (renditionRef.current) {
      renditionRef.current.themes.fontSize(`${fontSize}px`);
    }
    sizeRef.current = fontSize;
    localStorage.setItem("bookea-font-size", fontSize.toString());
  }, [fontSize]);

  const [mounted, setMounted] = useState(false);

  // 4.2.9 - Efecto de montura para cargar preferencias de tema y tipografía previas del usuario desde localStorage
  useEffect(() => {
    const savedSize = localStorage.getItem("bookea-font-size");
    if (savedSize && !isNaN(parseInt(savedSize, 10))) {
      setFontSize(parseInt(savedSize, 10));
      sizeRef.current = parseInt(savedSize, 10);
    }

    const savedFont = localStorage.getItem("bookea-font-family");
    if (savedFont === "sans" || savedFont === "serif" || savedFont === "mono") {
      setFontFamily(savedFont);
      fontRef.current = savedFont;
    }

    const savedAlign = localStorage.getItem("bookea-text-align");
    if (savedAlign === "left" || savedAlign === "center" || savedAlign === "right" || savedAlign === "justify") {
      setTextAlign(savedAlign);
      alignRef.current = savedAlign;
    }

    const savedColor = localStorage.getItem("bookea-text-color");
    if (savedColor) {
      setTextColor(savedColor);
      colorRef.current = savedColor;
    }

    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !theme) return;
    if (renditionRef.current) {
      if (theme === "light") {
        renditionRef.current.themes.override("color", "#171717");
        renditionRef.current.themes.override("background", "#ffffff");
        renditionRef.current.themes.override("--bookea-text-color", "#171717");
      } else if (theme === "dark") {
        renditionRef.current.themes.override("color", colorRef.current);
        renditionRef.current.themes.override("background", "#0a0a0a");
        renditionRef.current.themes.override("--bookea-text-color", colorRef.current);
      } else if (theme === "retro") {
        renditionRef.current.themes.override("color", colorRef.current);
        renditionRef.current.themes.override("background", "#0d1117");
        renditionRef.current.themes.override("--bookea-text-color", colorRef.current);
      } else if (theme === "navy") {
        renditionRef.current.themes.override("color", colorRef.current);
        renditionRef.current.themes.override("background", "#0a0f1e");
        renditionRef.current.themes.override("--bookea-text-color", colorRef.current);
      }
    }
    themeRef.current = theme;
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    if (renditionRef.current) {
      // Aplicar fuente via override() + CSS variable para mayor compatibilidad con epubjs en modo scroll
      const applyFont = (family: string) => {
        let fontStack = "Inter, -apple-system, sans-serif";
        if (family === "serif") fontStack = "Georgia, 'Times New Roman', serif";
        if (family === "mono") fontStack = "'Courier New', Courier, monospace";
        if (family === "baskerville") fontStack = "'Libre Baskerville', serif";
        if (family === "dyslexic") fontStack = "'OpenDyslexic', 'Comic Sans MS', sans-serif";
        if (family === "lora") fontStack = "'Lora', serif";
        if (family === "nunito") fontStack = "'Nunito', sans-serif";
        
        renditionRef.current!.themes.override("font-family", fontStack);
        renditionRef.current!.themes.override("--bookea-font-family", fontStack);
      };
      applyFont(fontFamily);
    }
    fontRef.current = fontFamily;
    localStorage.setItem("bookea-font-family", fontFamily);
  }, [fontFamily, mounted]);

  useEffect(() => {
    if (!mounted) return;
    if (renditionRef.current) {
      renditionRef.current.themes.override("--bookea-text-align", textAlign);
      renditionRef.current.themes.override("align", textAlign);
      renditionRef.current.themes.override("textAlign", textAlign);
    }
    alignRef.current = textAlign;
    localStorage.setItem("bookea-text-align", textAlign);
  }, [textAlign, mounted]);

  useEffect(() => {
    if (!mounted) return;
    if (renditionRef.current) {
      // En modo día forzar siempre negro (ignorar selección de color)
      const effectiveColor = theme === "light" ? "#171717" : textColor;
      renditionRef.current.themes.override("--bookea-text-color", effectiveColor);
      renditionRef.current.themes.override("color", effectiveColor);
    }
    colorRef.current = textColor;
    localStorage.setItem("bookea-text-color", textColor);
    localStorage.setItem("bookea-reader-color", textColor);
    document.documentElement.style.setProperty("--bookea-reader-color", textColor);
    document.documentElement.setAttribute("data-reader-color", "true");
  }, [textColor, mounted, theme]);

  // 4.2.9.1 - Controladores de paginación explícitos (Adelante/Atrás) operados mediante los botones HUD
  const handlePrev = () => {
    renditionRef.current?.prev().catch(err => console.warn("EPUB prev error:", err));
    resetControlsTimeout();
  };

  const handleNext = () => {
    renditionRef.current?.next().catch(err => console.warn("EPUB next error:", err));
    resetControlsTimeout();
  };

  if (loadingBook) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0a] retro:bg-[#0d1117]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-[#0a0a0a] retro:bg-[#0d1117] text-white px-4 text-center">
        <div className="text-red-500 mb-4 text-4xl">⚠️</div>
        <h2 className="text-xl font-bold mb-2">Error al cargar libro</h2>
        <p className="text-white/60 mb-6 max-w-md">{typeof error === 'string' ? error : "Ocurrió un error inesperado al inicializar epub.js"}</p>
        <Link href={`/book/${bookId}`} className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition">
          Volver a detalles
        </Link>
      </div>
    );
  }

  if (!book || !book.epub_url) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-[#0a0a0a] retro:bg-[#0d1117]">
        <div className="text-xl text-gray-900 dark:text-gray-100 font-medium">Libro no disponible</div>
        <p className="text-gray-500 dark:text-gray-400">Este libro no pudo ser encontrado o no tiene versión digital.</p>
        <Link href={`/book/${bookId}`} className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition">
          Volver a detalles
        </Link>
      </div>
    );
  }

  // 4.2.10 - Cálculo computado en tiempo real de paletas de color HUD y Glassmorphism (Basado en Modo Día, Noche, o Retro)
  const isDark = theme === 'dark';
  const isRetro = theme === 'retro';
  const isNavy = theme === 'navy';
  
  const iconBgClass = isDark ? 'bg-white/10 hover:bg-white/20' : isRetro ? 'bg-[#3fb950]/10 hover:bg-[#3fb950]/20' : isNavy ? 'bg-[#7986cb]/10 hover:bg-[#7986cb]/20' : 'bg-black/5 hover:bg-black/10';
  const panelBgClass = isDark ? 'bg-white/5' : isRetro ? 'bg-[#3fb950]/5 border border-[#3fb950]/10' : isNavy ? 'bg-[#7986cb]/5 border border-[#7986cb]/10' : 'bg-black/5';
  const activeBtnClass = isDark ? 'bg-white/10 shadow-sm font-medium' : isRetro ? 'bg-[#3fb950]/20 shadow-sm font-medium text-[#3fb950]' : isNavy ? 'bg-[#7986cb]/20 shadow-sm font-medium text-[#7986cb]' : 'bg-white shadow-sm font-medium';
  const bgColors = isDark ? 'bg-[#0a0a0a] text-white' : isRetro ? 'bg-[#0d1117] text-[#3fb950]' : isNavy ? 'bg-[#0a0f1e] text-[#e8eaf6]' : 'bg-[#ffffff] text-black';

  return (
    <div className={`h-[100dvh] w-full flex flex-col overflow-hidden transition-colors duration-500 ${bgColors}`}>
      
      {/* 4.2.11 - Barra de Navegación Superior (Top HUD) - Glassmorphism dinámico */}
      <div 
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-4 pt-safe transition-all duration-300 pointer-events-auto ${
            showControls ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        } ${isDark ? 'bg-black/60 backdrop-blur-xl border-b border-white/10' : 
            isRetro ? 'bg-[#0d1117]/90 backdrop-blur-xl border-b border-[#3fb950]/20' : 
            isNavy ? 'bg-[#0a0f1e]/90 backdrop-blur-xl border-b border-[#7986cb]/20' :
            'bg-white/70 backdrop-blur-xl border-b border-black/5'} shadow-sm`}
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href={`/book/${bookId}`}
            className={`p-2 rounded-full transition ${iconBgClass}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold truncate max-w-[150px] sm:max-w-md">
              {book.title}
            </h1>
            <span className="text-xs opacity-60">por {book.author}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 relative">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2.5 rounded-full transition-colors ${showSettings ? (isRetro ? 'bg-[#3fb950]/20 text-[#3fb950]' : 'bg-black/10 text-blue-500') : iconBgClass}`}
          >
            <Settings2 className="w-5 h-5" />
          </button>

          {showSettings && (
            <div className={`absolute top-14 right-0 w-72 p-4 rounded-2xl shadow-2xl border animate-in fade-in slide-in-from-top-4 duration-200 ${
              isDark ? 'bg-[#1a1a1a] border-white/10 text-white' : 
              isRetro ? 'bg-[#0d1117] border-[#3fb950]/30 text-[#3fb950]' :
              isNavy ? 'bg-[#0a1422] border-[#7986cb]/30 text-[#c5cae9]' :
              'bg-white border-black/5 text-gray-900'
            }`}>
              <div className="mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider opacity-60 mb-2">Tipografía</h3>
                <div className={`grid grid-cols-3 gap-1.5 p-1 rounded-lg ${panelBgClass}`}>
                  <button onClick={() => setFontFamily("sans")} className={`py-1.5 text-xs rounded-md transition-colors ${fontFamily === "sans" ? activeBtnClass : "opacity-60 hover:opacity-100"}`}>Sans</button>
                  <button onClick={() => setFontFamily("serif")} className={`py-1.5 text-xs rounded-md transition-colors font-serif ${fontFamily === "serif" ? activeBtnClass : "opacity-60 hover:opacity-100"}`}>Serif</button>
                  <button onClick={() => setFontFamily("mono")} className={`py-1.5 text-xs rounded-md transition-colors font-mono ${fontFamily === "mono" ? activeBtnClass : "opacity-60 hover:opacity-100"}`}>Mono</button>
                  <button onClick={() => setFontFamily("baskerville")} className={`py-1.5 text-xs rounded-md transition-colors ${fontFamily === "baskerville" ? activeBtnClass : "opacity-60 hover:opacity-100"}`} style={{ fontFamily: "'Libre Baskerville', serif" }}>Baskerville</button>
                  <button onClick={() => setFontFamily("lora")} className={`py-1.5 text-xs rounded-md transition-colors ${fontFamily === "lora" ? activeBtnClass : "opacity-60 hover:opacity-100"}`} style={{ fontFamily: "'Lora', serif" }}>Lora</button>
                  <button onClick={() => setFontFamily("nunito")} className={`py-1.5 text-xs rounded-md transition-colors ${fontFamily === "nunito" ? activeBtnClass : "opacity-60 hover:opacity-100"}`} style={{ fontFamily: "Nunito, sans-serif" }}>Nunito</button>
                  <button onClick={() => setFontFamily("dyslexic")} className={`py-1.5 text-xs rounded-md transition-colors col-span-3 ${fontFamily === "dyslexic" ? activeBtnClass : "opacity-60 hover:opacity-100"}`} style={{ fontFamily: "OpenDyslexic, sans-serif" }}>OpenDyslexic (Accesible)</button>
                </div>
              </div>

              {/* 4.2.13 - Submenú Renderizado: Controles A- / A+ incrementales */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider opacity-60 mb-2">Tamaño de texto</h3>
                <div className={`flex items-center justify-between gap-2 p-1 rounded-lg ${panelBgClass}`}>
                  <button onClick={() => setFontSize((s) => Math.max(12, s - 2))} className={`flex-1 py-1.5 flex justify-center rounded-md transition-colors ${iconBgClass}`}>A-</button>
                  <span className="text-sm font-medium opacity-80">{fontSize}px</span>
                  <button onClick={() => setFontSize((s) => Math.min(32, s + 2))} className={`flex-1 py-1.5 flex justify-center rounded-md transition-colors ${iconBgClass}`}>A+</button>
                </div>
              </div>

              {/* 4.2.14 - Submenú Renderizado: Selectores de paletas de inyección CSS profunda */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider opacity-60 mb-2">Tema</h3>
                <div className={`flex gap-1.5 p-1 rounded-lg ${panelBgClass}`}>
                  <button onClick={() => handleSetTheme("light")} className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${theme === "light" ? "bg-white shadow-sm font-medium text-black" : "opacity-60 hover:opacity-100"}`}>Día</button>
                  <button onClick={() => handleSetTheme("dark")} className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${theme === "dark" ? "bg-white/10 shadow-sm font-medium text-white" : "opacity-60 hover:opacity-100"}`}>Noche</button>
                  <button onClick={() => handleSetTheme("retro")} className={`flex-1 py-1.5 text-sm rounded-md transition-colors font-mono ${theme === "retro" ? "bg-[#3fb950]/20 shadow-sm font-medium text-[#3fb950]" : "opacity-60 hover:opacity-100"}`}>Retro</button>
                  <button onClick={() => handleSetTheme("navy")} className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${theme === "navy" ? "bg-[#7986cb]/20 shadow-sm font-medium text-[#7986cb]" : "opacity-60 hover:opacity-100"}`}>Navy</button>
                </div>
              </div>

              {/* 4.2.15 - Submenú Renderizado: Selector de justificación del texto */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider opacity-60 mb-2">Alineación</h3>
                <div className={`flex gap-1.5 p-1 rounded-lg ${panelBgClass}`}>
                  <button onClick={() => setTextAlign("left")} className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${textAlign === "left" ? activeBtnClass : "opacity-60 hover:opacity-100"}`}>Izq</button>
                  <button onClick={() => setTextAlign("center")} className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${textAlign === "center" ? activeBtnClass : "opacity-60 hover:opacity-100"}`}>Centro</button>
                  <button onClick={() => setTextAlign("right")} className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${textAlign === "right" ? activeBtnClass : "opacity-60 hover:opacity-100"}`}>Der</button>
                  <button onClick={() => setTextAlign("justify")} className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${textAlign === "justify" ? activeBtnClass : "opacity-60 hover:opacity-100"}`}>Just</button>
                </div>
              </div>

              {/* 4.2.16 - Submenú Renderizado: Selector de color de texto */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider opacity-60 mb-2">Color de texto</h3>
                <div className="flex gap-2 justify-between">
                  {textColors.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => handleSetTextColor(color.value)}
                      className={`w-8 h-8 rounded-full transition-all border-2 no-retro-override flex items-center justify-center ${
                        textColor === color.value 
                          ? isRetro 
                            ? 'border-[#3fb950] scale-110 shadow-[0_0_10px_rgba(63,185,80,0.5)]' 
                            : isDark
                              ? 'border-white scale-110'
                              : 'border-black scale-110'
                          : 'border-transparent hover:border-gray-400'
                      }`}
                      style={{ 
                        '--dot-bg': color.value,
                        backgroundColor: color.value,
                        boxShadow: textColor === color.value 
                          ? isRetro 
                            ? `0 0 0 2px #0d1117, 0 0 8px ${color.value}` 
                            : isDark
                              ? `0 0 0 2px #121212, 0 0 0 4px ${color.value}`
                              : `0 0 0 2px #ffffff, 0 0 0 4px ${color.value}`
                          : 'none'
                      } as any}
                    >
                      <div 
                        className="w-full h-full rounded-full no-retro-override" 
                        style={{ backgroundColor: color.value } as any} 
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4.2.15 - Ventana principal de visualización del objeto renderizado (Viewport) */}
      <div 
        className="flex-1 relative w-full h-full pt-20 pb-20"
        onClick={() => toggleControls()}
      >
        {isLoading && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center z-10 ${bgColors}`}>
            <Loader2 className={`w-10 h-10 animate-spin mb-4 ${isRetro ? 'text-[#3fb950]' : 'text-blue-500'}`} />
            <span className="text-sm opacity-60 font-medium tracking-wide">Preparando libro...</span>
          </div>
        )}

        {error && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center z-10 px-6 text-center ${bgColors}`}>
            <div className="text-red-500 mb-2 text-2xl">⚠️</div>
            <div className="text-lg font-medium mb-4">{typeof error === 'string' ? error : "Error al cargar el libro"}</div>
            <Link 
              href="/dashboard"
              className={`px-6 py-2 rounded-lg transition-colors ${
                isRetro ? 'bg-[#3fb950]/20 text-[#3fb950] border border-[#3fb950]/50 hover:bg-[#3fb950]/30' : 
                'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Volver a la biblioteca
            </Link>
          </div>
        )}

        {/* 4.2.16 - Div nativo puro donde ePubJS monta su Iframe interno */}
        <div ref={viewerRef} className="relative w-full h-full cursor-pointer" />
      </div>

      {/* 4.2.17 - Barra inferior central (Bottom HUD) de navegación de hojas y rastreo de progreso porcentual estricto */}
      <div 
        className={`fixed bottom-0 left-0 right-0 z-50 flex flex-col px-4 sm:px-6 py-4 pb-safe transition-all duration-300 pointer-events-auto ${
            showControls ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        } ${isDark ? 'bg-black/60 backdrop-blur-xl border-t border-white/10' : 
            isRetro ? 'bg-[#0d1117]/90 backdrop-blur-xl border-t border-[#3fb950]/20' : 
            isNavy ? 'bg-[#0a0f1e]/90 backdrop-blur-xl border-t border-[#7986cb]/20' :
            'bg-white/70 backdrop-blur-xl border-t border-black/5'} shadow-[0_-4px_20px_rgba(0,0,0,0.05)]`}
      >
        <div className="flex items-center justify-between max-w-4xl mx-auto w-full gap-2 sm:gap-4">
          <button
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className={`p-2 sm:p-3 rounded-full transition-colors ${iconBgClass}`}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="flex-1 flex flex-col items-center gap-1 sm:gap-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest opacity-60">
              {progress > 0 ? `${progress.toFixed(1)}% Leído` : "Iniciando"}
            </span>
            <div className={`w-full rounded-full h-1 sm:h-1.5 overflow-hidden ${isDark ? 'bg-white/20' : isRetro ? 'bg-[#3fb950]/20' : isNavy ? 'bg-[#7986cb]/20' : 'bg-black/10'}`}>
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out ${
                  isRetro ? 'bg-[#3fb950]' : isNavy ? 'bg-[#7986cb]' : 'bg-blue-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className={`p-2 sm:p-3 rounded-full transition-colors ${iconBgClass}`}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
