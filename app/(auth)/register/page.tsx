import { register } from '@/app/auth/actions'
import Link from 'next/link'

export default function RegisterPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-300">
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
        </div>

        <form action={register} className="flex flex-col gap-5">
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
            <input 
              id="password"
              name="password" 
              type="password" 
              placeholder="••••••••" 
              minLength={6}
              className="w-full p-3 bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              required 
            />
            <p className="text-xs text-gray-500 mt-2">Mínimo 6 caracteres</p>
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
