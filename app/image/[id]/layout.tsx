import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ImageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-muted/50 border px-4 py-2 rounded-lg flex items-center justify-between">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-8 w-28 rounded-md" />
              </div>
              <Skeleton className="w-full rounded-xl" style={{ minHeight: "60vh" }} />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
