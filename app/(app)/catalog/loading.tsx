import { CatalogSkeleton } from "@/components/ui/LoadingStates";

export default function CatalogLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 sm:p-6 pb-24">
      <div className="max-w-7xl mx-auto pt-[max(env(safe-area-inset-top),20px)] mt-4">
        <div className="mb-6 flex flex-col gap-2">
          <div className="h-8 w-48 bg-white/10 rounded animate-pulse"></div>
          <div className="h-4 w-64 bg-white/10 rounded animate-pulse"></div>
        </div>
        <CatalogSkeleton variant="grid" />
      </div>
    </div>
  );
}
