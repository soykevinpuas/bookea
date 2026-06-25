"use client";

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { createClientClient } from '@/lib/supabase'
import CoversBackground from '@/components/CoversBackground'

// 2.1 - LoginPage: Componente de formulario para inicio de sesión de usuarios existentes
export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage('')

    const form = e.currentTarget
    const email = (form.elements.namedItem('email') as HTMLInputElement).value
    const password = (form.elements.namedItem('password') as HTMLInputElement).value

    const supabase = createClientClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      if (error.message?.includes('Email not confirmed')) {
        setErrorMessage('Correo no confirmado. Revisa tu bandeja de entrada.')
      } else if (error.message?.includes('Invalid login credentials')) {
        setErrorMessage('Correo o contraseña incorrectos')
      } else {
        setErrorMessage(error.message)
      }
      setIsLoading(false)
      return
    }

    const { data: roleData } = await supabase.rpc("get_my_role");
    const role = roleData as string;

    if (role === "admin") {
      router.push('/admin');
    } else if (role === "vendedor") {
      router.push('/vendedor');
    } else {
      router.push('/dashboard');
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 bg-gray-50 dark:bg-[#0a0a0a] retro:bg-[#0d1117] transition-colors duration-300 relative">
      <CoversBackground />
      <div className="w-full max-w-md p-8 bg-white/80 dark:bg-[#0a0a0a]/80 rounded-2xl shadow-lg border border-gray-100 dark:border-white/10 backdrop-blur-xl">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-black tracking-tighter text-gray-900 dark:text-white">
              <span className="text-blue-600 dark:text-blue-500">B</span>ookea
            </h1>
          </Link>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
            Bienvenido de nuevo a tu biblioteca
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="email">
              Correo electrónico
            </label>
            <input 
              id="email"
              name="email" 
              type="email" 
              placeholder="tu@correo.com" 
              className="w-full p-3 bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              required 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="password">
              Contraseña
            </label>
            <div className="relative">
              <input 
                id="password"
                name="password" 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••" 
                className="w-full p-3 pr-12 bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                required 
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          
          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-sm text-red-600 dark:text-red-400 font-medium text-center">
              {errorMessage}
            </div>
          )}

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium p-3 rounded-xl transition-all shadow-sm shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Iniciando sesión...
              </>
            ) : (
              "Iniciar sesión"
            )}
          </button>
          
          <div className="text-center mt-3">
            <Link href="/reset-password" className="text-xs text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          ¿No tienes una cuenta?{' '}
          <Link href="/register" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
            Regístrate aquí
          </Link>
        </p>
        <div className="mt-6 flex items-center justify-center gap-3 text-xs text-gray-400">
          <Link href="/aviso-de-privacidad" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Aviso de Privacidad</Link>
          <span>|</span>
          <Link href="/terminos" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Términos</Link>
        </div>
      </div>
    </div>
  )
}