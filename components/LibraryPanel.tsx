"use client"

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useUserId } from '@/hooks/useUser'
import { useUserBooks } from '@/hooks/useBooks'
import { X, BookOpen, Loader2, ChevronRight } from 'lucide-react'
import AppImage from '@/components/ui/AppImage'

interface LibraryPanelProps {
  open: boolean
  onClose: () => void
}

export default function LibraryPanel({ open, onClose }: LibraryPanelProps) {
  const { userId } = useUserId()
  const { data: books, isLoading, isError, refetch } = useUserBooks(userId || '')
  const panelRef = useRef<HTMLDivElement>(null)
  const dragState = useRef({ startX: 0, startY: 0, offset: 0, isDragging: false, panelWidth: 0 })

  // Drag-to-close like a curtain (drag RIGHT to close right panel)
  useEffect(() => {
    if (!open || !panelRef.current) return
    const el = panelRef.current
    const state = dragState.current

    const handleTouchStart = (e: TouchEvent) => {
      state.startX = e.touches[0].clientX
      state.startY = e.touches[0].clientY
      state.panelWidth = el.offsetWidth
      state.isDragging = true
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!state.isDragging) return
      const dx = e.touches[0].clientX - state.startX
      const dy = Math.abs(e.touches[0].clientY - state.startY)
      if (dy > Math.abs(dx) * 1.5) {
        state.isDragging = false
        return
      }
      state.offset = Math.max(0, Math.min(state.panelWidth, dx))
      el.style.transition = 'none'
      el.style.transform = `translateX(${state.offset}px)`
    }

    const handleTouchEnd = () => {
      if (!state.isDragging) return
      state.isDragging = false
      el.style.transition = ''
      if (state.offset > state.panelWidth * 0.3) {
        el.style.transform = 'translateX(100%)'
        setTimeout(onClose, 300)
      } else {
        el.style.transform = ''
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [open, onClose])

  // Reset inline transform when panel opens to let className take over
  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.style.transform = ''
      panelRef.current.style.transition = ''
    }
  }, [open])

  return (
    <div className={`fixed inset-0 z-50 flex justify-end pointer-events-none ${open ? '' : ''}`}>
      {open && (
        <div className="absolute inset-0 bg-white/5 dark:bg-black/30 backdrop-blur-2xl backdrop-saturate-150 pointer-events-auto" onClick={onClose} />
      )}
      <div
        ref={panelRef}
        className={`relative w-1/3 min-w-[280px] max-w-sm bg-white/95 dark:bg-[#111]/95 backdrop-blur-xl shadow-2xl h-full overflow-y-auto pointer-events-auto transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#111]/95 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 px-4 pb-3 flex items-center justify-between" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 48px)' }}>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-500" />
            Mis Libros
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : isError && (!books || books.length === 0) ? (
            <div className="py-12 text-center text-gray-400">
              <BookOpen className="mx-auto mb-3 h-12 w-12 opacity-30" />
              <p className="mb-1 text-sm font-medium">No pudimos conectar con tu biblioteca</p>
              <button onClick={() => void refetch()} className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500">Reintentar conexión</button>
            </div>
          ) : !books || books.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium mb-1">No tienes libros aún</p>
              <p className="text-xs text-gray-500">Explora el catálogo y agrega libros a tu biblioteca</p>
              <p className="text-[10px] text-gray-500 mt-2">Usa el icono del libro en la barra superior o desliza desde el borde derecho para abrir de nuevo</p>
            </div>
          ) : (
            books.map((book) => (
              <Link
                key={book.id}
                href={`/reader/${book.id}`}
                onClick={onClose}
                className="flex gap-3 bg-gray-50/80 dark:bg-white/5 rounded-xl p-3 hover:bg-gray-100 dark:hover:bg-white/[0.07] transition-colors group"
              >
                {book.cover_url ? (
                  <div className="w-14 h-20 rounded-lg overflow-hidden shrink-0 bg-gray-200 dark:bg-white/10">
                    <AppImage src={book.cover_url} alt={book.title} width={56} height={80} className="w-full h-full object-cover" />
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
