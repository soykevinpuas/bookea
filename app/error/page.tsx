import Link from 'next/link'

export default function ErrorPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-300">
      <h1 className="text-2xl font-bold mb-4 text-red-600 dark:text-red-400">Error</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">Algo salió mal. Por favor intenta de nuevo.</p>
      <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:underline">
        Volver al login
      </Link>
    </div>
  )
}
