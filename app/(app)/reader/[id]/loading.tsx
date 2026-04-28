import { Loader2 } from "lucide-react";

export default function ReaderLoading() {
  return (
    <div className="h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
        <p className="text-sm text-white/40 font-medium">Preparando tu lectura...</p>
      </div>
    </div>
  );
}
