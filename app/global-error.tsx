'use client'

import { useEffect } from 'react'

// 1.9 - Barrera de error global: atrapa errores no manejados a nivel raíz.
// Intenta recuperarse automáticamente en lugar de mostrar una pantalla rota.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Registrar el error real en consola para diagnóstico
    console.error('🔴 [GlobalError] Error atrapado:', error.message, error.digest)
    
    // Si la app crashea por culpa de una versión antigua cacheada por la PWA,
    // debemos desregistrar el Service Worker para romper el bucle infinito de errores.
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
    }

    // Intento automático de recuperación después de 1 segundo
    const timer = setTimeout(() => {
      window.location.reload(); // Forzar recarga completa en lugar de reset() para limpiar caché
    }, 1500)
    
    return () => clearTimeout(timer)
  }, [error, reset])

  return (
    <html lang="en">
      <body style={{
        backgroundColor: '#0a0a0a',
        color: 'white',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        margin: 0
      }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '1.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>📚</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.75rem' }}>
            <span style={{ color: '#a855f7' }}>B</span>ookea
          </h2>
          <button 
            onClick={() => reset()}
            className="px-4 py-2 bg-blue-600 rounded-lg text-sm"
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  )
}
