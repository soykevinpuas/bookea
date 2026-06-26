'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { createClientClient } from '@/lib/supabase'
import CoversBackground from '@/components/CoversBackground'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClientClient()
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    setError('')

    try {
      const supabase = createClientClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
      } else {
        setDone(true)
        setTimeout(() => router.push('/login'), 3000)
      }
    } catch {
      setError('Error al actualizar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 bg-gray-50/70 dark:bg-[#0a0a0a]/70 transition-colors duration-300 relative">
        <CoversBackground />
        <div className="w-full max-w-md p-8 bg-white/80 dark:bg-[#0a0a0a]/80 rounded-2xl shadow-lg border border-gray-100 dark:border-white/10 backdrop-blur-xl text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-3">Contraseña actualizada</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Redirigiendo al inicio de sesión...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 bg-gray-50/70 dark:bg-[#0a0a0a]/70 transition-colors duration-300 relative">
      <CoversBackground />
      <div className="w-full max-w-md p-8 bg-white/80 dark:bg-[#0a0a0a]/80 rounded-2xl shadow-lg border border-gray-100 dark:border-white/10 backdrop-blur-xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-tighter text-gray-900 dark:text-white">
            <span className="text-blue-600 dark:text-blue-500">B</span>ookea
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">Establece tu nueva contraseña</p>
        </div>

        {!sessionReady ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Verificando enlace...</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center max-w-sm">
              Si el enlace de recuperación expiró o no es válido, solicita uno nuevo desde la página de recuperación.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="password">
                Nueva contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                placeholder="••••••••"
                minLength={6}
                className="w-full p-3 bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="confirmPassword">
                Confirmar contraseña
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError('') }}
                placeholder="••••••••"
                minLength={6}
                className={`w-full p-3 bg-gray-50 dark:bg-black/50 border rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                  error ? 'border-red-500' : 'border-gray-200 dark:border-white/10'
                }`}
                required
              />
              {error && <p className="text-xs text-red-500 mt-2 font-medium">{error}</p>}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium p-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Actualizando...</>
              ) : (
                'Actualizar contraseña'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
