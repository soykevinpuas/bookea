import { Loader2 } from "lucide-react";

export default function RootLoading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0a] retro:bg-[#0d1117] z-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 retro:text-[#3fb950]" />
        <span className="text-gray-500 dark:text-white/60 retro:text-[#3fb950]/80 text-sm font-medium animate-pulse tracking-wide uppercase">Cargando...</span>
      </div>
    </div>
  );
}
