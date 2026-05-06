import { DashboardSkeleton } from "@/components/ui/LoadingStates";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <div className="max-w-7xl mx-auto py-12">
        <DashboardSkeleton />
      </div>
    </div>
  );
}
