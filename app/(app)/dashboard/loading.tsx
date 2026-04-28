import { SkeletonBox } from "@/components/ui/SkeletonBox";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <SkeletonBox className="h-10 w-48 mb-2" />
          <SkeletonBox className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="space-y-2">
              <SkeletonBox className="aspect-[2/3] rounded-2xl" />
              <SkeletonBox className="h-4 w-3/4" />
              <SkeletonBox className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
