import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { ArrowLeft } from "lucide-react";

export default function BookLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="absolute top-0 left-0 right-0 h-96 overflow-hidden">
        <SkeletonBox className="w-full h-full scale-110 opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6 pt-[env(safe-area-inset-top)]">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center opacity-50">
            <ArrowLeft className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8 lg:gap-12 mt-4 md:mt-16">
          <div className="w-48 sm:w-56 md:w-72 flex-shrink-0 mx-auto md:mx-0">
            <SkeletonBox className="aspect-[2/3] w-full rounded-xl shadow-2xl" />
          </div>

          <div className="flex-1 text-center md:text-left mt-4 md:mt-8 space-y-6">
            <div className="space-y-4">
              <SkeletonBox className="h-10 w-3/4 mx-auto md:mx-0" />
              <SkeletonBox className="h-6 w-1/2 mx-auto md:mx-0" />
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <SkeletonBox className="h-8 w-24 rounded-full" />
              <SkeletonBox className="h-8 w-24 rounded-full" />
              <SkeletonBox className="h-8 w-24 rounded-full" />
            </div>

            <div className="space-y-3 pt-6 border-t border-white/10">
              <SkeletonBox className="h-4 w-full" />
              <SkeletonBox className="h-4 w-full" />
              <SkeletonBox className="h-4 w-5/6" />
              <SkeletonBox className="h-4 w-4/6" />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-8">
              <SkeletonBox className="h-14 w-full sm:flex-1 rounded-2xl" />
              <SkeletonBox className="h-14 w-full sm:w-1/3 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
