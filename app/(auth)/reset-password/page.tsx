'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react'
import CoversBackground from '@/components/CoversBackground'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.success) {
        setSent(true)
      } else {
        setError(data.error || 'Error al enviar el correo')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 bg-gray-50/70 dark:bg-[#0a0a0a]/70 transition-colors duration-300 relative">
        <CoversBackground />
        <div className="w-full max-w-md p-8 bg-white/80 dark:bg-[#0a0a0a]/80 rounded-2xl shadow-lg border border-gray-100 dark:border-white/10 backdrop-blur-xl text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-3">Revisa tu correo</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            Si existe una cuenta con <strong>{email}</strong>, recibirás un enlace para restablecer tu contraseña en unos minutos.
          </p>
          <Link href="/login" className="text-blue-600 dark:text-blue-400 text-sm hover:underline">
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 bg-gray-50/70 dark:bg-[#0a0a0a]/70 transition-colors duration-300 relative">
      <CoversBackground />
      <div className="w-full max-w-md p-8 bg-white/80 dark:bg-[#0a0a0a]/80 rounded-2xl shadow-lg border border-gray-100 dark:border-white/10 backdrop-blur-xl">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-black tracking-tighter text-gray-900 dark:text-white">
              <span className="text-blue-600 dark:text-blue-500">B</span>ookea
            </h1>
          </Link>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
            Recupera tu acceso
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="email">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full p-3 bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium p-3 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</>
            ) : (
              <><Mail className="w-4 h-4" /> Enviar enlace de recuperación</>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <Link href="/login" className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
            <ArrowLeft className="w-3 h-3" /> Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
