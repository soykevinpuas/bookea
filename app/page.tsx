import Link from "next/link";
import { BookOpen, Zap, Shield, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 overflow-hidden font-sans selection:bg-blue-500/30">
      
      {/* Decorative premium background elements */}
      <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-blue-900/20 to-transparent pointer-events-none -z-10"></div>
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none"></div>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 pt-24 pb-20 sm:pt-32 sm:pb-24 lg:pb-32 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-950/50 border border-blue-800/50 text-blue-300 text-sm font-medium mb-8 backdrop-blur-sm shadow-[0_0_15px_rgba(59,130,246,0.15)]">
            <Sparkles className="w-4 h-4" />
            <span>Lector EPUB & Tienda SaaS</span>
          </div>
          
          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight mb-8 text-white drop-shadow-sm">
            Tu biblioteca premium de <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              E-books
            </span> en México
          </h1>
          
          <p className="text-xl sm:text-2xl text-gray-400 mb-12 max-w-2xl mx-auto font-light leading-relaxed">
            Lee en línea con nuestra tecnología, suscríbete para acceder a tus títulos favoritos, y compra ediciones físicas directo desde la app.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            <Link 
              href="/catalog" 
              className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-lg transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] transform hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              Explorar Catálogo
            </Link>
            <Link 
              href="/login" 
              className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-semibold text-lg transition-all backdrop-blur-sm shadow-sm"
            >
              Iniciar
            </Link>
          </div>
        </div>
      </main>

      {/* Features Showcase */}
      <section className="border-t border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white/5 border border-white/5 rounded-2xl p-8 hover:bg-white/10 transition-colors">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-6 border border-blue-500/30">
                <BookOpen className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Lector Nativo</h3>
              <p className="text-gray-400 leading-relaxed">
                Disfruta de tus E-books en cualquier dispositivo sin instalaciones, sincronizando tu progreso en la nube con epub.js.
              </p>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-2xl p-8 hover:bg-white/10 transition-colors">
              <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center mb-6 border border-indigo-500/30">
                <Zap className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Suscripción Premium</h3>
              <p className="text-gray-400 leading-relaxed">
                Adquiere una membresía mensual para elegir 5 libros únicos de nuestro catálogo cada ciclo de facturación.
              </p>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-2xl p-8 hover:bg-white/10 transition-colors">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-6 border border-purple-500/30">
                <Shield className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Compras Seguras</h3>
              <p className="text-gray-400 leading-relaxed">
                Compra licencias permanentes o copias físicas con envío a domicilio. Transacciones blindadas con Stripe.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer minimalista */}
      <footer className="border-t border-white/10 py-8 text-center bg-black">
        <p className="text-gray-500 text-sm">
          © {new Date().getFullYear()} Bookea. Hecho para México. <Link href="/admin" className="hover:text-white transition-colors">Admin Panel</Link>
        </p>
      </footer>
    </div>
  );
}
