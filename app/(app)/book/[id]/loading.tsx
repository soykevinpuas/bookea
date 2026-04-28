import { SkeletonBox } from "@/components/ui/SkeletonBox";

export default function BookLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row gap-8">
          <SkeletonBox className="w-48 h-64 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-4">
            <SkeletonBox className="h-10 w-3/4" />
            <SkeletonBox className="h-6 w-1/2" />
            <SkeletonBox className="h-4 w-full" />
            <SkeletonBox className="h-4 w-full" />
            <SkeletonBox className="h-4 w-2/3" />
            <div className="flex gap-4 pt-4">
              <SkeletonBox className="h-12 w-36 rounded-xl" />
              <SkeletonBox className="h-12 w-36 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
