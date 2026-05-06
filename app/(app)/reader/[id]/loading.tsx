import { Loader2 } from "lucide-react";

export default function ReaderLoading() {
  return (
    <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-[#0a0a0a] retro:bg-[#0d1117]">
      <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500 retro:text-[#3fb950]" />
      <span className="text-sm opacity-60 font-medium tracking-wide">Preparando libro...</span>
    </div>
  );
}
