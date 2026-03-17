import { login } from '@/app/auth/actions' // <--- Importante

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-6">Bookea</h1>
      <form action={login} className="flex flex-col gap-4 w-full max-w-sm">
        <input 
          name="email" 
          type="email" 
          placeholder="Tu correo" 
          className="p-2 border rounded text-black outline-none focus:ring-2 focus:ring-black"
          required 
        />
        <button 
          type="submit"
          className="bg-black text-white p-2 rounded hover:bg-gray-800 transition-colors"
        >
          Enviar enlace mágico
        </button>
      </form>
    </div>
  )
}