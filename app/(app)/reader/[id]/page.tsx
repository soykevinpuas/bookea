"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useBook } from "@/hooks/useBooks";
import { getReadingProgress, saveReadingProgress } from "@/lib/reading";
import ePub, { Book, Rendition } from "epubjs";
import { Loader2, ArrowLeft, Sun, Moon, ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { createClientClient } from "@/lib/supabase";

export default function ReaderPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: book, isLoading: loadingBook } = useBook(bookId);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(18); // Default to a more readable 18px
  const [fontFamily, setFontFamily] = useState<"sans" | "serif" | "mono">("sans");
  const [theme, setTheme] = useState<"light" | "dark" | "retro">("light");
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const themeRef = useRef<"light" | "dark" | "retro">(theme);
  const fontRef = useRef<"sans" | "serif" | "mono">(fontFamily);
  const sizeRef = useRef<number>(fontSize);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClientClient();
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        setUserId(data.session.user.id);
      }
    };
    fetchUser();
  }, []);

  // Auto-hide controls after 4 seconds of inactivity
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
        // Rendition with responsive flow
        const rendition = bookInstance.renderTo(viewerElement, {
          width: "100%",
          height: "100%",
          spread: "none", // For a more modern scrolling or single-page feel on mobile
          manager: "continuous",
          flow: "paginated",
          allowScriptedContent: true,
        });

        // Inject Custom Base CSS to override Publisher defaults
        if (rendition.hooks && rendition.hooks.content) {
          rendition.hooks.content.register((contents: any) => {
            if (!contents || !contents.document) return;
            
            const style = contents.document.createElement("style");
            style.innerHTML = `
              html {
                height: 100%;
              }
              body {
                line-height: 1.8 !important;
                padding: 0 5% !important;
                max-width: 800px !important;
                margin: 0 auto !important;
                min-height: 100vh !important;
                transition: color 0.3s ease, background-color 0.3s ease;
              }
              p {
                margin-bottom: 1.5em !important;
                text-align: justify !important;
              }
              h1, h2, h3, h4, h5, h6 {
                font-weight: 700 !important;
                margin-top: 2em !important;
                margin-bottom: 1em !important;
              }
              img {
                max-width: 100% !important;
                height: auto !important;
                border-radius: 8px !important;
              }
            `;
            contents.document.head.appendChild(style);
            
            // Add click listener to toggle controls only (pagination via HUD only)
            contents.document.documentElement.addEventListener('click', (e: MouseEvent) => {
              toggleControls();
            });
          });
        }


        const updateTheme = () => {
          if (themeRef.current === "light") {
            rendition.themes.override("color", "#171717");
            rendition.themes.override("background", "#ffffff");
          } else if (themeRef.current === "dark") {
            rendition.themes.override("color", "#ededed");
            rendition.themes.override("background", "#0a0a0a");
          } else if (themeRef.current === "retro") {
            rendition.themes.override("color", "#3fb950");
            rendition.themes.override("background", "#0d1117");
          }
        };

        updateTheme();
        
        if (fontRef.current === "sans") rendition.themes.font("Inter, -apple-system, sans-serif");
        if (fontRef.current === "serif") rendition.themes.font("Georgia, serif");
        if (fontRef.current === "mono") rendition.themes.font("'Fira Code', 'Courier New', monospace");
        
        rendition.themes.fontSize(`${sizeRef.current}px`);
        renditionRef.current = rendition;

        await bookInstance.ready;
        
        // Load reading progress
        const savedProgress = await getReadingProgress(bookId, userId);
        
        if (savedProgress?.cfi_position) {
          await rendition.display(savedProgress.cfi_position);
        } else {
          await rendition.display();
        }

        // Setup Locations for progress calculation
        // Generating locations can take time on large books, we do it in background
        bookInstance.locations.generate(1600).then((locations) => {
            // Updated progress logic once locations are ready
            rendition.on("relocated", (location: { start: { cfi: string; percentage: number | string } }) => {
                const percent = bookInstance.locations.percentageFromCfi(location.start.cfi);
                setProgress(percent * 100);
                saveReadingProgress(bookId, userId, location.start.cfi, percent * 100);
            });
        }).catch(err => {
            console.warn("EPUB Location generation failed (structural error):", err);
            // We don't set global error here to allow the user to keep reading if possible
        });


        // Fallback progress update before locations are generated
        rendition.on("relocated", (location: { start: { cfi: string; percentage: number | string } }) => {
            if (bookInstance.locations.length() === 0) {
               setProgress(Number(location.start.percentage || 0) * 100);
               saveReadingProgress(bookId, userId, location.start.cfi, Number(location.start.percentage || 0) * 100);
            }
        });

        rendition.on("rendered", () => {
          setIsLoading(false);
          // Wait a tiny bit extra to let iframe render clean
          setTimeout(() => setIsLoading(false), 300);
        });

        bookInstance.on("openFailed", (err: any) => {
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
      bookRef.current?.destroy();
    };
  }, [book?.epub_url, bookId, userId]);

  // Effect to handle keyboard navigation
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

  useEffect(() => {
    if (renditionRef.current) {
      renditionRef.current.themes.fontSize(`${fontSize}px`);
    }
    sizeRef.current = fontSize;
    localStorage.setItem("bookea-font-size", fontSize.toString());
  }, [fontSize]);

  const [mounted, setMounted] = useState(false);

  // Load saved preferences on mount
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

    const savedTheme = localStorage.getItem("bookea-theme");
    if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "retro") {
      setTheme(savedTheme);
      themeRef.current = savedTheme;
    }

    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (renditionRef.current) {
      if (theme === "light") {
        renditionRef.current.themes.override("color", "#171717");
        renditionRef.current.themes.override("background", "#ffffff");
      } else if (theme === "dark") {
        renditionRef.current.themes.override("color", "#ededed");
        renditionRef.current.themes.override("background", "#0a0a0a");
      } else if (theme === "retro") {
        renditionRef.current.themes.override("color", "#3fb950");
        renditionRef.current.themes.override("background", "#0d1117");
      }
    }
    themeRef.current = theme;
    localStorage.setItem("bookea-theme", theme);
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    if (renditionRef.current) {
      if (fontFamily === "sans") renditionRef.current.themes.font("Inter, -apple-system, sans-serif");
      if (fontFamily === "serif") renditionRef.current.themes.font("Georgia, serif");
      if (fontFamily === "mono") renditionRef.current.themes.font("'Fira Code', 'Courier New', monospace");
    }
    fontRef.current = fontFamily;
    localStorage.setItem("bookea-font-family", fontFamily);
  }, [fontFamily, mounted]);

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error && !bookRef.current) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-[#0a0a0a] text-white px-4 text-center">
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-[#0a0a0a]">
        <div className="text-xl text-gray-900 dark:text-gray-100 font-medium">Libro no disponible</div>
        <p className="text-gray-500 dark:text-gray-400">Este libro no pudo ser encontrado o no tiene versión digital.</p>
        <Link href={`/book/${bookId}`} className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition">
          Volver a detalles
        </Link>
      </div>
    );
  }

  // Dynamic UI colors based on theme
  const isDark = theme === 'dark';
  const isRetro = theme === 'retro';
  
  const iconBgClass = isDark ? 'bg-white/10 hover:bg-white/20' : isRetro ? 'bg-[#3fb950]/10 hover:bg-[#3fb950]/20' : 'bg-black/5 hover:bg-black/10';
  const panelBgClass = isDark ? 'bg-white/5' : isRetro ? 'bg-[#3fb950]/5 border border-[#3fb950]/10' : 'bg-black/5';
  const activeBtnClass = isDark ? 'bg-white/10 shadow-sm font-medium' : isRetro ? 'bg-[#3fb950]/20 shadow-sm font-medium text-[#3fb950]' : 'bg-white shadow-sm font-medium';
  const bgColors = isDark ? 'bg-[#0a0a0a] text-white' : isRetro ? 'bg-[#0d1117] text-[#3fb950]' : 'bg-[#ffffff] text-black';

  return (
    <div className={`h-[100dvh] w-full flex flex-col overflow-hidden transition-colors duration-500 ${bgColors}`}>
      
      {/* Top Navigation Bar - Glassmorphism */}
      <div 
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-4 transition-all duration-300 pointer-events-auto ${
            showControls ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        } ${isDark ? 'bg-black/60 backdrop-blur-xl border-b border-white/10' : 
            isRetro ? 'bg-[#0d1117]/90 backdrop-blur-xl border-b border-[#3fb950]/20' : 
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
            <div className={`absolute top-14 right-0 w-64 p-4 rounded-2xl shadow-2xl border backdrop-blur-3xl animate-in fade-in slide-in-from-top-4 duration-200 ${
              isDark ? 'bg-[#121212]/90 border-white/10 text-white' : 
              isRetro ? 'bg-[#0d1117]/95 border-[#3fb950]/30 text-[#3fb950]' : 
              'bg-white/95 border-black/5 text-gray-900'
            }`}>
              {/* Tipografía */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider opacity-60 mb-2">Tipografía</h3>
                <div className={`flex gap-1.5 p-1 rounded-lg ${panelBgClass}`}>
                  <button onClick={() => setFontFamily("sans")} className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${fontFamily === "sans" ? activeBtnClass : "opacity-60 hover:opacity-100"}`}>Sans</button>
                  <button onClick={() => setFontFamily("serif")} className={`flex-1 py-1.5 text-sm rounded-md transition-colors font-serif ${fontFamily === "serif" ? activeBtnClass : "opacity-60 hover:opacity-100"}`}>Serif</button>
                  <button onClick={() => setFontFamily("mono")} className={`flex-1 py-1.5 text-sm rounded-md transition-colors font-mono ${fontFamily === "mono" ? activeBtnClass : "opacity-60 hover:opacity-100"}`}>Mono</button>
                </div>
              </div>

              {/* Tamaño */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider opacity-60 mb-2">Tamaño de texto</h3>
                <div className={`flex items-center justify-between gap-2 p-1 rounded-lg ${panelBgClass}`}>
                  <button onClick={() => setFontSize((s) => Math.max(12, s - 2))} className={`flex-1 py-1.5 flex justify-center rounded-md transition-colors ${iconBgClass}`}>A-</button>
                  <span className="text-sm font-medium opacity-80">{fontSize}px</span>
                  <button onClick={() => setFontSize((s) => Math.min(32, s + 2))} className={`flex-1 py-1.5 flex justify-center rounded-md transition-colors ${iconBgClass}`}>A+</button>
                </div>
              </div>

              {/* Tema */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider opacity-60 mb-2">Tema</h3>
                <div className={`flex gap-1.5 p-1 rounded-lg ${panelBgClass}`}>
                  <button onClick={() => setTheme("light")} className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${theme === "light" ? "bg-white shadow-sm font-medium text-black" : "opacity-60 hover:opacity-100"}`}>Día</button>
                  <button onClick={() => setTheme("dark")} className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${theme === "dark" ? "bg-white/10 shadow-sm font-medium text-white" : "opacity-60 hover:opacity-100"}`}>Noche</button>
                  <button onClick={() => setTheme("retro")} className={`flex-1 py-1.5 text-sm rounded-md transition-colors font-mono ${theme === "retro" ? "bg-[#3fb950]/20 shadow-sm font-medium text-[#3fb950]" : "opacity-60 hover:opacity-100"}`}>Retro</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Reader Viewport */}
      <div 
        className="flex-1 relative w-full h-full pt-16 pb-16"
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

        {/* EPUB Container */}
        <div ref={viewerRef} className="absolute inset-0 w-full h-full cursor-pointer" />
      </div>

      {/* Bottom Progress Bar - Glassmorphism */}
      <div 
        className={`fixed bottom-0 left-0 right-0 z-50 flex flex-col px-4 sm:px-6 py-4 transition-all duration-300 pointer-events-auto ${
            showControls ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        } ${isDark ? 'bg-black/60 backdrop-blur-xl border-t border-white/10' : 
            isRetro ? 'bg-[#0d1117]/90 backdrop-blur-xl border-t border-[#3fb950]/20' : 
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
            <div className={`w-full rounded-full h-1 sm:h-1.5 overflow-hidden ${isDark ? 'bg-white/20' : isRetro ? 'bg-[#3fb950]/20' : 'bg-black/10'}`}>
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out ${
                  isRetro ? 'bg-[#3fb950]' : 'bg-blue-500'
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
