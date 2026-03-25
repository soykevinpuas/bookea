import { login } from '@/app/auth/actions'
import Link from 'next/link'

// 2.1 - LoginPage: Componente de formulario para inicio de sesión de usuarios existentes
export default function LoginPage() {
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
            Bienvenido de nuevo a tu biblioteca
          </p>
        </div>
        {/* 2.1.1 - Formulario conectado a la Subrutina Server Action 'login' externa */}
        <form action={login} className="flex flex-col gap-5">
          {/* 2.1.2 - Campo de Email (Validado nativamente en navegador) */}
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
          
          {/* 2.1.3 - Campo de Contraseña oculta */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="password">
              Contraseña
            </label>
            <input 
              id="password"
              name="password" 
              type="password" 
              placeholder="••••••••" 
              className="w-full p-3 bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              required 
            />
          </div>
          
          <button 
            type="submit"
            className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium p-3 rounded-xl transition-all shadow-sm shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5"
          >
            Iniciar sesión
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          ¿No tienes una cuenta?{' '}
          <Link href="/register" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
            Regístrate aquí
          </Link>
        </p>
      </div>
    </div>
  )
}