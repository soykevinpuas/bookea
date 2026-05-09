"use client"

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useUserId } from '@/hooks/useUser'
import { useUserBooks } from '@/hooks/useBooks'
import { X, BookOpen, Loader2, ChevronRight } from 'lucide-react'
import Image from 'next/image'

interface LibraryPanelProps {
  open: boolean
  onClose: () => void
}

export default function LibraryPanel({ open, onClose }: LibraryPanelProps) {
  const { userId } = useUserId()
  const { data: books, isLoading } = useUserBooks(userId || '')
  const panelRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)

  useEffect(() => {
    if (!open || !panelRef.current) return
    const el = panelRef.current
    const handleTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX
    }
    const handleTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX.current
      if (dx < -60) onClose()
    }
    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [open, onClose])

  return (
    <div className={`fixed inset-0 z-50 flex justify-end pointer-events-none ${open ? '' : ''}`}>
      {open && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
      )}
      <div
        ref={panelRef}
        className={`relative w-full max-w-sm bg-white dark:bg-[#111111] shadow-2xl h-full overflow-y-auto pointer-events-auto transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="sticky top-0 z-10 bg-white dark:bg-[#111111] border-b border-gray-200 dark:border-white/10 px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-500" />
            Mis Libros
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : !books || books.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium mb-1">No tienes libros aún</p>
              <p className="text-xs text-gray-500">Explora el catálogo y agrega libros a tu biblioteca</p>
            </div>
          ) : (
            books.map((book: any) => (
              <Link
                key={book.id}
                href={`/reader/${book.id}`}
                onClick={onClose}
                className="flex gap-3 bg-gray-50 dark:bg-white/5 rounded-xl p-3 hover:bg-gray-100 dark:hover:bg-white/[0.07] transition-colors group"
              >
                {book.cover_url ? (
                  <div className="w-14 h-20 rounded-lg overflow-hidden shrink-0 bg-gray-200 dark:bg-white/10">
                    <Image src={book.cover_url} alt={book.title} width={56} height={80} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-14 h-20 rounded-lg shrink-0 bg-gray-200 dark:bg-white/10 flex items-center justify-center text-xs text-gray-400">
                    Bookea
                  </div>
                )}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="text-sm font-semibold truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{book.title}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{book.author}</p>
                  {book.percent_complete !== undefined && book.percent_complete !== null && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${book.percent_complete}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium">{Math.round(book.percent_complete)}%</span>
                    </div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 self-center shrink-0 group-hover:text-blue-500 transition-colors" />
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
