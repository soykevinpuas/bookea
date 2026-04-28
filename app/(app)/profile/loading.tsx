import { Loader2 } from "lucide-react";

export default function ProfileLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070708]">
      <div className="text-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mx-auto" />
        <p className="text-sm text-white/40 font-medium">Cargando perfil...</p>
      </div>
    </div>
  );
}
