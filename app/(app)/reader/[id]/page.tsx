"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useBook } from "@/hooks/useBooks";
import { useUserId } from "@/hooks/useUser";
import { getReadingProgress, saveReadingProgress } from "@/lib/reading";
import { Highlight } from "@/types/reading";
import { getHighlights, saveHighlight, deleteHighlight, updateHighlightNote, updateHighlightColor } from "@/lib/highlights";
import ePub, { Book, Rendition } from "epubjs";
import { Loader2, ArrowLeft, ChevronLeft, ChevronRight, Settings2, Bookmark, FileText, X, Trash2, Check, PenSquare } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

// 4.2 - ReaderPage: Carga del visor de libros EPUB, interfaz HUD y persistencia de configuraciones de lectura local y servidor
export default function ReaderPage() {
  // 4.1.9 - Bloqueo de orientación vertical (Portrait)
  useEffect(() => {
    const lockPortrait = async () => {
      try {
        if ('screen' in window && 'orientation' in window.screen && (window.screen.orientation as any).lock) {
          await (window.screen.orientation as any).lock('portrait');
        }
      } catch (err) {
        console.warn("Screen orientation lock failed:", err);
      }
    };
    lockPortrait();
    return () => {
      try {
        if ('screen' in window && 'orientation' in window.screen && (window.screen.orientation as any).unlock) {
          (window.screen.orientation as any).unlock();
        }
      } catch (err) {}
    };
  }, []);

  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  // 4.2.1 - Referencias mutables para almacenar la instancia del libro, el renderizador y temporizadores
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRestoredPosition = useRef(false);
  const saveDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ref para la última posición CFI conocida para restaurar en resize (Evita saltos de texto)
  const lastCfiRef = useRef<string | null>(null);

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
  const [mounted, setMounted] = useState(false);

  // 4.2.2.4 - Estado para Subrayados y Notas
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [activeSelection, setActiveSelection] = useState<{ cfiRange: string; text: string; isExistingId?: string } | null>(null);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [editingNote, setEditingNote] = useState<{ id: string; note: string } | null>(null);
  const [isSavingHighlight, setIsSavingHighlight] = useState(false);

  const themeRef = useRef<string | undefined>(theme);
  const fontRef = useRef<string>(fontFamily);
  const sizeRef = useRef<number>(fontSize);
  const alignRef = useRef<"left" | "center" | "right" | "justify">(textAlign);
  const colorRef = useRef<string>(textColor);

  const textColors = [
    { name: "Negro", value: "#000000" },
    { name: "Sepia", value: "#f4ecd8" },
    { name: "Verde", value: "#3fb950" },
    { name: "Azul", value: "#60a5fa" },
    { name: "Rosa", value: "#f472b6" },
  ];

  const handleSetTextColor = (color: string) => {
    const bgMap: Record<string, string> = {
      light: "#ffffff",
      dark: "#0a0a0a",
      retro: "#0d1117",
      navy: "#0a0f1e"
    };

    const currentBg = bgMap[theme || "light"];
    
    if (theme === "light" && color !== "#000000") {
      toast.info("El modo claro solo acepta color negro en el texto para garantizar la lectura");
      return;
    }

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

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setShowControls(false);
      setShowSettings(false);
    }, 4000);
  };

  const toggleControls = () => {
    setShowControls(prev => {
      const nextState = !prev;
      if (nextState) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setShowControls(false);
          setShowSettings(false);
        }, 4000);
      } else {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setShowSettings(false);
      }
      return nextState;
    });
  };

  const handleHighlightClick = (h: Highlight) => {
    setShowNotesPanel(true);
    setActiveSelection({
      cfiRange: h.cfi_start,
      text: h.text,
      isExistingId: h.id
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

  useEffect(() => {
    if (!book?.epub_url || !viewerRef.current || !userId) return;

    const initEpub = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const epubUrl = book.epub_url as string;
        const bookInstance = ePub(epubUrl, { openAs: "epub" });
        bookRef.current = bookInstance;

        const viewerElement = viewerRef.current;
        
        const rendition = bookInstance.renderTo(viewerElement as Element, {
          width: "100%",
          height: "100%",
          spread: "none",
          manager: "continuous",
          flow: "scrolled",
          allowScriptedContent: true,
        });

        if (rendition.hooks && rendition.hooks.content) {
          rendition.hooks.content.register((contents: any) => {
            if (!contents || !contents.document) return;
            
            const style = contents.document.createElement("style");
            style.innerHTML = `
              @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400..700;1,400..700&family=Nunito:ital,wght@0,200..1000;1,200..1000&display=swap');
              @font-face {
                font-family: 'OpenDyslexic';
                src: url('https://antijingoist.github.io/opendyslexic/compiled/OpenDyslexic-Regular.otf');
              }
              html, body { height: auto; min-height: 100%; }
              body {
                line-height: 1.8 !important;
                padding: 20px 5% 20px !important;
                max-width: 800px !important;
                margin: 0 auto !important;
                color: var(--bookea-text-color, #171717) !important;
                font-family: var(--bookea-font-family, 'Inter', -apple-system, sans-serif) !important;
                box-sizing: border-box;
                overflow-x: hidden;
              }
              p, li, td, blockquote {
                margin-bottom: 1.5em !important;
                text-align: var(--bookea-text-align, justify) !important;
                color: var(--bookea-text-color, #171717) !important;
                font-family: var(--bookea-font-family, 'Inter', -apple-system, sans-serif) !important;
              }
              h1, h2, h3, h4, h5, h6 {
                text-align: center !important;
                color: var(--bookea-text-color, #171717) !important;
              }
              img { max-width: 100% !important; height: auto !important; }
            `;
            contents.document.head.appendChild(style);
            
            contents.document.documentElement.addEventListener('click', (e: MouseEvent) => {
              const selection = contents.window.getSelection();
              const text = selection?.toString() || "";
              if (text.trim().length > 0) return;
              toggleControls();
              setActiveSelection(null);
            });
          });
        }

        const updateTheme = () => {
          const currentTheme = themeRef.current;
          const currentColor = colorRef.current;
          if (currentTheme === "light") {
            rendition.themes.override("color", "#171717");
            rendition.themes.override("background", "#ffffff");
            rendition.themes.override("--bookea-text-color", "#171717");
          } else if (currentTheme === "dark") {
            rendition.themes.override("color", currentColor);
            rendition.themes.override("background", "#0a0a0a");
            rendition.themes.override("--bookea-text-color", currentColor);
          } else if (currentTheme === "retro") {
            rendition.themes.override("color", currentColor);
            rendition.themes.override("background", "#0d1117");
            rendition.themes.override("--bookea-text-color", currentColor);
          } else if (currentTheme === "navy") {
            rendition.themes.override("color", currentColor);
            rendition.themes.override("background", "#0a0f1e");
            rendition.themes.override("--bookea-text-color", currentColor);
          }
        };

        updateTheme();
        rendition.themes.fontSize(`${sizeRef.current}px`);
        renditionRef.current = rendition;

        await bookInstance.ready;
        
        const [savedProgress, savedHighlights] = await Promise.all([
          getReadingProgress(bookId, userId),
          getHighlights(bookId, userId)
        ]);
        
        setHighlights(savedHighlights);

        const renderHighlights = () => {
          savedHighlights.forEach(h => {
             try {
               rendition.annotations.highlight(h.cfi_start, { id: h.id }, (e: Event) => {
                 handleHighlightClick(h);
               }, undefined, { "fill": h.color, "fill-opacity": "0.3", "mix-blend-mode": "multiply" });
             } catch (err) {}
          });
        };

        rendition.on("rendered", () => {
          setIsLoading(false);
          renderHighlights();
        });

        rendition.on("selected", (cfiRange: string, contents: any) => {
          const selection = contents.window.getSelection();
          const text = selection?.toString() || "";
          if (text && text.trim().length > 0) {
            setActiveSelection({ cfiRange, text });
          }
        });

        if (savedProgress?.cfi_position) {
          await rendition.display(savedProgress.cfi_position);
        } else {
          await rendition.display();
        }

        setIsLoading(false);
        renderHighlights();

        rendition.on("relocated", (location: any) => {
          const cfi = location.start.cfi;
          lastCfiRef.current = cfi;
          const percent = bookInstance.locations.length() > 0
            ? bookInstance.locations.percentageFromCfi(cfi)
            : Number(location.start.percentage || 0);
          setProgress(percent * 100);

          if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
          saveDebounceRef.current = setTimeout(() => {
            saveReadingProgress(bookId, userId, cfi, percent * 100);
          }, 1500);
        });

        const generateLocations = () => {
          bookInstance.locations.generate(1600).catch((err: unknown) => {
            console.warn("EPUB Location generation failed:", err);
          });
        };

        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(generateLocations);
        } else {
          setTimeout(generateLocations, 1000);
        }

        bookInstance.on("openFailed", (err: unknown) => {
          console.error("EPUB Open Failed:", err);
          setError("No se pudo abrir el archivo EPUB.");
          setIsLoading(false);
        });

      } catch (err) {
        console.error("Error loading EPUB:", err);
        setError("Error al cargar el libro digital.");
        setIsLoading(false);
      }
    };

    initEpub();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      renditionRef.current?.destroy();
      renditionRef.current = null;
      bookRef.current?.destroy();
      bookRef.current = null;
    };
  }, [book?.epub_url, bookId, userId]);

  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') renditionRef.current?.prev();
      if (e.key === 'ArrowRight') renditionRef.current?.next();
      resetControlsTimeout();
    };
    document.addEventListener('keyup', handleKeyUp);
    return () => document.removeEventListener('keyup', handleKeyUp);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (renditionRef.current && viewerRef.current) {
        renditionRef.current.resize(viewerRef.current.clientWidth, viewerRef.current.clientHeight);
      }
    };
    const onOrientationChange = () => {
      setTimeout(() => {
        handleResize();
        if (lastCfiRef.current && renditionRef.current) {
          renditionRef.current.display(lastCfiRef.current);
        }
      }, 300);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", onOrientationChange);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", onOrientationChange);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (renditionRef.current) {
      renditionRef.current.themes.fontSize(`${fontSize}px`);
    }
    sizeRef.current = fontSize;
    localStorage.setItem("bookea-font-size", fontSize.toString());
  }, [fontSize, mounted]);

  useEffect(() => {
    const savedSize = localStorage.getItem("bookea-font-size");
    if (savedSize) setFontSize(parseInt(savedSize, 10));
    const savedFont = localStorage.getItem("bookea-font-family");
    if (savedFont) setFontFamily(savedFont);
    const savedAlign = localStorage.getItem("bookea-text-align");
    if (savedAlign) setTextAlign(savedAlign as any);
    const savedColor = localStorage.getItem("bookea-text-color");
    if (savedColor) setTextColor(savedColor);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !theme) return;
    themeRef.current = theme;
    if (renditionRef.current) {
      if (theme === "light") {
        renditionRef.current.themes.override("color", "#171717");
        renditionRef.current.themes.override("background", "#ffffff");
      } else {
        renditionRef.current.themes.override("color", colorRef.current);
        renditionRef.current.themes.override("background", theme === "dark" ? "#0a0a0a" : theme === "retro" ? "#0d1117" : "#0a0f1e");
      }
    }
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    if (renditionRef.current) {
      let fontStack = "Inter, sans-serif";
      if (fontFamily === "serif") fontStack = "Georgia, serif";
      if (fontFamily === "mono") fontStack = "monospace";
      renditionRef.current.themes.override("font-family", fontStack);
    }
    fontRef.current = fontFamily;
    localStorage.setItem("bookea-font-family", fontFamily);
  }, [fontFamily, mounted]);

  useEffect(() => {
    if (!mounted) return;
    if (renditionRef.current) renditionRef.current.themes.override("--bookea-text-align", textAlign);
    alignRef.current = textAlign;
    localStorage.setItem("bookea-text-align", textAlign);
  }, [textAlign, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const effectiveColor = theme === "light" ? "#171717" : textColor;
    if (renditionRef.current) renditionRef.current.themes.override("color", effectiveColor);
    colorRef.current = textColor;
    localStorage.setItem("bookea-text-color", textColor);
  }, [textColor, theme, mounted]);

  if (loadingBook) return <div className="h-screen flex items-center justify-center bg-[#0a0a0a]"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  if (error) return <div className="h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white p-4"><h2>{error}</h2><Link href="/dashboard" className="mt-4 px-6 py-2 bg-blue-600 rounded-full">Ir al Inicio</Link></div>;

  const isDark = theme === 'dark';
  const isRetro = theme === 'retro';
  const isNavy = theme === 'navy';
  const bgColors = isDark ? 'bg-[#0a0a0a] text-white' : isRetro ? 'bg-[#0d1117] text-[#3fb950]' : isNavy ? 'bg-[#0a0f1e] text-[#e8eaf6]' : 'bg-[#ffffff] text-black';

  return (
    <div className={`h-[100dvh] w-full flex flex-col overflow-hidden transition-colors duration-500 ${bgColors}`}>
      <div ref={viewerRef} className="flex-1 w-full" />
      {showControls && (
        <>
          <div className="fixed top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent z-50">
            <button onClick={() => router.back()} className="p-2 bg-white/10 rounded-full backdrop-blur-md text-white"><ArrowLeft className="w-5 h-5" /></button>
            <div className="flex gap-2">
              <button onClick={() => setShowSettings(!showSettings)} className="p-2 bg-white/10 rounded-full backdrop-blur-md text-white"><Settings2 className="w-5 h-5" /></button>
              <button onClick={() => setShowNotesPanel(!showNotesPanel)} className="p-2 bg-white/10 rounded-full backdrop-blur-md text-white"><FileText className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="fixed bottom-0 left-0 right-0 p-8 flex flex-col gap-4 bg-gradient-to-t from-black/50 to-transparent z-50">
             <div className="flex items-center justify-between px-4">
                <button onClick={() => renditionRef.current?.prev()} className="p-4 bg-white/10 rounded-full backdrop-blur-md text-white hover:bg-white/20 transition-all"><ChevronLeft className="w-6 h-6" /></button>
                <div className="bg-white/10 backdrop-blur-md px-6 py-2 rounded-full text-xs font-bold text-white shadow-lg">{Math.round(progress)}% completado</div>
                <button onClick={() => renditionRef.current?.next()} className="p-4 bg-white/10 rounded-full backdrop-blur-md text-white hover:bg-white/20 transition-all"><ChevronRight className="w-6 h-6" /></button>
             </div>
          </div>
        </>
      )}
    </div>
  );
}
