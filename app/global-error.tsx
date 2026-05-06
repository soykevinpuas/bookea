'use client'

// Global error boundary - catches unhandled errors at the root level
// This prevents the ugly Next.js "Application error" page from flashing
// during hydration or transient network failures.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="bg-[#0a0a0a] text-white min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="text-6xl mb-6">📚</div>
          <h2 className="text-2xl font-black mb-3 tracking-tight">
            <span className="text-blue-500">B</span>ookea
          </h2>
          <p className="text-white/50 text-sm mb-8 leading-relaxed">
            Algo salió mal al cargar la aplicación. Esto suele resolverse al recargar.
          </p>
          <button
            onClick={() => reset()}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  )
}
