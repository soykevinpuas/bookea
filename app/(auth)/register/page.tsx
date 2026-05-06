'use client';

import { register } from '@/app/auth/actions'
import Link from 'next/link'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function RegisterContent() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [referrerId, setReferrerId] = useState<string | null>(null);
  const searchParams = useSearchParams();

  // 2.2.0 - Detectar parámetro de referido ?ref= en URL
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setReferrerId(ref);
    }
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (password !== confirmPassword) {
      e.preventDefault();
      setError('Las contraseñas no coinciden');
      return;
    }
    if (password.length < 6) {
      e.preventDefault();
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setError('');
    // Si todo coincide, el form se envía normalmente al Server Action
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 bg-gray-50 dark:bg-[#0a0a0a] retro:bg-[#0d1117] transition-colors duration-300">
      <div className="w-full max-w-md p-8 bg-white dark:bg-white/5 rounded-2xl shadow-lg border border-gray-100 dark:border-white/10 backdrop-blur-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-black tracking-tighter text-gray-900 dark:text-white">
              <span className="text-blue-600 dark:text-blue-500">B</span>ookea
            </h1>
          </Link>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
            Crea tu cuenta y empieza a leer
          </p>
          {referrerId && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Te invitó un amigo 🎉
            </p>
          )}
        </div>
        {/* 2.2.1 - Formulario conectado a la Subrutina Server Action 'register' externa */}
        <form action={register} onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Hidden field for referral tracking */}
          {referrerId && (
            <input type="hidden" name="referrer_id" value={referrerId} />
          )}
          {/* 2.2.2 - Campo de captura para el nuevo Email */}
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
          
          {/* 2.2.3 - Campo de registro de Contraseña */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="password">
              Contraseña
            </label>
            <input 
              id="password"
              name="password" 
              type="password" 
              placeholder="••••••••" 
              minLength={6}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              className="w-full p-3 bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              required 
            />
            <p className="text-xs text-gray-500 mt-2">Mínimo 6 caracteres</p>
          </div>

          {/* 2.2.4 - Campo de confirmación de Contraseña */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="confirmPassword">
              Confirmar contraseña
            </label>
            <input 
              id="confirmPassword"
              name="confirmPassword"
              type="password" 
              placeholder="••••••••" 
              minLength={6}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
              className={`w-full p-3 bg-gray-50 dark:bg-black/50 border rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                error ? 'border-red-500 dark:border-red-500' : 'border-gray-200 dark:border-white/10'
              }`}
              required 
            />
            {error && (
              <p className="text-xs text-red-500 mt-2 font-medium">{error}</p>
            )}
          </div>
          
          <button 
            type="submit"
            className="w-full mt-2 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 font-medium p-3 rounded-xl transition-all shadow-sm hover:-translate-y-0.5 border border-transparent dark:border-gray-700"
          >
            Registrarse
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
            Inicia sesión aquí
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white/40 font-bold uppercase tracking-widest text-xs">Cargando Registro...</div>}>
      <RegisterContent />
    </Suspense>
  )
}
