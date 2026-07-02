"use client";

import { useIsClient } from "@/hooks/useIsClient";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-800 rounded ${className}`}
    />
  );
}

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const mounted = useIsClient();

  return (
    <div
      className={`
        transition-all duration-200 ease-out
        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
    >
      {children}
    </div>
  );
}

interface BookCardSkeletonProps {
  variant?: "grid" | "list" | "compact";
}

export function BookCardSkeleton({ variant = "grid" }: BookCardSkeletonProps) {
  if (variant === "grid") {
    return (
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 overflow-hidden">
        <Skeleton className="aspect-[2/3] w-full rounded-none" />
        <div className="p-4 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 p-4 flex gap-4">
        <Skeleton className="w-24 h-36 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden">
      <Skeleton className="aspect-[2/3] w-full rounded-none" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white/5 border border-white/8 rounded-2xl p-5">
            <Skeleton className="w-10 h-10 rounded-xl mb-4" />
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>

      {/* Library section */}
      <div>
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <BookCardSkeleton key={i} variant="compact" />
          ))}
        </div>
      </div>
    </div>
  );
}

interface CatalogSkeletonProps {
  variant?: "grid" | "list" | "compact";
}

export function CatalogSkeleton({ variant = "grid" }: CatalogSkeletonProps) {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Filters */}
      <div className="flex gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Grid */}
      <div className={
        variant === "grid"
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          : variant === "compact"
          ? "grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
          : "flex flex-col gap-4"
      }>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <BookCardSkeleton key={i} variant={variant} />
        ))}
      </div>
    </div>
  );
}

// LoadingButton: Botón con feedback de carga instantáneo
interface LoadingButtonProps {
  children: React.ReactNode;
  isLoading?: boolean;
  loadingText?: string;
  onClick?: () => void;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

export function LoadingButton({
  children,
  isLoading = false,
  loadingText,
  onClick,
  className = "",
  variant = "primary",
  disabled = false,
  type = "button",
}: LoadingButtonProps) {
  const baseClasses = "relative inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variantClasses = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/30 focus:ring-blue-500",
    secondary: "bg-white/10 hover:bg-white/20 text-white border border-white/20 focus:ring-white/50",
    ghost: "hover:bg-white/10 text-gray-600 dark:text-gray-300 focus:ring-gray-500",
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={{
        transform: 'translate(var(--press-transform, 0))',
        transition: 'transform 100ms ease-out, opacity 150ms ease-out',
      }}
      onMouseDown={(e) => {
        (e.target as HTMLElement).style.setProperty('--press-transform', 'scale(0.97)');
      }}
      onMouseUp={(e) => {
        (e.target as HTMLElement).style.setProperty('--press-transform', 'scale(1)');
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLElement).style.setProperty('--press-transform', 'scale(1)');
      }}
      onTouchStart={(e) => {
        (e.target as HTMLElement).style.setProperty('--press-transform', 'scale(0.97)');
      }}
      onTouchEnd={(e) => {
        (e.target as HTMLElement).style.setProperty('--press-transform', 'scale(1)');
      }}
    >
      {/* Spinner */}
      {isLoading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}

      {/* Text */}
      <span className={isLoading && loadingText ? "hidden" : ""}>
        {children}
      </span>
      {isLoading && loadingText && (
        <span>{loadingText}</span>
      )}
    </button>
  );
}

// PrefetchLink: Link con prefetching automático (Rutas + Datos)
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getBook, getBooks } from "@/lib/books";
import { createClientClient } from "@/lib/supabase";

interface PrefetchLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  prefetch?: boolean;
  onClick?: () => void;
  // Opcional: datos específicos para precargar en React Query
  queryKey?: any[];
  bookId?: string;
}

export function PrefetchLink({
  href,
  children,
  className = "",
  style,
  prefetch = true,
  onClick,
  bookId
}: PrefetchLinkProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = createClientClient();

  const handleMouseEnter = useCallback(() => {
    if (!prefetch) return;

    // Prefetch de la ruta de Next.js
    router.prefetch(href);

    // Prefetch inteligente de datos en React Query
    if (bookId) {
      queryClient.prefetchQuery({
        queryKey: ["book", bookId],
        queryFn: () => getBook(supabase, bookId),
        staleTime: 5 * 60 * 1000,
      });
    }

    // Si es el catálogo o dashboard, precargar sus listas base
    if (href === "/catalog") {
      queryClient.prefetchQuery({
        queryKey: ["books", "", "all", ""],
        queryFn: () => getBooks(supabase),
        staleTime: 5 * 60 * 1000,
      });
    }
  }, [href, prefetch, router, bookId, queryClient, supabase]);

  return (
    <Link
      href={href}
      className={className}
      style={style}
      onMouseEnter={handleMouseEnter}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
