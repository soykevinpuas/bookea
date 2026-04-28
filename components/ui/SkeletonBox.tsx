interface SkeletonProps {
  className?: string;
}

export function SkeletonBox({ className }: SkeletonProps) {
  return (
    <div 
      className={`animate-pulse bg-gray-200 dark:bg-white/5 rounded ${className || ''}`} 
    />
  );
}

export function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-[#070708] text-white py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-12 flex justify-between items-end">
          <div>
            <SkeletonBox className="h-10 w-48 mb-2" />
            <SkeletonBox className="h-4 w-64" />
          </div>
          <SkeletonBox className="h-8 w-32 rounded-full" />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left column */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 text-center">
              <SkeletonBox className="w-32 h-32 rounded-full mx-auto mb-8" />
              <SkeletonBox className="h-8 w-48 mx-auto mb-2" />
              <SkeletonBox className="h-4 w-32 mx-auto mb-8" />
              <SkeletonBox className="h-10 w-full rounded-full" />
            </div>
          </div>
          
          {/* Right column */}
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
              <SkeletonBox className="h-8 w-64 mb-10" />
              <SkeletonBox className="w-full h-64 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
