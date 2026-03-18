"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useBook } from "@/hooks/useBooks";
import { getReadingProgress, saveReadingProgress } from "@/lib/reading";
import ePub, { Book, Rendition } from "epubjs";
import { Loader2, ArrowLeft, Sun, Moon, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

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

  // Auto-hide controls after 3 seconds of inactivity
  const resetControlsTimeout = () => {
    setShowControls(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setShowControls(false), 3000);
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
        });

        // Inject Custom Base CSS to override Publisher defaults
        rendition.hooks.content.register((contents: any) => {
          const style = document.createElement("style");
          style.innerHTML = `
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
              line-height: 1.8 !important;
              padding: 0 5% !important;
              max-width: 800px !important;
              margin: 0 auto !important;
              transition: color 0.3s ease, background-color 0.3s ease;
            }
            p {
              margin-bottom: 1.5em !important;
              text-align: justify !important;
            }
            h1, h2, h3, h4, h5, h6 {
              font-family: 'Inter', sans-serif !important;
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
          
          // Add click listener to center to toggle controls, edges to paginate
          contents.document.body.addEventListener('click', (e: MouseEvent) => {
            const width = contents.document.body.clientWidth;
            const x = e.clientX;
            if (x < width * 0.2) {
              rendition.prev();
            } else if (x > width * 0.8) {
              rendition.next();
            } else {
              setShowControls(prev => !prev);
              resetControlsTimeout();
            }
          });
        });

        const updateTheme = (currentTheme: "light" | "dark") => {
          rendition.themes.register("light", {
            body: { background: "#ffffff", color: "#171717" }
          });
          rendition.themes.register("dark", {
            body: { background: "#0a0a0a", color: "#ededed" }
          });
          rendition.themes.select(currentTheme);
        };

        updateTheme(theme);
        rendition.themes.fontSize(`${fontSize}px`);
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

      } catch (err) {
        console.error("Error loading EPUB:", err);
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
        renditionRef.current?.prev();
        resetControlsTimeout();
      }
      if (e.key === 'ArrowRight') {
        renditionRef.current?.next();
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
  }, [fontSize]);

  useEffect(() => {
    if (renditionRef.current) {
      renditionRef.current.themes.select(theme);
    }
  }, [theme]);

  const handlePrev = () => {
    renditionRef.current?.prev();
    resetControlsTimeout();
  };

  const handleNext = () => {
    renditionRef.current?.next();
    resetControlsTimeout();
  };

  if (loadingBook) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
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

  return (
    <div className={`h-[100dvh] w-full flex flex-col overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#0a0a0a] text-white' : 'bg-[#ffffff] text-black'}`}>
      
      {/* Top Navigation Bar - Glassmorphism */}
      <div 
        className={`absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-4 transition-all duration-300 ${
            showControls ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        } ${theme === 'dark' ? 'bg-black/60 backdrop-blur-xl border-b border-white/10' : 'bg-white/70 backdrop-blur-xl border-b border-black/5'} shadow-sm`}
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href={`/book/${bookId}`}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition"
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

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:flex items-center bg-black/5 dark:bg-white/10 rounded-full p-1">
            <button
              onClick={() => setFontSize((s) => Math.max(12, s - 2))}
              className="px-3 py-1.5 text-sm rounded-full hover:bg-white dark:hover:bg-black/50 transition-colors"
            >
              A-
            </button>
            <button
              onClick={() => setFontSize((s) => Math.min(32, s + 2))}
              className="px-3 py-1.5 text-sm rounded-full hover:bg-white dark:hover:bg-black/50 transition-colors"
            >
              A+
            </button>
          </div>

          <button
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            className="p-2.5 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
          >
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Reader Viewport */}
      <div 
        className="flex-1 relative w-full h-full pt-16 pb-16"
        onClick={() => { setShowControls(prev => !prev); resetControlsTimeout(); }}
      >
        {isLoading && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center z-10 ${theme === 'dark' ? 'bg-[#0a0a0a]' : 'bg-[#ffffff]'}`}>
            <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
            <span className="text-sm opacity-60 font-medium tracking-wide">Preparando libro...</span>
          </div>
        )}

        {error && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center z-10 px-6 text-center ${theme === 'dark' ? 'bg-[#0a0a0a]' : 'bg-[#ffffff]'}`}>
            <div className="text-red-500 mb-2 text-2xl">⚠️</div>
            <div className="text-lg font-medium mb-4">{error}</div>
            <Link href={`/book/${bookId}`} className="px-6 py-2 bg-gray-200 dark:bg-gray-800 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 transition">
              Volver
            </Link>
          </div>
        )}

        {/* EPUB Container */}
        <div ref={viewerRef} className="absolute inset-0 w-full h-full cursor-pointer" />
      </div>

      {/* Bottom Progress Bar - Glassmorphism */}
      <div 
        className={`absolute bottom-0 left-0 right-0 z-50 flex flex-col px-4 sm:px-6 py-4 transition-all duration-300 ${
            showControls ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        } ${theme === 'dark' ? 'bg-black/60 backdrop-blur-xl border-t border-white/10' : 'bg-white/70 backdrop-blur-xl border-t border-black/5'} shadow-[0_-4px_20px_rgba(0,0,0,0.05)]`}
      >
        <div className="flex items-center justify-between max-w-4xl mx-auto w-full gap-2 sm:gap-4">
          <button
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className="p-2 sm:p-3 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="flex-1 flex flex-col items-center gap-1 sm:gap-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest opacity-60">
              {progress > 0 ? `${progress.toFixed(1)}% Leído` : "Iniciando"}
            </span>
            <div className="w-full bg-black/10 dark:bg-white/20 rounded-full h-1 sm:h-1.5 overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="p-2 sm:p-3 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
