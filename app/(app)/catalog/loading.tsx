import { Loader2 } from "lucide-react";

export default function CatalogLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="text-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto" />
        <p className="text-sm text-gray-400 font-medium">Cargando catálogo...</p>
      </div>
    </div>
  );
}
