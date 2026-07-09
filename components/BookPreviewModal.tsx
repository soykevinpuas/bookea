"use client";

import AppImage from "@/components/ui/AppImage";
import { X, ExternalLink, BookOpen } from "lucide-react";
import Link from "next/link";

interface BookPreviewData {
  id: string;
  title: string;
  author?: string | null;
  cover_url?: string | null;
  description?: string | null;
  category?: string | null;
  price_physical?: number | null;
  stock_physical?: number | null;
}

interface BookPreviewModalProps {
  book: BookPreviewData;
  onClose: () => void;
}

export default function BookPreviewModal({ book, onClose }: BookPreviewModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-[#1a1a1a] flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-sm font-bold text-white/80 truncate pr-2">Información del libro</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors shrink-0">
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">
          <div className="flex gap-5">
            {book.cover_url && (
              <div className="w-[140px] shrink-0">
                <AppImage
                  src={book.cover_url}
                  alt={book.title}
                  className="w-full aspect-[2/3] rounded-xl object-cover bg-white/5 shadow-lg"
                />
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-2">
              <h2 className="text-lg font-bold text-white leading-tight">{book.title}</h2>
              {book.author && (
                <p className="text-sm text-white/50">{book.author}</p>
              )}
              {book.category && (
                <span className="inline-block text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                  {book.category}
                </span>
              )}
              {(book.price_physical ?? 0) > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-sm font-semibold text-amber-400">${book.price_physical} MXN</span>
                  {book.stock_physical != null && (
                    <span className="text-[10px] text-white/30">
                      ({book.stock_physical} uds.)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {book.description && (
            <div>
              <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Descripción</h4>
              <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line line-clamp-[10]">
                {book.description}
              </p>
            </div>
          )}

          <div className="pt-2">
            <Link
              href={`/book/${book.id}`}
              onClick={onClose}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl text-sm font-medium transition-all border border-white/10"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver en catálogo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
